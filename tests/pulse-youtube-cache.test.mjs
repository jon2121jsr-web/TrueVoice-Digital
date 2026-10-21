import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from 'esbuild';
import { createYouTubeHandler } from '../api/youtube.js';
import { canonicalKey, coreCacheQueries, createCatalogService, createCatalogStore, knownChannels, validPayload, nextQuotaReset, CATALOG_CHANNELS, MAX_BYTES } from '../api/_lib/youtubeCatalogCache.js';

const channel = CATALOG_CHANNELS[0];
const query = { endpoint: 'channels', part: 'contentDetails', id: channel };
const playlist = { endpoint: 'playlistItems', part: 'snippet', playlistId: `UU${channel.slice(2)}`, maxResults: '10' };
const payload = { items: [{ id: channel, contentDetails: { relatedPlaylists: { uploads: playlist.playlistId } } }] };
const env = { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production', YOUTUBE_API_KEY: 'fixture' };
const response = () => ({ headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(n) { this.code=n;return this; }, json(d) { this.body=d;return this; }, end() {} });

// Deterministic adapter models the migration protocol, NOT PostgreSQL execution.
function fixture() {
  let time = Date.parse('2026-10-16T12:00:00Z'), cooldown = 0, attempts = 0, optionalAttempts = 0;
  const rows = new Map();
  const coreKeys = new Set(coreCacheQueries().map(canonicalKey));
  const store = {
    authorized: async q => q.endpoint !== 'channels' || CATALOG_CHANNELS.includes(q.id),
    async claim(key,q,owner) {
      let row = rows.get(key);
      const core = coreKeys.has(key);
      const saved = row?.stale > time ? row.payload : null;
      const lifetime = { stale_remaining_ms: Math.max(0,(row?.stale || 0)-time) };
      if (saved && row.fresh > time) return { payload: saved, fresh: true, ...lifetime };
      if (cooldown > time || row?.lease > time || attempts >= 1000 || (!core && optionalAttempts>=150)) return { payload: saved, retry: 60, ...lifetime };
      if (!row && [...rows.values()].filter(r=>Boolean(r.core)===core).length >= (core?26:6)) return { retry: 60 };
      row ||= {}; Object.assign(row,{owner,lease:time+20000,core});rows.set(key,row);attempts++;if(!core)optionalAttempts++;
      return { acquired:true,payload:saved,...lifetime };
    },
    async finish(key,owner,data,ttl) {
      const row=rows.get(key);if(row?.owner!==owner || row.lease<=time)return false;
      Object.assign(row,{payload:data,fresh:time+ttl*1000,stale:time+(ttl+86400)*1000,owner:null,lease:0});return true;
    },
    async fail(key,owner,until,quota) {
      const row=rows.get(key);if(row?.owner!==owner || row.lease<=time)return false;
      Object.assign(row,{owner:null,lease:until});if(quota)cooldown=until;return true;
    },
  };
  let calls=0, upstream=async()=>new Response(JSON.stringify(payload));
  const options={store,now:()=>time,monotonicNow:()=>time,fetcher:async(...args)=>{calls++;return upstream(...args);}};
  return {store,rows,options,service:createCatalogService(options),get calls(){return calls;},get time(){return time;},
    advance:n=>{time+=n;},exhaustOptionalBudget:()=>{optionalAttempts=150;attempts=150;},setUpstream:fn=>{upstream=fn;}};
}

test('cold refresh persists unchanged contract; fresh and cross-instance hits make no Google calls', async()=>{
  const f=fixture();assert.deepEqual((await f.service.load(query,'fixture')).data,payload);
  assert.equal((await f.service.load(query,'fixture')).state,'fresh');
  assert.equal((await createCatalogService(f.options).load(query,'fixture')).state,'fresh');assert.equal(f.calls,1);
});
test('in-flight dedup and independent service leases suppress a cold stampede',async()=>{
  const f=fixture();let release;f.setUpstream(()=>new Promise(r=>{release=r;}));
  const one=f.service.load(query,'fixture'),two=f.service.load({...query},'fixture');
  await Promise.resolve();await Promise.resolve();
  const other=await createCatalogService(f.options).load(query,'fixture');assert.equal(other.status,503);assert.equal(f.calls,1);
  release(new Response(JSON.stringify(payload)));assert.deepEqual(await one,await two);
});
test('stale serves on failure, expiry stops stale serving, and errors never overwrite last-good',async()=>{
  const f=fixture();await f.service.load(query,'fixture');f.advance(86400001);
  f.setUpstream(async()=>new Response('upstream-secret',{status:500}));
  assert.equal((await f.service.load(query,'fixture')).state,'stale');
  assert.deepEqual(f.rows.get(canonicalKey(query)).payload,payload);
  f.advance(86400001);const expired=await f.service.load(query,'fixture');assert.equal(expired.status,500);assert.equal(expired.data,undefined);
  assert.ok(!JSON.stringify(expired).includes('secret'));
});
test('quotaExceeded sets shared cooldown: different keys and service instances cannot call Google',async()=>{
  const f=fixture();f.setUpstream(async()=>new Response(JSON.stringify({error:{errors:[{reason:'quotaExceeded'}]}}),{status:403}));
  assert.equal((await f.service.load(query,'fixture')).status,403);
  assert.equal((await createCatalogService(f.options).load({...query,id:CATALOG_CHANNELS[1]},'fixture')).status,503);assert.equal(f.calls,1);
  f.advance(nextQuotaReset(f.time)-f.time+1);await f.service.load(query,'fixture');assert.equal(f.calls,2);
});
test('quota cooldown preserves stale payload and allows fresh hits without upstream retries',async()=>{
  const f=fixture();await f.service.load(query,'fixture');f.advance(86400001);
  f.setUpstream(async()=>new Response(JSON.stringify({error:{errors:[{reason:'dailyLimitExceeded'}]}}),{status:403}));
  const first=await f.service.load(query,'fixture');assert.equal(first.state,'stale');assert.deepEqual(first.data,payload);
  const other=await createCatalogService(f.options).load(query,'fixture');assert.equal(other.state,'stale');assert.equal(f.calls,2);
});
test('lease-busy stale hits do not invoke Google; optional occupancy cannot block core',async()=>{
  const f=fixture();await f.service.load(query,'fixture');f.advance(86400001);
  await f.store.claim(canonicalKey(query),query,'other-instance');
  assert.equal((await f.service.load(query,'fixture')).state,'stale');assert.equal(f.calls,1);
  for(let i=0;i<6;i++)f.rows.set(`occupied-${i}`,{core:false});
  const second={...query,id:CATALOG_CHANNELS[1]};
  f.setUpstream(async()=>new Response(JSON.stringify({items:[]})));
  assert.equal((await f.service.load(second,'fixture')).status,200);assert.equal(f.calls,2);
  assert.equal((await f.service.load({...playlist,maxResults:'2'},'fixture')).status,503);assert.equal(f.calls,2);
});
test('audited core inventory is finite, preserves actual variants and includes configured admin',()=>{
  assert.equal(coreCacheQueries().length,23);
  assert.equal(coreCacheQueries({VITE_YOUTUBE_CHANNEL_ID:`UC${'z'.repeat(22)}`}).length,25);
  const keys=new Set(coreCacheQueries().map(canonicalKey));
  assert.ok(keys.has(canonicalKey(query)));assert.ok(keys.has(canonicalKey(playlist)));
  assert.ok(!keys.has(canonicalKey({...playlist,maxResults:'2'})));
});
test('optional refresh budget and pending floods leave core budget/in-flight slots available',async()=>{
  const f=fixture();f.exhaustOptionalBudget();
  assert.equal((await f.service.load({...playlist,maxResults:'2'},'fixture')).status,503);
  assert.equal((await f.service.load(query,'fixture')).status,200);assert.equal(f.calls,1);
  let release,claims=0;const blocked = new Promise(r=>{release=r;});
  const service=createCatalogService({store:{claim:async()=>{claims++;await blocked;return {acquired:false};}}});
  const pending=Array.from({length:6},(_,n)=>service.load({...playlist,maxResults:String(n+2)},'fixture'));
  assert.equal((await service.load({...playlist,maxResults:'9'},'fixture')).status,503);
  const core=service.load(query,'fixture');assert.equal(claims,7);release();assert.equal((await core).status,503);
  await Promise.all(pending); // core reached the store rather than the optional in-flight denial
});
test('slow failure and superseded refresh never serve a snapshot at or past its stale cutoff',async()=>{
  for(const mode of ['failure','superseded']){
    let clock=1000;
    const service=createCatalogService({now:()=>clock,monotonicNow:()=>clock,
      store:{claim:async()=>({acquired:true,payload:{items:[]},stale_remaining_ms:1}),fail:async()=>true,finish:async()=>false},
      fetcher:async()=>{clock=1001;return new Response(JSON.stringify({items:[]}),{status:mode==='failure'?500:200});}});
    const result=await service.load(playlist,'fixture');assert.notEqual(result.status,200);assert.equal(result.data,undefined);
  }
});
test('claim transit time and missing lifetime fail closed even for concurrent stale readers',async()=>{
  let clock=1000;
  const service=createCatalogService({monotonicNow:()=>clock,
    store:{claim:async()=>{clock=1002;return {acquired:false,payload:{items:[]},stale_remaining_ms:1};}}});
  assert.equal((await service.load(playlist,'fixture')).status,503);
  const missing=createCatalogService({store:{claim:async()=>({acquired:false,payload:{items:[]}})}});
  assert.equal((await missing.load(playlist,'fixture')).status,503);
});
test('handler rechecks expiry after asynchronous reader cleanup before sending stale data',async()=>{
  let clock=1000;
  const handler=createYouTubeHandler({env,monotonicNow:()=>clock,
    storeFactory:()=>({authorized:async()=>true,claim:async()=>({acquired:true,payload:{items:[]},stale_remaining_ms:1}),fail:async()=>true}),
    fetcher:async()=>({ok:false,status:500,headers:new Headers(),body:{getReader:()=>({read:async()=>({done:true}),cancel:async()=>{clock=1002;},releaseLock(){}})}})});
  const res=response();await handler({method:'GET',query:playlist},res);
  assert.equal(res.code,503);assert.equal(res.body.items,undefined);assert.equal(res.headers['X-Catalog-Cache'],undefined);
});
test('lease expiry allows recovery and rejects late former-owner publication',async()=>{
  const f=fixture(),key=canonicalKey(query);await f.store.claim(key,query,'old');f.advance(20001);
  assert.equal((await f.store.claim(key,query,'new')).acquired,true);
  assert.equal(await f.store.finish(key,'old',payload,86400),false);
  assert.equal(await f.store.finish(key,'new',payload,86400),true);
});
test('invalid JSON, invalid shape, oversized declared/actual bodies cannot poison cache',async()=>{
  for(const body of ['broken',JSON.stringify({items:[{id:'wrong'}]}),'x'.repeat(MAX_BYTES+1)]){
    const f=fixture();f.setUpstream(async()=>new Response(body));assert.equal((await f.service.load(query,'fixture')).status,502);
    assert.equal(f.rows.get(canonicalKey(query)).payload,undefined);
  }
  const f=fixture();f.setUpstream(async()=>new Response('{}',{headers:{'content-length':String(MAX_BYTES+1)}}));assert.equal((await f.service.load(query,'fixture')).status,502);
});
test('canonical keys ignore parameter insertion order, preserve semantic variants and statistics order',()=>{
  assert.equal(canonicalKey(query),canonicalKey({id:channel,part:'contentDetails',endpoint:'channels'}));
  assert.notEqual(canonicalKey(playlist),canonicalKey({...playlist,maxResults:'1'}));
  assert.notEqual(canonicalKey({endpoint:'videos',id:'aaaaaaaaaaa,bbbbbbbbbbb'}),canonicalKey({endpoint:'videos',id:'bbbbbbbbbbb,aaaaaaaaaaa'}));
});
test('payload validation retains feed and admin shapes including valid empty lists',()=>{
  assert.equal(validPayload(query,payload),true);
  assert.equal(validPayload(playlist,{items:[{snippet:{title:'Video',resourceId:{videoId:'abcdefghijk'}}}]}),true);
  assert.equal(validPayload({endpoint:'videos',id:'abcdefghijk'},{items:[{id:'abcdefghijk',snippet:{title:'Video'},statistics:{viewCount:'1'}}]}),true);
  assert.equal(validPayload(query,{items:[]}),true);assert.equal(validPayload(query,{error:{},items:[]}),false);
});
test('Pacific midnight reset handles spring/fall DST and year boundary',()=>{
  for(const [at,expected] of [['2026-03-08T09:00:00Z','2026-03-09T07:00:00Z'],['2026-11-01T08:00:00Z','2026-11-02T08:00:00Z'],['2026-12-31T23:00:00Z','2027-01-01T08:00:00Z']])assert.equal(new Date(nextQuotaReset(Date.parse(at))).toISOString(),new Date(expected).toISOString());
});
test('Preview/unsafe classification precedes every privileged store operation',async()=>{
  for(const e of [{VERCEL_ENV:'preview',VERCEL_TARGET_ENV:'preview'},{VERCEL_ENV:'production'},{VERCEL_ENV:'production',VERCEL_TARGET_ENV:'preview'}]){
    const handler=createYouTubeHandler({env:e,storeFactory:()=>assert.fail('No privileged access')});const res=response();await handler({method:'GET',query},res);assert.equal(res.code,503);
  }
});
test('unknown resource denial, configured admin channel support, and store failures fail closed',async()=>{
  const f=fixture(),handler=createYouTubeHandler({env,storeFactory:()=>f.store,fetcher:f.options.fetcher});
  const res=response();await handler({method:'GET',query:{...query,id:`UC${'x'.repeat(22)}`}},res);assert.equal(res.code,403);assert.equal(f.calls,0);
  const extra=`UC${'z'.repeat(22)}`;assert.ok(knownChannels({VITE_YOUTUBE_CHANNEL_ID:extra}).includes(extra));
  const broken=createYouTubeHandler({env,storeFactory:()=>{throw Error('secret');}}),r=response();await broken({method:'GET',query},r);assert.equal(r.code,503);assert.ok(!JSON.stringify(r).includes('secret'));
});
test('production handler keeps raw payload shape and emits safe cache diagnostics',async()=>{
  const f=fixture(),handler=createYouTubeHandler({env,storeFactory:()=>f.store,fetcher:f.options.fetcher});const r=response();await handler({method:'GET',query},r);
  assert.equal(r.code,200);assert.deepEqual(r.body,payload);assert.equal(r.headers['X-Catalog-Cache'],'refreshed');assert.equal(r.headers['Cache-Control'],'no-store');
});
test('browser catalog deduplicates concurrent hooks and clears rejected promises for retry',async()=>{
  const bundled=await build({entryPoints:['src/lib/youtubeCatalog.js'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env.PROD':'true','import.meta.env.VITE_YOUTUBE_API_KEY':'undefined'}});
  const {fetchYouTubeCatalog}=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
  const original=globalThis.fetch;let calls=0,release;
  globalThis.fetch=()=>{calls++;return new Promise(resolve=>{release=resolve;});};
  try{const a=fetchYouTubeCatalog('channels',{part:'contentDetails',id:channel});const b=fetchYouTubeCatalog('channels',{id:channel,part:'contentDetails'});assert.equal(calls,1);release(new Response('{}',{status:403}));await Promise.all([assert.rejects(a),assert.rejects(b)]);
    globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify(payload));};assert.deepEqual(await fetchYouTubeCatalog('channels',{id:channel,part:'contentDetails'}),payload);assert.equal(calls,2);
  }finally{globalThis.fetch=original;}
});
test('Supabase adapter uses only RPC, accepts actual uploads mappings and checks cached video membership',async()=>{
  const original=globalThis.fetch;let seen=[];
  globalThis.fetch=async(url,options)=>{seen.push({url,body:JSON.parse(options.body)});return new Response('true',{headers:{'content-type':'application/json'}});};
  try{const store=createCatalogStore({SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_KEY:'fixture'});
    assert.equal(await store.authorized(playlist,CATALOG_CHANNELS),true);assert.equal(seen.length,0);
    await store.authorized({...playlist,playlistId:'actualUploads'},CATALOG_CHANNELS);
    await store.authorized({endpoint:'videos',id:'abcdefghijk'},CATALOG_CHANNELS);
    assert.equal(seen.length,2);assert.ok(seen.every(x=>x.url.includes('/rpc/youtube_catalog_cache_v1')&&x.body.p_action==='authorize'));
    await store.claim(canonicalKey(query),query,'fixture-owner');
    await store.claim(canonicalKey({...playlist,maxResults:'2'}),{...playlist,maxResults:'2'},'fixture-owner');
    assert.equal(seen[2].body.p_core,true);assert.equal(seen[3].body.p_core,false);
  }finally{globalThis.fetch=original;}
});
test('migration bounds rows/payloads, revokes public access and guards refresh ownership',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261016010000_youtube_catalog_cache.sql','utf8');
  for(const text of ['enable row level security','from public, anon, authenticated','to service_role','security invoker','set search_path = pg_catalog','then 26 else 6','<= 1048576','for update','is distinct from p_owner',"interval '20 seconds'","interval '24 hours'",'attempts >= 1000','optional_attempts >= 150','stale_remaining_ms',"at time zone 'America/Los_Angeles'"] )assert.ok(sql.includes(text),text);
});
