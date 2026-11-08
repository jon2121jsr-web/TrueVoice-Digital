import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

async function compile(file, fixtures = {}) {
  const result = await build({ entryPoints: [file], bundle: true, write: false,
    platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react/jsx-runtime'],
    define: { 'import.meta.env': '{}' }, loader: { '.css': 'empty' },
    plugins: [{ name: 'offline-admin-fixtures', setup(b) {
      b.onResolve({ filter: /.*/ }, args => {
        const contents = fixtures[args.path];
        return contents === undefined ? undefined : { path: args.path, namespace: 'fixture' };
      });
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: fixtures[args.path] }));
    } }],
  });
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, mod, mod.exports);
  return mod.exports;
}
const authFixtures = {
  './previewGuard.js': 'export const isRestrictedPreview=()=>false;',
  '@supabase/supabase-js': 'export const createClient=()=>globalThis.__adminClient;',
};
const { verifyAdmin } = await compile('./api/_lib/adminAuth.js', authFixtures);
const metrics = (await compile('./api/admin-metrics.js', {
  './_lib/adminAuth.js': 'export const verifyAdmin=req=>globalThis.__adminVerify(req);',
  './_lib/previewGuard.js': 'export const rejectPreview=()=>false;',
})).default;
const { readAdminData, listenerSnapshot } = await compile('./src/lib/adminData.js', {
  './apiBase': "export const API_BASE='';",
});
function response() {
  return { code: null, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; },
    status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } };
}
function client({ userError = null, adminError = null, member = true, fail = false } = {}) {
  return { auth: { async getUser() { if (fail) throw Error('private transport details');
    return { data: { user: { email: 'fixture@example.invalid' } }, error: userError }; } },
  from() { return { select() { return this; }, eq() { return this; },
    async maybeSingle() { return { data: member ? { role: 'member' } : null, error: adminError }; } }; } };
}
test('admin authorization preserves missing/expired/nonmember denial and separates backend failures', async () => {
  assert.equal((await verifyAdmin({ headers: {} })).status, 401);
  const req = { headers: { authorization: 'Bearer fixture' } };
  try {
    for (const [options, status] of [[{ userError: { status: 401 } }, 401], [{ member: false }, 403],
      [{ userError: { status: 503 } }, 503], [{ adminError: { message: 'private' } }, 503], [{ fail: true }, 503]]) {
      globalThis.__adminClient = client(options);
      const result = await verifyAdmin(req); assert.equal(result.status, status);
      assert.doesNotMatch(result.error, /private/);
    }
    globalThis.__adminClient = client();
    assert.equal((await verifyAdmin(req)).admin.role, 'member');
  } finally { delete globalThis.__adminClient; }
});
function metricClient(pages, trace) {
  return { from(table) { trace.push(['table', table]);
    return { select(columns) { trace.push(['columns', columns]); return this; },
      gte() { return this; }, lte() { return this; }, order() { return this; }, eq() { return this; },
      range(start) { this.offset = start; return this; }, abortSignal() { return this; },
      then(resolve, reject) { const page = pages[this.offset / 250];
        return (page instanceof Error ? Promise.reject(page) : Promise.resolve(page)).then(resolve, reject); } };
  } };
}
test('admin metrics refuses unauthorized reads, validates requests, and never caches private data', async () => {
  try {
    for (const status of [401, 403, 503]) {
      globalThis.__adminVerify = async () => ({ status, error: 'denied' });
      const res = response(); await metrics({ method: 'GET', query: { kind: 'events', days: '7' } }, res);
      assert.equal(res.code, status); assert.equal(res.headers['Cache-Control'], 'private, no-store');
    }
    globalThis.__adminVerify = async () => ({ supabaseAdmin: { from() { throw Error('must not query'); } } });
    for (const query of [{ kind: 'admin_users', days: '7' }, { kind: 'events', days: '999' }]) {
      const res = response(); await metrics({ method: 'GET', query }, res); assert.equal(res.code, 400);
    }
  } finally { delete globalThis.__adminVerify; }
});
test('admin metrics returns complete paginated data and genuine empty success, omitting private columns', async () => {
  try {
    for (const kind of ['donations', 'events', 'visits']) {
      const trace = [], rows = Array.from({ length: 250 }, (_, id) => ({ id }));
      globalThis.__adminVerify = async () => ({ supabaseAdmin: metricClient([
        { data: rows, count: 251 }, { data: [{ id: 250 }], count: 251 },
      ], trace) });
      const res = response(); await metrics({ method: 'GET', query: { kind, days: '7' } }, res);
      assert.equal(res.code, 200); assert.equal(res.body.rows.length, 251);
      assert.ok(trace.filter(([k]) => k === 'columns').every(([, v]) => !/\*|donor_email|\bip\b|\bua\b|user_agent/.test(v)));
    }
    globalThis.__adminVerify = async () => ({ supabaseAdmin: metricClient([{ data: [], count: 0 }], []) });
    const res = response(); await metrics({ method: 'GET', query: { kind: 'events', days: '7' } }, res);
    assert.deepEqual(res.body, { rows: [] }); assert.equal(res.code, 200);
  } finally { delete globalThis.__adminVerify; }
});
test('admin metrics fails visibly on errors, partial results, excess range, and thrown transport failures', async () => {
  try {
    for (const page of [{ error: { message: 'private database detail' } }, { data: [], count: 10 },
      { data: [], count: 10001 }, new Error('private transport detail')]) {
      globalThis.__adminVerify = async () => ({ supabaseAdmin: metricClient([page], []) });
      const res = response(); await metrics({ method: 'GET', query: { kind: 'visits', days: '7' } }, res);
      assert.equal(res.code, 503); assert.doesNotMatch(JSON.stringify(res.body), /private/);
      assert.equal(res.body.rows, undefined);
    }
  } finally { delete globalThis.__adminVerify; }
});
test('client distinguishes zero listeners from missing, malformed and unavailable counts', () => {
  assert.equal(listenerSnapshot({ listeners: { current: 0 } }).listeners, 0);
  assert.equal(listenerSnapshot({ listeners: { current: 4, unique: 2 } }).listenersUnique, 2);
  for (const value of [null, {}, { listeners: {} }, { listeners: { current: '0' } }, { listeners: { current: -1 } }]) {
    assert.throws(() => listenerSnapshot(value), /unavailable/);
  }
});
test('client rejects missing auth, failed connections, denied access, malformed success; preserves empty success', async () => {
  const original = globalThis.fetch;
  try {
    await assert.rejects(readAdminData('events', 7), /Sign in/);
    for (const status of [401, 403, 500]) {
      globalThis.fetch = async () => ({ status, ok: false });
      await assert.rejects(readAdminData('events', 7, 'fixture'), /expired|denied|unavailable/);
    }
    globalThis.fetch = async () => { throw Error('offline'); };
    await assert.rejects(readAdminData('events', 7, 'fixture'), /offline/);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
    await assert.rejects(readAdminData('events', 7, 'fixture'), /Invalid/);
    globalThis.fetch = async (url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer fixture'); assert.equal(options.cache, 'no-store');
      return { ok: true, json: async () => ({ rows: [] }) };
    };
    assert.deepEqual(await readAdminData('events', 7, 'fixture'), []);
  } finally { globalThis.fetch = original; }
});

