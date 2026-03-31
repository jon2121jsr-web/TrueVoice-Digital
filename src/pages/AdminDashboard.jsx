/**
 * AdminDashboard — /src/pages/AdminDashboard.jsx
 *
 * Protected admin route for TrueVoice Digital analytics.
 * Wired to: AzuraCast, YouTube Data API, Stripe (via Supabase), custom analytics.
 *
 * Add to your router (e.g. App.jsx):
 *   import AdminDashboard from './pages/AdminDashboard'
 *   <Route path="/admin" element={<AdminDashboard />} />
 *
 * Gate access with a simple env-var PIN (change to Supabase Auth if you want):
 *   VITE_ADMIN_PIN=yourpin
 *
 * Install deps if not already present:
 *   npm install recharts
 */

import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { useAzuraCast }       from '../hooks/useAzuraCast';
import { useYouTubeAnalytics } from '../hooks/useYouTubeAnalytics';
import { useStripeDonations }  from '../hooks/useStripeDonations';
import { useSiteAnalytics }    from '../hooks/useSiteAnalytics';

// ─── Simple PIN gate ─────────────────────────────────────────────────────────

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || 'tv2024admin';

function PinGate({ onUnlock }) {
  console.log('PIN env:', import.meta.env.VITE_ADMIN_PIN);
  const [pin, setPin]   = useState('');
  const [err, setErr]   = useState(false);
  const submit = () => {
    if (pin === ADMIN_PIN) { onUnlock(); }
    else { setErr(true); setPin(''); }
  };
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f5f5f3' }}>
      <div style={{ background:'#fff', border:'0.5px solid #ddd', borderRadius:12, padding:'32px 40px', minWidth:300, textAlign:'center' }}>
        <div style={{ width:40, height:40, background:'#1a5e3a', borderRadius:8, margin:'0 auto 16px', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M8 2L14 6V10L8 14L2 10V6L8 2Z" fill="white" opacity="0.9"/></svg>
        </div>
        <p style={{ fontSize:15, fontWeight:500, marginBottom:4 }}>TrueVoice Admin</p>
        <p style={{ fontSize:13, color:'#888', marginBottom:20 }}>Enter your admin PIN</p>
        <input
          type="password"
          value={pin}
          onChange={e => { setPin(e.target.value); setErr(false); }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="PIN"
          style={{ width:'100%', padding:'10px 14px', border:`1px solid ${err ? '#e24b4a' : '#ddd'}`, borderRadius:8, fontSize:14, marginBottom:12, outline:'none', boxSizing:'border-box' }}
          autoFocus
        />
        {err && <p style={{ color:'#e24b4a', fontSize:12, marginBottom:8 }}>Incorrect PIN</p>}
        <button onClick={submit} style={{ width:'100%', padding:'10px 0', background:'#1a5e3a', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:500, cursor:'pointer' }}>
          Enter
        </button>
      </div>
    </div>
  );
}

// ─── Palette ─────────────────────────────────────────────────────────────────

const C = {
  green:  '#1a5e3a',
  blue:   '#185FA5',
  amber:  '#BA7517',
  pink:   '#993556',
  purple: '#534AB7',
  teal:   '#0F6E56',
  gray:   '#888780',
};
const SHOW_COLORS = [C.green, C.blue, C.amber, C.pink, C.purple];

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, delta, deltaUp }) {
  return (
    <div style={{ background:'#fff', border:'0.5px solid #e5e5e5', borderRadius:12, padding:16 }}>
      <p style={{ fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{label}</p>
      <p style={{ fontSize:26, fontWeight:500, color:'#111', lineHeight:1 }}>{value ?? '—'}</p>
      {delta && (
        <p style={{ fontSize:12, marginTop:6, color: deltaUp ? '#3B6D11' : '#A32D2D' }}>{delta}</p>
      )}
    </div>
  );
}

function Panel({ title, meta, children, style }) {
  return (
    <div style={{ background:'#fff', border:'0.5px solid #e5e5e5', borderRadius:12, padding:16, ...style }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <span style={{ fontSize:13, fontWeight:500 }}>{title}</span>
        {meta && <span style={{ fontSize:12, color:'#888' }}>{meta}</span>}
      </div>
      {children}
    </div>
  );
}

function LiveBadge() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#1a5e3a', background:'#EAF3DE', padding:'4px 10px', borderRadius:20, fontWeight:500 }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:'#3B6D11', display:'inline-block', animation:'pulse 1.8s ease-in-out infinite' }} />
      Live
    </div>
  );
}

function ProgressRow({ label, value, max, color = C.green }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'0.5px solid #f0f0f0', fontSize:13 }}>
      <span style={{ flex:1, color:'#333' }}>{label}</span>
      <div style={{ width:80, height:4, background:'#f0f0f0', borderRadius:2, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:2 }} />
      </div>
      <span style={{ color:'#888', fontSize:12, width:32, textAlign:'right' }}>{pct}%</span>
    </div>
  );
}

