import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createMemoryRouter } from 'react-router-dom';
import handler, { validateCatalogQuery } from '../api/youtube.js';
import { consumeHandoffQuery, resolveShowHandoff } from '../src/lib/queryHandoff.js';

const { parse } = createRequire(import.meta.url)('@babel/parser');
const app = fs.readFileSync('src/App.jsx', 'utf8');
const ast = parse(app, { sourceType: 'module', plugins: ['jsx'] });
let effect;
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'CallExpression' && node.callee.name === 'useEffect' && app.slice(node.start,node.end).includes('resolveShowHandoff(')) effect = node.arguments[0];
  Object.values(node).forEach(value => { if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value); });
}
walk(ast);

test('actual show effect waits on cold load, resolves once, preserves URL and handles failure', () => {
  assert.ok(effect);
  assert.ok(!app.includes('window.history.replaceState'));
  const ref = { current: null }, opened = [], navigations = [], notices = [];
  const location = { key: 'direct', pathname: '/', search: '?show=pigskin&autoplay=1&utm_source=fixture', hash: '#keep', state: { from: 'scroll' } };
  const run = feed => Function('location','hasPulseLayout','processedShowRef','SHOW_SLUG_TO_SECTION','handoffFeed','resolveShowHandoff','setHandoffNotice','setShowThanks','media','openVideo','navigate','consumeHandoffQuery','document',
    `return (${app.slice(effect.start,effect.end)})();`)(location,true,ref,{pigskin:'PIGSKIN'},feed,resolveShowHandoff,value=>notices.push(value),()=>{}, {playRadio:()=>assert.fail('video handoff must not play radio')},video=>opened.push(video),(...args)=>navigations.push(args),consumeHandoffQuery,{getElementById:()=>null});
  run({loading:true, videos:[]});
  assert.equal(ref.current,null);
  assert.equal(navigations.length,0);
  run({loading:false,videos:[{id:'one'}]});
  run({loading:false,videos:[{id:'two'}]});
  assert.deepEqual(opened,[{id:'one'}]);
  assert.deepEqual(navigations[0],[{pathname:'/',search:'?utm_source=fixture',hash:'#keep'},{replace:true,state:location.state}]);
  location.key='failure'; run({loading:false,error:'unavailable',videos:[]});
  assert.ok(notices.at(-1).includes('could not load'));
  location.key='empty'; run({loading:false,videos:[]});
  assert.ok(notices.at(-1).includes('No video'));
  location.key='refresh'; run({loading:false,videos:[{id:'refresh'}]});
  assert.equal(opened.at(-1).id,'refresh');
  location.search='?show=unknown&autoplay=1'; location.key='unknown'; run({loading:true,videos:[]});
  assert.ok(notices.at(-1).includes('unavailable'));
});

test('router replacement keeps back/forward entries, state and unrelated query/hash', async () => {
  const router = createMemoryRouter([{path:'*',element:null}], {initialEntries:['/scroll/one','/?show=pigskin&autoplay=1&owner=true#keep'],initialIndex:1});
  try {
    await router.navigate(consumeHandoffQuery(router.state.location,['show','autoplay']),{replace:true,state:{from:'scroll'}});
    assert.equal(router.state.location.search,'?owner=true');
    assert.equal(router.state.location.hash,'#keep');
    assert.deepEqual(router.state.location.state,{from:'scroll'});
    await router.navigate(-1); assert.equal(router.state.location.pathname,'/scroll/one');
    await router.navigate(1); assert.equal(router.state.location.search,'?owner=true');
    assert.equal(router.state.location.hash,'#keep');
    assert.equal(new URLSearchParams(router.state.location.search).has('show'),false);
  } finally { router.dispose(); }
});