const reactFixture = `const h=()=>globalThis.__adminHarness;
  export const useState=v=>h().state(v); export const useRef=v=>h().ref(v);
  export const useEffect=(f,d)=>h().effect(f,d); export const useMemo=(f,d)=>h().memo(f,d);
  export const useCallback=(f,d)=>h().memo(()=>f,d);`;
class Harness {
  slots = []; pending = []; cursor = 0;
  constructor(component) { this.component = component; }
  state(v) { const i = this.cursor++; this.slots[i] ??= { value: typeof v === 'function' ? v() : v };
    return [this.slots[i].value, n => { this.slots[i].value = typeof n === 'function' ? n(this.slots[i].value) : n; }]; }
  ref(v) { const i = this.cursor++; return this.slots[i] ??= { current: v }; }
  changed(i, deps) { return !this.slots[i] || deps.some((d, j) => d !== this.slots[i].deps[j]); }
  memo(fn, deps) { const i = this.cursor++; if (this.changed(i, deps)) this.slots[i] = { deps, value: fn() }; return this.slots[i].value; }
  effect(fn, deps) { const i = this.cursor++; if (this.changed(i, deps)) this.pending.push(() => {
    this.slots[i]?.cleanup?.(); this.slots[i] = { deps, cleanup: fn() }; }); }
  render(props = {}) { this.cursor = 0; globalThis.__adminHarness = this;
    const view = this.component(props); this.pending.splice(0).forEach(f => f()); return view; }
  unmount() { this.slots.forEach(s => s.cleanup?.()); }
}
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const Dashboard = (await compile('./src/pages/AdminDashboard.jsx', {
  react: reactFixture,
  recharts: 'export const LineChart=()=>null,Line=()=>null,BarChart=()=>null,Bar=()=>null,Cell=()=>null,XAxis=()=>null,YAxis=()=>null,Tooltip=()=>null,ResponsiveContainer=()=>null;',
  '../lib/supabaseClient': 'export const supabase=new Proxy({}, {get:(_,k)=>globalThis.__dashboardClient[k]});',
  '../lib/adminData': 'export const withAdminDeadline=p=>p;',
  '../lib/visitorStore': 'export const readAllVisits=async()=>[];',
  '../hooks/useAzuraCast': 'export function useAzuraCast(){globalThis.__dataLoads++; return {nowPlaying:null,loading:false,error:"offline",chartData:[],history:[]};}',
  '../hooks/useYouTubeAnalytics': 'export function useYouTubeAnalytics(){globalThis.__dataLoads++;return {totals:{},shows:[],loading:false,error:"offline"};}',
  '../hooks/useStripeDonations': 'export function useStripeDonations(){globalThis.__dataLoads++;return {totals:{},donations:[],dailyChart:[],loading:false,error:"offline"};}',
  '../hooks/useSiteAnalytics': 'export function useSiteAnalytics(){globalThis.__dataLoads++;return {summary:null,loading:false,error:"offline"};}',
})).default;
test('dashboard distinguishes session/membership failure, nonmember denial, and mounts data only after authorization', async () => {
  const oldWindow = globalThis.window;
  globalThis.window = { location: { hash: '' } };
  const session = { access_token: 'fixture', user: { email: 'fixture@example.invalid' } };
  try {
    for (const mode of ['signed-out', 'session-error', 'membership-error', 'nonmember', 'admin']) {
      globalThis.__dataLoads = 0;
      globalThis.__dashboardClient = {
        auth: { getSession: async () => ({ data: { session: mode === 'signed-out' ? null : session }, error: mode === 'session-error' ? {} : null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
        from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({
          data: mode === 'nonmember' ? null : { role: 'member' }, error: mode === 'membership-error' ? {} : null }) }),
      };
      const h = new Harness(Dashboard), children = [];
      try {
        let view = h.render(); await flush(); view = h.render(); await flush(); view = h.render();
        assert.equal(globalThis.__dataLoads, 0);
        if (mode === 'signed-out') assert.equal(view.type.name, 'SignInGate');
        if (mode.endsWith('error')) {
          assert.equal(view.type.name, 'AuthCard'); assert.match(JSON.stringify(view.props), /failed|Retry/);
        }
        if (mode === 'nonmember') assert.equal(view.type.name, 'NotAuthorizedGate');
        if (mode === 'admin') {
          assert.equal(view.type.name, 'AdminContent');
          const content = new Harness(view.type); children.push(content); view = content.render(view.props);
          const metricsHarness = new Harness(view.type); children.push(metricsHarness); view = metricsHarness.render(view.props);
          assert.equal(globalThis.__dataLoads, 4);
          assert.match(JSON.stringify(view.props), /Unavailable/);
          assert.doesNotMatch(JSON.stringify(view.props), /Avg listen|Video views \(/);
        }
      } finally { h.unmount(); children.forEach(c => c.unmount()); }
    }
  } finally {
    globalThis.window = oldWindow;
    delete globalThis.__adminHarness; delete globalThis.__dashboardClient; delete globalThis.__dataLoads;
  }
});
const { useAdminRows } = await compile('./src/hooks/useAdminRows.js', {
  react: reactFixture, '../lib/adminData': 'export const readAdminData=(...args)=>globalThis.__readRows(...args);',
});
test('admin row hook loads success, hides failed or stale ranges, and ignores late results after sign-out', async () => {
  const h = new Harness(props => useAdminRows('events', props.days, 'fixture'));
  try {
    globalThis.__readRows = async () => [{ event: 'pageview' }];
    let view = h.render({ days: 7 }); assert.equal(view.loading, true);
    await flush(); view = h.render({ days: 7 }); assert.equal(view.rows.length, 1);
    globalThis.__readRows = async () => { throw Error('connection unavailable'); };
    view = h.render({ days: 30 }); assert.equal(view.rows, null);
    await flush(); view = h.render({ days: 30 }); assert.match(view.error, /unavailable/); assert.equal(view.rows, null);
    let complete;
    globalThis.__readRows = () => new Promise(resolve => { complete = resolve; });
    h.render({ days: 90 }); h.unmount(); complete([{ event: 'private stale result' }]); await flush();
    assert.equal(h.slots[0].value.rows, null);
  } finally { h.unmount(); delete globalThis.__adminHarness; delete globalThis.__readRows; }
});

const { useAzuraCast } = await compile('./src/hooks/useAzuraCast.js', {
  react: reactFixture, './apiBase': "export const API_BASE='';",
});
test('AzuraCast hook exposes HTTP failure as unavailable and then recovers to genuine zero', async () => {
  const oldFetch = globalThis.fetch, storage = globalThis.sessionStorage;
  globalThis.sessionStorage = { getItem: () => '[]', setItem() {} };
  const h = new Harness(() => useAzuraCast());
  try {
    globalThis.fetch = async () => ({ ok: false, status: 503 });
    h.render(); await flush(); let view = h.render();
    assert.equal(view.nowPlaying, null); assert.match(view.error, /AzuraCast/);
    assert.equal(view.loading, false); assert.equal(view.peakToday, null);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ listeners: { current: 0 } }) });
    await view.refetch(); view = h.render();
    assert.equal(view.nowPlaying.listeners, 0); assert.equal(view.error, null);
    assert.equal(view.peakToday, 0);
    globalThis.fetch = async () => { throw Error('offline'); };
    await view.refetch(); view = h.render();
    assert.equal(view.nowPlaying, null); assert.match(view.error, /unavailable/);
  } finally { h.unmount(); globalThis.fetch = oldFetch; globalThis.sessionStorage = storage; delete globalThis.__adminHarness; }
});

