import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { localDatabaseOptions, localPsql } from '../tools/local-cache-database.mjs';
import { canonicalKey, createCatalogService } from '../api/_lib/youtubeCatalogCache.js';

const migration = fs.readFileSync('supabase/migrations/20261016010000_youtube_catalog_cache.sql','utf8');
const key = n => `yt:v1:${n.toString(16).padStart(64,'0')}`;
const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';
const channel = 'UC_khbgasHiiwUxPHOMfbR0A';
const query = JSON.stringify({endpoint:'channels',part:'contentDetails',id:channel});
const payload = JSON.stringify({items:[{id:channel,contentDetails:{relatedPlaylists:{uploads:`UU${channel.slice(2)}`}}}]});
const claim = (n,owner,core=false) => `select public.youtube_catalog_cache_v1('claim','${key(n)}','${query}','${owner}',p_core=>${core});`;
const finish = (n,owner) => `select public.youtube_catalog_cache_v1('finish','${key(n)}',p_owner=>'${owner}',p_payload=>'${payload}',p_ttl=>86400);`;

test('database harness rejects remote/ambiguous targets before any connection',()=>{
  for(const url of ['postgresql://x:secret@db.example/pulse_cache_test','postgresql://x@localhost/pulse_cache_test',
    'postgresql://x@127.0.0.1/postgres','postgresql://x@127.0.0.1/pulse_cache_test?host=db.example']) {
    assert.throws(()=>localDatabaseOptions(url,'YES'),/disposable/);
  }
  assert.throws(()=>localDatabaseOptions('postgresql://x@127.0.0.1/pulse_cache_test','NO'),/disposable/);
  assert.equal(localDatabaseOptions('postgresql://x@127.0.0.1/pulse_cache_test','YES').PGHOST,'127.0.0.1');
});