const channels = {endpoint:'channels',part:'contentDetails',id:'UC_khbgasHiiwUxPHOMfbR0A'};
const playlist = {endpoint:'playlistItems',part:'snippet',playlistId:'UU_khbgasHiiwUxPHOMfbR0A',maxResults:'50'};
const videos = {endpoint:'videos',part:'snippet,statistics',id:Array(50).fill('abcdefghijk').join(',')};
test('proxy allowlist retains feed and analytics consumers, rejects abuse', () => {
  for (const query of [channels,playlist,videos]) assert.deepEqual(validateCatalogQuery(query),query);
  for (const query of [{...channels,endpoint:'search'},{...channels,key:'client-key'}, {...channels,id:[channels.id]},
    {...channels,part:'statistics'}, {...playlist,maxResults:'51'}, {...playlist,maxResults:'0'}, {...playlist,maxResults:'1.5'},
    {...videos,id:videos.id+',abcdefghijk'}, {...channels,pageToken:'token'}, {...playlist,playlistId:'../search'},
    {...channels,endpoint:'__proto__'}]) assert.equal(validateCatalogQuery(query),null);
});

function response() { return { headers:{}, setHeader(key,value){this.headers[key]=value;}, status(code){this.code=code;return this;}, json(data){this.data=data;return this;}, end(){return this;} }; }
test('proxy bounds methods, time and response bytes, sanitizes upstream failures', async () => {
  const oldFetch=globalThis.fetch, oldKey=process.env.YOUTUBE_API_KEY, oldVite=process.env.VITE_YOUTUBE_API_KEY;
  const oldTimeout=globalThis.setTimeout, oldClear=globalThis.clearTimeout;
  process.env.YOUTUBE_API_KEY='fixture-private'; delete process.env.VITE_YOUTUBE_API_KEY;
  let calls=0;
  try {
    globalThis.fetch=async()=>{calls++; return new Response(JSON.stringify({items:[]}));};
    let res=response(); await handler({method:'POST',query:channels},res); assert.equal(res.code,405); assert.equal(calls,0);
    res=response(); await handler({method:'OPTIONS',query:{}},res); assert.equal(res.code,204);
    res=response(); await handler({method:'GET',query:{...channels,key:'bad'}},res); assert.equal(res.code,400); assert.equal(calls,0);
    globalThis.fetch=async(url,options)=>{calls++;assert.ok(url.startsWith('https://www.googleapis.com/youtube/v3/channels?'));assert.equal(options.redirect,'error');assert.ok(options.signal);return new Response(JSON.stringify({items:[]}));};
    res=response(); await handler({method:'GET',query:channels},res); assert.equal(res.code,200); assert.deepEqual(res.data,{items:[]});
    globalThis.fetch=async()=>new Response('credential-containing error',{status:403});
    res=response(); await handler({method:'GET',query:channels},res); assert.equal(res.code,403); assert.ok(!JSON.stringify(res.data).includes('credential'));
    globalThis.fetch=async()=>new Response('x'.repeat(1024*1024+1));
    res=response(); await handler({method:'GET',query:channels},res); assert.equal(res.code,502);
    globalThis.fetch=async()=>new Response('{}',{headers:{'content-length':String(1024*1024+1)}});
    res=response(); await handler({method:'GET',query:channels},res); assert.equal(res.code,502);
    globalThis.fetch=async()=>{throw new Error('fixture-private');};
    res=response(); await handler({method:'GET',query:channels},res); assert.equal(res.code,502); assert.ok(!JSON.stringify(res.data).includes('fixture-private'));
    globalThis.setTimeout=(fn,ms)=>{assert.equal(ms,8000);queueMicrotask(fn);return 1;}; globalThis.clearTimeout=()=>{};
    globalThis.fetch=async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('abort'))));
    res=response(); await handler({method:'GET',query:channels},res); assert.equal(res.code,504);
  } finally {
    globalThis.fetch=oldFetch;globalThis.setTimeout=oldTimeout;globalThis.clearTimeout=oldClear;
    if(oldKey===undefined)delete process.env.YOUTUBE_API_KEY;else process.env.YOUTUBE_API_KEY=oldKey;
    if(oldVite===undefined)delete process.env.VITE_YOUTUBE_API_KEY;else process.env.VITE_YOUTUBE_API_KEY=oldVite;
  }
});