const rowsFixture = { './useAdminRows': 'export const useAdminRows=()=>globalThis.__metricRows;' };
const { useStripeDonations } = await compile('./src/hooks/useStripeDonations.js', rowsFixture);
const { useSiteAnalytics } = await compile('./src/hooks/useSiteAnalytics.js', rowsFixture);
test('derived admin metrics preserve genuine zero, report failures, and compute established donation/session meanings', () => {
  try {
    globalThis.__metricRows = { rows: [], loading: false, error: null };
    assert.equal(useStripeDonations().totals.grossDisplay, '$0.00');
    assert.equal(useSiteAnalytics().summary.uniqueVisitors, 0);
    globalThis.__metricRows = { rows: null, loading: false, error: 'backend unavailable' };
    assert.equal(useStripeDonations().totals.grossDisplay, undefined);
    assert.equal(useSiteAnalytics().summary, null);
    assert.equal(useSiteAnalytics().error, 'backend unavailable');
    globalThis.__metricRows = { rows: [{ id: 1, currency: 'usd', amount_cents: 1000, type: 'one_time', created_at: new Date().toISOString() }], loading: false };
    assert.equal(useStripeDonations().totals.grossDisplay, '$10.00');
    assert.equal(useStripeDonations().totals.netDisplay, '$9.41');
    globalThis.__metricRows.rows[0].currency = 'eur';
    assert.match(useStripeDonations().error, /currency/);
  } finally { delete globalThis.__metricRows; }
});