const databaseUrl = process.env.PULSE_CACHE_TEST_DATABASE_URL;
test('isolated PostgreSQL migration, permissions, workers, expiry and rollback', {
  skip: !databaseUrl && 'No explicit disposable local database; no SQL executed',
}, async t => {
  const options = localDatabaseOptions(databaseUrl,process.env.PULSE_CACHE_TEST_DISPOSABLE);
  const sql = statement => localPsql(options,statement);
  const rpc = async statement => JSON.parse(await sql(`set role service_role; ${statement}`));
  // Require an existing isolated cluster's standard roles; never create/drop cluster roles.
  assert.equal(await sql("select count(*) from pg_roles where rolname in ('anon','authenticated','service_role');"),'3');
  assert.equal(await sql("select rolbypassrls from pg_roles where rolname='service_role';"),'t');
  assert.equal(await sql("select to_regclass('public.youtube_catalog_cache') is null and to_regclass('public.youtube_catalog_control') is null;"),'t');
  let applied = false;
  try {
    await t.test('local target stays loopback despite inherited libpq service overrides',async()=>{
      const names=['PGSERVICE','PGSERVICEFILE'],old=Object.fromEntries(names.map(n=>[n,process.env[n]]));
      process.env.PGSERVICE='must-not-load';process.env.PGSERVICEFILE='missing-local-test-service-file';
      try { assert.equal(await sql("select host(inet_server_addr()) || ':' || inet_server_port();"),`${options.PGHOST}:${options.PGPORT}`); }
      finally {for(const n of names){if(old[n]===undefined)delete process.env[n];else process.env[n]=old[n];}}
    });
    await sql(migration); applied = true;
    await t.test('migration applies and duplicate application fails atomically',async()=>{
      await assert.rejects(sql(migration));
      assert.equal(await sql('select count(*) from public.youtube_catalog_control;'),'1');
    });
    await t.test('anonymous/authenticated cannot read tables or execute RPC; invoker has fixed path',async()=>{
      for(const role of ['anon','authenticated']) {
        await assert.rejects(sql(`set role ${role}; select * from public.youtube_catalog_cache;`));
        await assert.rejects(sql(`set role ${role}; ${claim(1,ownerA)}`));
        // Prove RLS itself blocks rows/writes, independently of revoked grants.
        // Temporary grants and seeded rows are rolled back in this local fixture.
        assert.equal(await sql(`begin; insert into public.youtube_catalog_cache(cache_key,request) values('${key(90)}','${query}');
          grant select on public.youtube_catalog_cache to ${role}; set local role ${role};
          select count(*) from public.youtube_catalog_cache; rollback;`),'0');
        await assert.rejects(sql(`begin; grant insert on public.youtube_catalog_cache to ${role}; set local role ${role};
          insert into public.youtube_catalog_cache(cache_key,request) values('${key(91)}','${query}'); commit;`));
      }
      assert.equal(await sql("select count(*) from pg_class where oid in ('public.youtube_catalog_cache'::regclass,'public.youtube_catalog_control'::regclass) and relrowsecurity;"),'2');
      assert.equal(await sql("select prosecdef from pg_proc where oid='public.youtube_catalog_cache_v1(text,text,jsonb,uuid,jsonb,integer,timestamptz,boolean,text[],boolean)'::regprocedure;"),'f');
      assert.equal(await sql("select count(*) from pg_index where indrelid in ('public.youtube_catalog_cache'::regclass,'public.youtube_catalog_control'::regclass) and indisprimary and indisunique;"),'2');
      assert.equal(await sql("select proconfig @> array['search_path=pg_catalog'] from pg_proc where oid='public.youtube_catalog_cache_v1(text,text,jsonb,uuid,jsonb,integer,timestamptz,boolean,text[],boolean)'::regprocedure;"),'t');
    });
    await t.test('two connections compete for exactly one lease and correct owner finishes',async()=>{
      const results=await Promise.all([rpc(claim(1,ownerA)),rpc(claim(1,ownerB))]);
      assert.equal(results.filter(r=>r.acquired).length,1);
      const winner=results[0].acquired?ownerA:ownerB,loser=winner===ownerA?ownerB:ownerA;
      assert.equal(await rpc(finish(1,loser)),false);assert.equal(await rpc(finish(1,winner)),true);
      const hit=await rpc(claim(1,ownerA));assert.equal(hit.fresh,true);assert.deepEqual(hit.payload,JSON.parse(payload));
    });
    await t.test('expired lease recovers and late owner cannot publish',async()=>{
      await rpc(claim(2,ownerA));
      await sql(`update public.youtube_catalog_cache set lease_until=clock_timestamp()-interval '1 second' where cache_key='${key(2)}';`);
      assert.equal((await rpc(claim(2,ownerB))).acquired,true);
      assert.equal(await rpc(finish(2,ownerA)),false);assert.equal(await rpc(finish(2,ownerB)),true);
    });
    await t.test('actual SQL resource authorization rejects unknown playlists and statistics IDs',async()=>{
      const playlistId=`UU${channel.slice(2)}`;
      const playlistQuery=JSON.stringify({endpoint:'playlistItems',part:'snippet',playlistId,maxResults:'50'});
      const videoPayload=JSON.stringify({items:[{snippet:{title:'Local fixture',playlistId,resourceId:{videoId:'abcdefghijk'}}}]});
      await sql(`insert into public.youtube_catalog_cache(cache_key,request,is_core,payload,last_success,fresh_until,stale_until)
        values('${key(3)}','${playlistQuery}',true,'${videoPayload}',statement_timestamp(),statement_timestamp()+interval '30 minutes',statement_timestamp()+interval '1 hour');`);
      const authorize=q=>rpc(`select public.youtube_catalog_cache_v1('authorize',p_query=>'${JSON.stringify(q)}',p_channels=>array['${channel}']);`);
      assert.equal(await authorize({endpoint:'playlistItems',playlistId}),true);
      assert.equal(await authorize({endpoint:'playlistItems',playlistId:'unknown-playlist'}),false);
      assert.equal(await authorize({endpoint:'videos',id:'abcdefghijk'}),true);
      assert.equal(await authorize({endpoint:'videos',id:'zzzzzzzzzzz'}),false);
      assert.equal(await authorize({endpoint:'videos',id:'abcdefghijk,zzzzzzzzzzz'}),false);
    });
    await t.test('bounded stale reads and shared quota cooldown retain last good payload',async()=>{
      await sql(`update public.youtube_catalog_cache set last_success=clock_timestamp()-interval '2 days',fresh_until=clock_timestamp()-interval '1 hour',stale_until=clock_timestamp()+interval '1 hour' where cache_key='${key(1)}';`);
      const stale=await rpc(claim(1,ownerA));assert.equal(stale.acquired,true);assert.deepEqual(stale.payload,JSON.parse(payload));
      assert.ok(stale.stale_remaining_ms>0 && stale.stale_remaining_ms<=3600000);
      await rpc(`select public.youtube_catalog_cache_v1('fail','${key(1)}',p_owner=>'${ownerA}',p_quota=>true);`);
      assert.equal((await rpc(claim(4,ownerB))).acquired,false);
      assert.deepEqual((await rpc(claim(1,ownerB))).payload,JSON.parse(payload));
      assert.equal(await sql("select quota_until = (((clock_timestamp() at time zone 'America/Los_Angeles')::date+1)::timestamp at time zone 'America/Los_Angeles') from public.youtube_catalog_control;"),'t');
      await sql('update public.youtube_catalog_control set quota_until=null;');
    });
    await t.test('malformed and oversized payload constraints reject without overwrite',async()=>{
      await assert.rejects(sql(`update public.youtube_catalog_cache set payload='{}'::jsonb where cache_key='${key(1)}';`));
      await assert.rejects(sql(`update public.youtube_catalog_cache set payload=jsonb_build_object('items','[]'::jsonb,'extra',repeat('x',1048577)) where cache_key='${key(1)}';`));
      assert.equal(await sql(`select payload->'items'->0->>'id' from public.youtube_catalog_cache where cache_key='${key(1)}';`),channel);
    });
    await t.test('real DB snapshot expires during failed refresh; concurrent stale worker remains bounded',async()=>{
      const q=JSON.parse(query),cacheKey=canonicalKey(q);
      await sql(`insert into public.youtube_catalog_cache(cache_key,request,is_core,payload,last_success,fresh_until,stale_until)
        values('${cacheKey}','${query}',true,'${payload}',statement_timestamp()-interval '2 hours',statement_timestamp()-interval '1 hour',statement_timestamp()+interval '2 seconds');`);
      const store={
        claim:async(k,value,owner)=>rpc(`select public.youtube_catalog_cache_v1('claim','${k}','${JSON.stringify(value)}','${owner}',p_core=>true);`),
        fail:async(k,owner,until,quota)=>rpc(`select public.youtube_catalog_cache_v1('fail','${k}',p_owner=>'${owner}',p_until=>'${new Date(until).toISOString()}',p_quota=>${quota});`),
        finish:async()=>assert.fail('Failure must not publish new data'),
      };
      let enter;const started=new Promise(resolve=>{enter=resolve;});
      const slow=createCatalogService({store,fetcher:async()=>{enter();await new Promise(resolve=>setTimeout(resolve,2500));return new Response('{}',{status:500});}});
      const first=slow.load(q,'fixture-local-only');await started;
      const second=await createCatalogService({store,fetcher:()=>assert.fail('Concurrent worker must not call Google')}).load(q,'fixture-local-only');
      assert.equal(second.state,'stale');assert.deepEqual(second.data,JSON.parse(payload));
      const expired=await first;assert.notEqual(expired.status,200);assert.equal(expired.data,undefined);
      assert.equal(await sql(`select stale_until < clock_timestamp() from public.youtube_catalog_cache where cache_key='${cacheKey}';`),'t');
    });
    await t.test('cleanup, capacity and daily refresh limit fail safely',async()=>{
      await sql('delete from public.youtube_catalog_cache; update public.youtube_catalog_control set attempts=0,optional_attempts=0;');
      await sql(`insert into public.youtube_catalog_cache(cache_key,request,is_core,payload,last_success,fresh_until,stale_until)
        select 'yt:v1:'||lpad(to_hex(n),64,'0'),'${query}'::jsonb,n>6,'${payload}'::jsonb,clock_timestamp(),clock_timestamp()+interval '1 hour',clock_timestamp()+interval '2 hours' from generate_series(1,31) n;`);
      assert.equal((await rpc(claim(33,ownerA,false))).acquired,false); // six optional slots occupied
      assert.equal((await rpc(claim(32,ownerA,true))).acquired,true); // last reserved core slot remains usable
      assert.equal(await sql('select count(*) from public.youtube_catalog_cache;'),'32');
      assert.equal((await rpc(claim(34,ownerB,true))).acquired,false);
      await sql(`update public.youtube_catalog_cache set last_success=statement_timestamp()-interval '3 days',fresh_until=statement_timestamp()-interval '2 days',stale_until=statement_timestamp()-interval '1 day' where cache_key='${key(1)}';`);
      assert.equal((await rpc(claim(33,ownerA,false))).acquired,true);
      assert.equal(await sql(`select count(*) from public.youtube_catalog_cache where cache_key='${key(1)}';`),'0');
      await sql('update public.youtube_catalog_control set attempts=1000;');
      assert.equal((await rpc(claim(34,ownerB))).acquired,false);
    });
    await t.test('optional budget cannot consume core reservation',async()=>{
      await sql('delete from public.youtube_catalog_cache; update public.youtube_catalog_control set attempts=150,optional_attempts=150;');
      assert.equal((await rpc(claim(41,ownerA,false))).acquired,false);
      assert.equal((await rpc(claim(42,ownerB,true))).acquired,true);
    });
    await t.test('expired quota and previous Pacific budget day permit a new reservation',async()=>{
      await sql("delete from public.youtube_catalog_cache; update public.youtube_catalog_control set attempts=1000,optional_attempts=150,budget_day=(clock_timestamp() at time zone 'America/Los_Angeles')::date-1,quota_until=clock_timestamp()-interval '1 second';");
      assert.equal((await rpc(claim(43,ownerA,true))).acquired,true);
      assert.equal(await sql("select attempts=1 and optional_attempts=0 and budget_day=(clock_timestamp() at time zone 'America/Los_Angeles')::date from public.youtube_catalog_control;"),'t');
    });
    await t.test('database error rolls back its transaction without losing existing schema',async()=>{
      const before=await sql('select count(*) from public.youtube_catalog_cache;');
      await assert.rejects(sql("begin; delete from public.youtube_catalog_cache; select 1/0; commit;"));
      assert.equal(await sql('select count(*) from public.youtube_catalog_cache;'),before);
    });
    await t.test('transactional schema rollback leaves additive objects unchanged',async()=>{
      await sql("begin; update public.youtube_catalog_control set quota_until=clock_timestamp()+interval '1 hour'; rollback;");
      assert.equal(await sql("select to_regclass('public.youtube_catalog_cache') is not null;"),'t');
    });
  } finally {
    // Only objects created after the empty-cache precondition in this disposable DB.
    if(applied) await sql('drop function public.youtube_catalog_cache_v1(text,text,jsonb,uuid,jsonb,integer,timestamptz,boolean,text[],boolean); drop table public.youtube_catalog_cache,public.youtube_catalog_control;');
  }
});