function ErrorNote({ msg }) {
  return <p style={{ fontSize:12, color:'#A32D2D', padding:'8px 0' }}>⚠ {msg}</p>;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Listeners', 'Video', 'Visitors', 'Donations'];

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [unlocked, setUnlocked] = useState(!ADMIN_PIN);
  const [activeTab, setActiveTab] = useState('Overview');
  const [range, setRange] = useState(7);
  const [clock, setClock] = useState('');

  const azura    = useAzuraCast();
  const youtube  = useYouTubeAnalytics({ maxResults: 50 });
  const stripe   = useStripeDonations({ days: range });
  const analytics = useSiteAnalytics({ days: range });

  useEffect(() => {
    const iv = setInterval(() => {
      setClock(new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' }));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;

  const listeners  = azura.nowPlaying?.listeners ?? 0;
  const nowPlaying = azura.nowPlaying?.show      ?? 'Loading…';

  return (
    <div style={{ background:'#f5f5f3', minHeight:'100vh', fontFamily:'system-ui, sans-serif' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

      {/* Top bar */}
      <div style={{ background:'#fff', borderBottom:'0.5px solid #e5e5e5', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:28, height:28, background:'#1a5e3a', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L14 6V10L8 14L2 10V6L8 2Z" fill="white" opacity="0.9"/></svg>
          </div>
          <span style={{ fontSize:15, fontWeight:500 }}>TrueVoice Digital</span>
          <span style={{ fontSize:12, color:'#888' }}>Analytics</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <LiveBadge />
          <span style={{ fontSize:12, color:'#888' }}>{clock}</span>
        </div>
      </div>

      {/* Nav */}
      <div style={{ background:'#fff', borderBottom:'0.5px solid #e5e5e5', padding:'0 24px', display:'flex', gap:0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding:'12px 16px', fontSize:13, color: activeTab===t ? '#1a5e3a' : '#888', border:'none', borderBottom: activeTab===t ? '2px solid #1a5e3a' : '2px solid transparent', background:'transparent', cursor:'pointer', fontWeight: activeTab===t ? 500 : 400 }}>
            {t}
          </button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4 }}>
          {[7,30,90].map(d => (
            <button key={d} onClick={() => setRange(d)}
              style={{ fontSize:12, padding:'3px 10px', borderRadius:20, border: range===d ? 'none' : '0.5px solid #ccc', background: range===d ? '#1a5e3a' : 'transparent', color: range===d ? '#EAF3DE' : '#888', cursor:'pointer' }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:'20px 24px' }}>

        {/* ── OVERVIEW ─────────────────────────────────────────── */}
        {activeTab === 'Overview' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:12, marginBottom:20 }}>
              <MetricCard label="Live listeners" value={listeners} delta={azura.loading ? 'Loading…' : azura.error ?? undefined} deltaUp />
              <MetricCard label={`Visitors (${range}d)`} value={analytics.summary?.uniqueVisitors?.toLocaleString()} delta={analytics.loading ? 'Loading…' : undefined} deltaUp />
              <MetricCard label={`Video views (${range}d)`} value={youtube.totals.views?.toLocaleString()} delta={youtube.loading ? 'Loading…' : undefined} deltaUp />
              <MetricCard label={`Donations (${range}d)`} value={stripe.totals.grossDisplay} delta={`${stripe.totals.count} transactions`} deltaUp />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1.6fr) minmax(0,1fr)', gap:16, marginBottom:16 }}>
              <Panel title="Listener trend" meta={`${range}d`}>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={azura.chartData}>
                    <XAxis dataKey="label" tick={{ fontSize:11, fill:'#888' }} />
                    <YAxis tick={{ fontSize:11, fill:'#888' }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke={C.green} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Panel>
              <Panel title="Now live on stream" meta={<LiveBadge />}>
                {[
                  ['Current listeners', listeners],
                  ['Peak (session)',    azura.peakToday],
                  ['Now playing',      nowPlaying],
                  ['Avg listen (session)', `${Math.round(azura.history.length * 0.5)}m`],
                ].map(([l, v]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'0.5px solid #f0f0f0', fontSize:13 }}>
                    <span style={{ color:'#888' }}>{l}</span>
                    <span style={{ fontWeight:500, color: l==='Now playing' ? C.green : '#111' }}>{v}</span>
                  </div>
                ))}
                {azura.error && <ErrorNote msg={azura.error} />}
              </Panel>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:16 }}>
              <Panel title="Top shows by views" meta="YouTube">
                {youtube.loading && <p style={{ fontSize:13, color:'#888' }}>Loading…</p>}
                {youtube.error  && <ErrorNote msg={youtube.error} />}
                {youtube.shows.slice(0,5).map((s, i) => (
                  <ProgressRow key={s.slug} label={s.label} value={s.totalViews} max={youtube.shows[0]?.totalViews ?? 1} color={SHOW_COLORS[i]} />
                ))}
              </Panel>
              <Panel title="Recent donations" meta="Stripe">
                {stripe.loading && <p style={{ fontSize:13, color:'#888' }}>Loading…</p>}
                {stripe.error   && <ErrorNote msg={stripe.error} />}
                {stripe.donations.slice(0,6).map(d => (
                  <div key={d.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'0.5px solid #f0f0f0', fontSize:13 }}>
                    <div>
                      <p style={{ fontWeight:500, margin:0 }}>{d.donor_name ?? 'Anonymous'}</p>
                      <p style={{ fontSize:12, color:'#888', margin:0 }}>{d.time_ago}</p>
                    </div>
                    <span style={{ fontWeight:500, color:'#3B6D11' }}>{d.amount_display}</span>
                  </div>
                ))}
              </Panel>
            </div>
          </>
        )}

        {/* ── LISTENERS ────────────────────────────────────────── */}
        {activeTab === 'Listeners' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:12, marginBottom:20 }}>
              <MetricCard label="Active right now" value={listeners} deltaUp />
              <MetricCard label="Peak (session)"   value={azura.peakToday} />
              <MetricCard label="Data points"      value={azura.history.length} delta="30s intervals" />
              <MetricCard label="Now playing"      value={nowPlaying} />
            </div>
            {azura.error && <ErrorNote msg={azura.error} />}
            <Panel title="Listener count (live)" meta="Updates every 30s" style={{ marginBottom:16 }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={azura.chartData}>
                  <XAxis dataKey="label" tick={{ fontSize:11, fill:'#888' }} />
                  <YAxis tick={{ fontSize:11, fill:'#888' }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke={C.green} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Note on listener identity">
              <p style={{ fontSize:13, color:'#888', lineHeight:1.6 }}>
                AzuraCast provides aggregate listener counts, not individual user identities —
                this is standard for audio streaming (privacy by design). The count above reflects
                concurrent connections to your Live365 relay. For named listener data,
                you would need an authenticated "Listen Now" sign-in flow.
              </p>
            </Panel>
          </>
        )}

        {/* ── VIDEO ────────────────────────────────────────────── */}
        {activeTab === 'Video' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:12, marginBottom:20 }}>
              <MetricCard label="Total views"    value={youtube.totals.views?.toLocaleString()} />
              <MetricCard label="Total likes"    value={youtube.totals.likes?.toLocaleString()} />
              <MetricCard label="Videos tracked" value={youtube.totals.videoCount} />
              <MetricCard label="Shows" value={youtube.shows.length} />
            </div>
            {youtube.error && <ErrorNote msg={youtube.error} />}
            <Panel title="Views by show" meta="YouTube Data API v3" style={{ marginBottom:16 }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={youtube.shows.slice(0,6).map((s,i) => ({ name: s.label, views: s.totalViews, fill: SHOW_COLORS[i] }))}>
                  <XAxis dataKey="name" tick={{ fontSize:11, fill:'#888' }} />
                  <YAxis tick={{ fontSize:11, fill:'#888' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip />
                  <Bar dataKey="views" radius={[4,4,0,0]}>
                    {youtube.shows.slice(0,6).map((_, i) => (
                      <Cell key={i} fill={SHOW_COLORS[i % SHOW_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Show breakdown">
              <table style={{ width:'100%', fontSize:13, borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ borderBottom:'0.5px solid #f0f0f0' }}>
                    {['Show','Videos','Total views','Likes'].map(h => (
                      <th key={h} style={{ textAlign: h==='Show' ? 'left' : 'right', padding:'8px', fontSize:12, color:'#888', fontWeight:500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {youtube.shows.map(s => (
                    <tr key={s.slug} style={{ borderBottom:'0.5px solid #f0f0f0' }}>
                      <td style={{ padding:'10px 8px', fontWeight:500 }}>{s.label}</td>
                      <td style={{ textAlign:'right', padding:'10px 8px', color:'#888' }}>{s.videos.length}</td>
                      <td style={{ textAlign:'right', padding:'10px 8px' }}>{s.totalViews.toLocaleString()}</td>
                      <td style={{ textAlign:'right', padding:'10px 8px', color:'#888' }}>{s.totalLikes.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </>
        )}

        {/* ── VISITORS ─────────────────────────────────────────── */}
        {activeTab === 'Visitors' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:12, marginBottom:20 }}>
              <MetricCard label="Active now"        value={analytics.activeNow} />
              <MetricCard label="Unique visitors"   value={analytics.summary?.uniqueVisitors?.toLocaleString()} />
              <MetricCard label="Page views"        value={analytics.summary?.pageviews?.toLocaleString()} />
              <MetricCard label="Stream plays"      value={analytics.summary?.streamPlays?.toLocaleString()} deltaUp />
            </div>
            {analytics.error && <ErrorNote msg={analytics.error} />}
            <Panel title="Daily visitors" style={{ marginBottom:16 }}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={analytics.dailyChart}>
                  <XAxis dataKey="label" tick={{ fontSize:11, fill:'#888' }} />
                  <YAxis tick={{ fontSize:11, fill:'#888' }} />
                  <Tooltip />
                  <Bar dataKey="visitors" fill={C.blue} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:16 }}>
              <Panel title="Top pages">
                {analytics.topPages.map(p => (
                  <div key={p.path} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'0.5px solid #f0f0f0', fontSize:13 }}>
                    <code style={{ color:'#333', fontSize:12 }}>{p.path}</code>
                    <span style={{ color:'#888' }}>{p.count.toLocaleString()}</span>
                  </div>
                ))}
              </Panel>
              <Panel title="Traffic sources">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={analytics.sources} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={38}>
                      {analytics.sources.map((_, i) => (
                        <Cell key={i} fill={[C.green, C.blue, C.amber, C.gray][i]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display:'flex', flexWrap:'wrap', gap:12, fontSize:12, color:'#888' }}>
                  {analytics.sources.map((s, i) => (
                    <span key={s.label} style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ width:10, height:10, borderRadius:2, background:[C.green,C.blue,C.amber,C.gray][i], display:'inline-block' }} />
                      {s.label} {s.pct}%
                    </span>
                  ))}
                </div>
              </Panel>
            </div>
          </>
        )}

        {/* ── DONATIONS ────────────────────────────────────────── */}
        {activeTab === 'Donations' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:12, marginBottom:20 }}>
              <MetricCard label={`Gross (${range}d)`}    value={stripe.totals.grossDisplay}   delta={`${stripe.totals.count} transactions`} deltaUp />
              <MetricCard label="Net received"            value={stripe.totals.netDisplay}     delta="After Stripe fees" deltaUp />
              <MetricCard label="Average donation"        value={stripe.totals.averageDisplay} deltaUp />
              <MetricCard label="Recurring"               value={stripe.totals.recurringDisplay} delta="Monthly subscriptions" deltaUp />
            </div>
            {stripe.error && <ErrorNote msg={stripe.error} />}
            <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1.6fr) minmax(0,1fr)', gap:16, marginBottom:16 }}>
              <Panel title={`Daily donations (${range}d)`} meta="Stripe">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stripe.dailyChart}>
                    <XAxis dataKey="label" tick={{ fontSize:10, fill:'#888' }} interval={Math.floor(stripe.dailyChart.length/6)} />
                    <YAxis tick={{ fontSize:11, fill:'#888' }} tickFormatter={v => `$${v}`} />
                    <Tooltip formatter={v => [`$${v.toFixed(2)}`, 'Amount']} />
                    <Bar dataKey="value" fill={C.green} radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
              <Panel title="Breakdown">
                {[
                  ['One-time',  stripe.totals.oneTimeDisplay],
                  ['Recurring', stripe.totals.recurringDisplay],
                  ['Fees',      stripe.totals.feesDisplay, true],
                  ['Net',       stripe.totals.netDisplay, false, true],
                ].map(([l, v, isNeg, isBig]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'0.5px solid #f0f0f0', fontSize:13, borderTop: isBig ? '1px solid #e0e0e0' : undefined, marginTop: isBig ? 4 : undefined }}>
                    <span style={{ color: isBig ? '#111' : '#888', fontWeight: isBig ? 500 : 400 }}>{l}</span>
                    <span style={{ fontWeight:500, color: isNeg ? '#A32D2D' : isBig ? '#3B6D11' : '#111' }}>{isNeg ? '-' : ''}{v}</span>
                  </div>
                ))}
              </Panel>
            </div>
            <Panel title="Transaction log" meta="Stripe webhook">
              <table style={{ width:'100%', fontSize:13, borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ borderBottom:'0.5px solid #f0f0f0' }}>
                    {['Donor','Type','Amount','Time'].map(h => (
                      <th key={h} style={{ textAlign: h==='Amount'||h==='Time' ? 'right' : 'left', padding:'8px', fontSize:12, color:'#888', fontWeight:500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stripe.donations.map(d => (
                    <tr key={d.id} style={{ borderBottom:'0.5px solid #f0f0f0' }}>
                      <td style={{ padding:'9px 8px', fontWeight:500 }}>{d.donor_name ?? 'Anonymous'}</td>
                      <td style={{ padding:'9px 8px' }}>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background: d.type==='recurring' ? '#E1F5EE' : '#E6F1FB', color: d.type==='recurring' ? '#0F6E56' : '#185FA5' }}>
                          {d.type === 'recurring' ? 'Recurring' : 'One-time'}
                        </span>
                      </td>
                      <td style={{ textAlign:'right', padding:'9px 8px', fontWeight:500, color:'#3B6D11' }}>{d.amount_display}</td>
                      <td style={{ textAlign:'right', padding:'9px 8px', color:'#888', fontSize:12 }}>{d.time_ago}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}
