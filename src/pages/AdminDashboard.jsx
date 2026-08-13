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
 * Gated by Supabase Auth (email/password) — after sign-in, the user's
 * email must also exist in the admin_users table (see
 * supabase/migrations/*_admin_users.sql) or they're shown "Not authorized".
 * Team members can be invited from the Team tab, which calls
 * api/admin-invite.js.
 *
 * Install deps if not already present:
 *   npm install recharts
 */

import { useState, useEffect, useMemo } from 'react';
import './AdminDashboard.css';
import { readAllVisits } from '../lib/visitorStore';
import { supabase } from '../lib/supabaseClient';
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { useAzuraCast }       from '../hooks/useAzuraCast';
import { useYouTubeAnalytics } from '../hooks/useYouTubeAnalytics';
import { useStripeDonations }  from '../hooks/useStripeDonations';
import { useSiteAnalytics }    from '../hooks/useSiteAnalytics';

// ─── Palette (for Recharts props — component config, not DOM styles, so it
// can't move to CSS; kept in sync with the custom properties in
// AdminDashboard.css) ──────────────────────────────────────────────────────

const C = {
  border:       'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  accent:       '#3a6cff',
  text:         '#f5f7ff',
  textMuted:    '#8b96c2',
};
const SHOW_COLORS = ['#3a6cff', '#22d3ee', '#fbbf24', '#f472b6', '#a78bfa'];

const CHART_AXIS_TICK = { fontSize: 11, fill: C.textMuted };
const CHART_TOOLTIP_CONTENT = {
  contentStyle: { background: '#0e1b3a', border: `1px solid ${C.borderStrong}`, borderRadius: 8, fontSize: 12, color: C.text },
  labelStyle:   { color: C.textMuted },
  itemStyle:    { color: C.text },
};

// ─── Auth gate ────────────────────────────────────────────────────────────────

function AuthCard({ children }) {
  return (
    <div className="admin-auth-wrap">
      <div className="admin-auth-card">
        <div className="admin-auth-icon">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M8 2L14 6V10L8 14L2 10V6L8 2Z" fill="white" opacity="0.9"/></svg>
        </div>
        {children}
      </div>
    </div>
  );
}

function SignInGate() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr]           = useState('');
  const [loading, setLoading]   = useState(false);

  const submit = async () => {
    setErr('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setErr(error.message);
    // On success, the onAuthStateChange listener in AdminDashboard updates session.
  };

  return (
    <AuthCard>
      <p className="admin-auth-title">TrueVoice Admin</p>
      <p className="admin-auth-subtitle">Sign in with your team email</p>
      <input
        type="email"
        value={email}
        onChange={e => { setEmail(e.target.value); setErr(''); }}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="Email"
        className={`admin-input${err ? ' admin-input--error' : ''}`}
        autoFocus
      />
      <input
        type="password"
        value={password}
        onChange={e => { setPassword(e.target.value); setErr(''); }}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="Password"
        className={`admin-input admin-input--last${err ? ' admin-input--error' : ''}`}
      />
      {err && <p className="admin-error-text">{err}</p>}
      <button onClick={submit} disabled={loading} className="admin-btn-primary">
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </AuthCard>
  );
}

function SetPasswordGate({ onDone }) {
  const [password, setPassword] = useState('');
  const [err, setErr]           = useState('');
  const [loading, setLoading]   = useState(false);

  const submit = async () => {
    setErr('');
    if (password.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    onDone();
  };

  return (
    <AuthCard>
      <p className="admin-auth-title">Set a new password</p>
      <p className="admin-auth-subtitle">Choose a password for your TrueVoice admin account.</p>
      <input
        type="password"
        value={password}
        onChange={e => { setPassword(e.target.value); setErr(''); }}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="New password"
        className={`admin-input admin-input--last${err ? ' admin-input--error' : ''}`}
        autoFocus
      />
      {err && <p className="admin-error-text">{err}</p>}
      <button onClick={submit} disabled={loading} className="admin-btn-primary">
        {loading ? 'Saving…' : 'Save password'}
      </button>
    </AuthCard>
  );
}

function LoadingGate() {
  return (
    <AuthCard>
      <p className="admin-muted-text">Loading…</p>
    </AuthCard>
  );
}

function NotAuthorizedGate({ email }) {
  return (
    <AuthCard>
      <p className="admin-auth-title">Not authorized</p>
      <p className="admin-auth-subtitle">
        {email} is signed in but isn't on the TrueVoice admin team. Ask an
        existing admin to invite you.
      </p>
      <button onClick={() => supabase.auth.signOut()} className="admin-btn-primary">
        Sign out
      </button>
    </AuthCard>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, delta, deltaUp }) {
  return (
    <div className="admin-metric-card">
      <p className="admin-metric-label">{label}</p>
      <p className="admin-metric-value">{value ?? '—'}</p>
      {delta && (
        <p className={`admin-metric-delta ${deltaUp ? 'admin-metric-delta--up' : 'admin-metric-delta--down'}`}>{delta}</p>
      )}
    </div>
  );
}

function Panel({ title, meta, children, className = '' }) {
  return (
    <div className={`admin-panel ${className}`.trim()}>
      <div className="admin-panel-header">
        <span className="admin-panel-title">{title}</span>
        {meta && <span className="admin-panel-meta">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

function LiveBadge() {
  return (
    <div className="admin-live-badge">
      <span className="admin-live-dot" />
      Live
    </div>
  );
}

function ProgressRow({ label, value, max, color = C.accent }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="admin-progress-row">
      <span className="admin-progress-label">{label}</span>
      <div className="admin-progress-track">
        <div className="admin-progress-fill" style={{ width:`${pct}%`, background:color }} />
      </div>
      <span className="admin-progress-pct">{pct}%</span>
    </div>
  );
}

function ErrorNote({ msg }) {
  return <p className="admin-error-note">⚠ {msg}</p>;
}

function VisitorsTab({ range }) {
  const [visits, setVisits]   = useState(null);
  const [error,  setError]    = useState(null);

  useEffect(() => {
    let cancelled = false;
    setVisits(null);
    setError(null);
    readAllVisits(range)
      .then(rows => {
        if (cancelled) return;
        if (!Array.isArray(rows)) {
          setError('Unexpected response from page_visits');
          setVisits([]);
        } else {
          setVisits(rows);
        }
      })
      .catch(e => {
        if (cancelled) return;
        setError(e?.message || 'Failed to load visits');
        setVisits([]);
      });
    return () => { cancelled = true; };
  }, [range]);

  const data = useMemo(() => {
    if (!visits) return null;
    const now = Date.now();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    const todayCount = visits.reduce((n, v) => {
      const t = Date.parse(v.visited_at);
      return Number.isFinite(t) && t >= todayStart.getTime() ? n + 1 : n;
    }, 0);

    const buckets = {};
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now - i * 86_400_000);
      d.setHours(0, 0, 0, 0);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    visits.forEach(v => {
      const key = (v.visited_at || '').slice(0, 10);
      if (key in buckets) buckets[key]++;
    });
    const labelFmt = range <= 7
      ? { weekday: 'short' }
      : { month: 'numeric', day: 'numeric' };
    const dailyChart = Object.entries(buckets).map(([date, count]) => ({
      label: new Date(date + 'T00:00:00').toLocaleDateString('en-US', labelFmt),
      visits: count,
    }));

    const pathCounts = {};
    visits.forEach(v => {
      const p = v.path || '/';
      pathCounts[p] = (pathCounts[p] ?? 0) + 1;
    });
    const topPaths = Object.entries(pathCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, count]) => ({ path, count }));

    return { total: visits.length, today: todayCount, dailyChart, topPaths };
  }, [visits, range]);

  if (!data) {
    return <p className="admin-muted-text">Loading visits…</p>;
  }

  return (
    <>
      <div className="admin-metric-grid">
        <MetricCard label={`Total visits (${range}d)`} value={data.total.toLocaleString()} />
        <MetricCard label="Visits today"               value={data.today.toLocaleString()} />
      </div>
      {error && <ErrorNote msg={error} />}
      <Panel title={`Visits per day (${range}d)`} className="admin-panel--mb">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.dailyChart}>
            <XAxis dataKey="label" stroke={C.border} tick={CHART_AXIS_TICK} interval={Math.max(0, Math.floor(data.dailyChart.length / 10))} />
            <YAxis stroke={C.border} tick={CHART_AXIS_TICK} allowDecimals={false} />
            <Tooltip {...CHART_TOOLTIP_CONTENT} cursor={{ fill:'rgba(255,255,255,0.05)' }} />
            <Bar dataKey="visits" fill={C.accent} radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="Top pages">
        {data.topPaths.length === 0 && <p className="admin-muted-text">No visits recorded yet.</p>}
        {data.topPaths.map(p => (
          <div key={p.path} className="admin-list-row admin-list-row--p7">
            <code className="admin-code">{p.path}</code>
            <span className="admin-td-muted">{p.count.toLocaleString()}</span>
          </div>
        ))}
      </Panel>
    </>
  );
}

function TeamTab({ session }) {
  const [admins, setAdmins]           = useState(null);
  const [error, setError]             = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState(null); // null | 'sending' | 'sent' | <error message>

  const load = () => {
    fetch('/api/admin-team', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(body => {
        if (body.error) setError(body.error);
        else { setAdmins(body.admins); setError(null); }
      })
      .catch(e => setError(e.message));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const invite = async () => {
    if (!inviteEmail) return;
    setInviteStatus('sending');
    try {
      const res  = await fetch('/api/admin-invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ email: inviteEmail }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Invite failed');
      setInviteStatus('sent');
      setInviteEmail('');
      load();
    } catch (e) {
      setInviteStatus(e.message);
    }
  };

  return (
    <>
      <Panel title="Invite teammate" className="admin-panel--mb">
        <div className="admin-invite-row">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => { setInviteEmail(e.target.value); setInviteStatus(null); }}
            placeholder="teammate@email.com"
            className="admin-invite-input"
          />
          <button onClick={invite} disabled={inviteStatus === 'sending'} className="admin-btn-invite">
            {inviteStatus === 'sending' ? 'Sending…' : 'Send invite'}
          </button>
        </div>
        {inviteStatus === 'sent' && <p className="admin-invite-success">Invite sent.</p>}
        {inviteStatus && inviteStatus !== 'sending' && inviteStatus !== 'sent' && <ErrorNote msg={inviteStatus} />}
      </Panel>
      <Panel title="Team" meta={admins ? `${admins.length} admin${admins.length === 1 ? '' : 's'}` : undefined}>
        {error && <ErrorNote msg={error} />}
        {!admins && !error && <p className="admin-muted-text">Loading…</p>}
        {admins?.map(a => (
          <div key={a.email} className="admin-list-row admin-list-row--p9 admin-list-row--hover">
            <div>
              <p className="admin-row-title">{a.email}</p>
              <p className="admin-row-subtitle">{a.role}{a.invited_by ? ` · invited by ${a.invited_by}` : ''}</p>
            </div>
            <span className="admin-row-trailing">{new Date(a.created_at).toLocaleDateString()}</span>
          </div>
        ))}
      </Panel>
    </>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Listeners', 'Video', 'Visitors', 'Donations', 'Team'];

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [session, setSession]   = useState(undefined); // undefined = checking, null = signed out
  const [adminRow, setAdminRow] = useState(undefined); // undefined = checking, null = not an admin
  const [recoveryMode, setRecoveryMode] = useState(() => window.location.hash.includes('type=recovery'));
  const [activeTab, setActiveTab] = useState('Overview');
  const [range, setRange] = useState(7);
  const [clock, setClock] = useState('');

  const azura    = useAzuraCast();
  const youtube  = useYouTubeAnalytics({ maxResults: 50 });
  const stripe   = useStripeDonations({ days: range });
  const analytics = useSiteAnalytics({ days: range });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      setSession(sess ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) { setAdminRow(null); return; }
    let cancelled = false;
    setAdminRow(undefined);
    supabase
      .from('admin_users')
      .select('email, role')
      .eq('email', session.user.email)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setAdminRow(data ?? null); });
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    const iv = setInterval(() => {
      setClock(new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' }));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  if (recoveryMode) return <SetPasswordGate onDone={() => setRecoveryMode(false)} />;
  if (session === undefined || (session && adminRow === undefined)) return <LoadingGate />;
  if (!session) return <SignInGate />;
  if (!adminRow) return <NotAuthorizedGate email={session.user.email} />;

  const listeners  = azura.nowPlaying?.listeners ?? 0;
  const nowPlaying = azura.nowPlaying?.show      ?? 'Loading…';

  return (
    <div className="admin-page">

      {/* Top bar */}
      <div className="admin-topbar">
        <div className="admin-topbar-left">
          <div className="admin-topbar-logo">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L14 6V10L8 14L2 10V6L8 2Z" fill="white" opacity="0.9"/></svg>
          </div>
          <span className="admin-topbar-title">TrueVoice Digital</span>
          <span className="admin-topbar-sub">Analytics</span>
        </div>
        <div className="admin-topbar-right">
          <LiveBadge />
          <span className="admin-topbar-clock">{clock}</span>
          <span className="admin-topbar-divider">|</span>
          <span className="admin-topbar-email">{session.user.email}</span>
          <button onClick={() => supabase.auth.signOut()} className="admin-signout">
            Sign out
          </button>
        </div>
      </div>

      {/* Nav */}
      <div className="admin-nav">
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`admin-tab${activeTab===t ? ' admin-tab--active' : ''}`}>
            {t}
          </button>
        ))}
        <div className="admin-nav-ranges">
          {[7,30,90].map(d => (
            <button key={d} onClick={() => setRange(d)}
              className={`admin-range-btn${range===d ? ' admin-range-btn--active' : ''}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="admin-content">

        {/* ── OVERVIEW ─────────────────────────────────────────── */}
        {activeTab === 'Overview' && (
          <>
            <div className="admin-metric-grid">
              <MetricCard label="Live listeners" value={listeners} delta={azura.loading ? 'Loading…' : azura.error ?? undefined} deltaUp />
              <MetricCard label={`Visitors (${range}d)`} value={analytics.summary?.uniqueVisitors?.toLocaleString()} delta={analytics.loading ? 'Loading…' : undefined} deltaUp />
              <MetricCard label={`Video views (${range}d)`} value={youtube.totals.views?.toLocaleString()} delta={youtube.loading ? 'Loading…' : undefined} deltaUp />
              <MetricCard label={`Donations (${range}d)`} value={stripe.totals.grossDisplay} delta={`${stripe.totals.count} transactions`} deltaUp />
            </div>

            <div className="admin-grid-main">
              <Panel title="Listener trend" meta={`${range}d`}>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={azura.chartData}>
                    <XAxis dataKey="label" stroke={C.border} tick={CHART_AXIS_TICK} />
                    <YAxis stroke={C.border} tick={CHART_AXIS_TICK} />
                    <Tooltip {...CHART_TOOLTIP_CONTENT} cursor={{ stroke:C.borderStrong }} />
                    <Line type="monotone" dataKey="value" stroke={C.accent} strokeWidth={2} dot={false} />
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
                  <div key={l} className="admin-list-row admin-list-row--p9">
                    <span className="admin-list-row-label">{l}</span>
                    <span className={`admin-list-row-value${l==='Now playing' ? ' admin-list-row-value--accent' : ''}`}>{v}</span>
                  </div>
                ))}
                {azura.error && <ErrorNote msg={azura.error} />}
              </Panel>
            </div>

            <div className="admin-grid-even">
              <Panel title="Top shows by views" meta="YouTube">
                {youtube.loading && <p className="admin-muted-text">Loading…</p>}
                {youtube.error  && <ErrorNote msg={youtube.error} />}
                {youtube.shows.slice(0,5).map((s, i) => (
                  <ProgressRow key={s.slug} label={s.label} value={s.totalViews} max={youtube.shows[0]?.totalViews ?? 1} color={SHOW_COLORS[i]} />
                ))}
              </Panel>
              <Panel title="Recent donations" meta="Stripe">
                {stripe.loading && <p className="admin-muted-text">Loading…</p>}
                {stripe.error   && <ErrorNote msg={stripe.error} />}
                {stripe.donations.slice(0,6).map(d => (
                  <div key={d.id} className="admin-list-row admin-list-row--p8 admin-list-row--hover">
                    <div>
                      <p className="admin-row-title">{d.donor_name ?? 'Anonymous'}</p>
                      <p className="admin-row-subtitle">{d.time_ago}</p>
                    </div>
                    <span className="admin-list-row-value admin-list-row-value--positive">{d.amount_display}</span>
                  </div>
                ))}
              </Panel>
            </div>
          </>
        )}

        {/* ── LISTENERS ────────────────────────────────────────── */}
        {activeTab === 'Listeners' && (
          <>
            <div className="admin-metric-grid">
              <MetricCard label="Current listeners" value={azura.nowPlaying?.listeners} delta={azura.loading ? 'Loading…' : azura.error ?? undefined} deltaUp />
              <MetricCard label="Peak (session)" value={azura.peakToday} deltaUp />
              <MetricCard label="Unique listeners (session)" value={azura.nowPlaying?.listenersUnique} deltaUp />
              <MetricCard label="Now playing" value={azura.nowPlaying?.show ?? 'Loading…'} delta={azura.nowPlaying?.artist ?? undefined} deltaUp />
            </div>
            <Panel title="Listener trend" meta={<LiveBadge />}>
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={azura.chartData}>
                  <XAxis dataKey="label" stroke={C.border} tick={CHART_AXIS_TICK} />
                  <YAxis stroke={C.border} tick={CHART_AXIS_TICK} />
                  <Tooltip {...CHART_TOOLTIP_CONTENT} cursor={{ stroke:C.borderStrong }} />
                  <Line type="monotone" dataKey="value" stroke={C.accent} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              {azura.error && <ErrorNote msg={azura.error} />}
            </Panel>
          </>
        )}

        {/* ── VIDEO ────────────────────────────────────────────── */}
        {activeTab === 'Video' && (
          <>
            <div className="admin-metric-grid">
              <MetricCard label="Total views"    value={youtube.totals.views?.toLocaleString()} />
              <MetricCard label="Total likes"    value={youtube.totals.likes?.toLocaleString()} />
              <MetricCard label="Videos tracked" value={youtube.totals.videoCount} />
              <MetricCard label="Shows" value={youtube.shows.length} />
            </div>
            {youtube.error && <ErrorNote msg={youtube.error} />}
            <Panel title="Views by show" meta="YouTube Data API v3" className="admin-panel--mb">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={youtube.shows.slice(0,6).map((s,i) => ({ name: s.label, views: s.totalViews, fill: SHOW_COLORS[i] }))}>
                  <XAxis dataKey="name" stroke={C.border} tick={CHART_AXIS_TICK} />
                  <YAxis stroke={C.border} tick={CHART_AXIS_TICK} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip {...CHART_TOOLTIP_CONTENT} cursor={{ fill:'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey="views" radius={[4,4,0,0]}>
                    {youtube.shows.slice(0,6).map((_, i) => (
                      <Cell key={i} fill={SHOW_COLORS[i % SHOW_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Show breakdown">
              <table className="admin-table admin-table--pad10">
                <thead>
                  <tr>
                    {['Show','Videos','Total views','Likes'].map(h => (
                      <th key={h} className={h==='Show' ? 'admin-ta-left' : 'admin-ta-right'}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {youtube.shows.map(s => (
                    <tr key={s.slug}>
                      <td className="admin-td-strong">{s.label}</td>
                      <td className="admin-ta-right admin-td-muted">{s.videos.length}</td>
                      <td className="admin-ta-right">{s.totalViews.toLocaleString()}</td>
                      <td className="admin-ta-right admin-td-muted">{s.totalLikes.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </>
        )}

        {/* ── VISITORS ─────────────────────────────────────────── */}
        {activeTab === 'Visitors' && <VisitorsTab range={range} />}

        {/* ── TEAM ─────────────────────────────────────────────── */}
        {activeTab === 'Team' && <TeamTab session={session} />}

        {/* ── DONATIONS ────────────────────────────────────────── */}
        {activeTab === 'Donations' && (
          <>
            <div className="admin-metric-grid">
              <MetricCard label={`Gross (${range}d)`}    value={stripe.totals.grossDisplay}   delta={`${stripe.totals.count} transactions`} deltaUp />
              <MetricCard label="Net received"            value={stripe.totals.netDisplay}     delta="After Stripe fees" deltaUp />
              <MetricCard label="Average donation"        value={stripe.totals.averageDisplay} deltaUp />
              <MetricCard label="Recurring"               value={stripe.totals.recurringDisplay} delta="Monthly subscriptions" deltaUp />
            </div>
            {stripe.error && <ErrorNote msg={stripe.error} />}
            <div className="admin-grid-main">
              <Panel title={`Daily donations (${range}d)`} meta="Stripe" className="admin-panel--mb">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stripe.dailyChart}>
                    <XAxis dataKey="label" stroke={C.border} tick={{ fontSize:10, fill:C.textMuted }} interval={Math.floor(stripe.dailyChart.length/6)} />
                    <YAxis stroke={C.border} tick={CHART_AXIS_TICK} tickFormatter={v => `$${v}`} />
                    <Tooltip {...CHART_TOOLTIP_CONTENT} cursor={{ fill:'rgba(255,255,255,0.05)' }} formatter={v => [`$${v.toFixed(2)}`, 'Amount']} />
                    <Bar dataKey="value" fill={C.accent} radius={[3,3,0,0]} />
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
                  <div key={l} className={`admin-breakdown-row${isBig ? ' admin-breakdown-row--big' : ''}`}>
                    <span className={isBig ? 'admin-breakdown-label--big' : 'admin-breakdown-label'}>{l}</span>
                    <span className={`admin-breakdown-value${isNeg ? ' admin-breakdown-value--neg' : isBig ? ' admin-breakdown-value--pos' : ''}`}>{isNeg ? '-' : ''}{v}</span>
                  </div>
                ))}
              </Panel>
            </div>
            <Panel title="Transaction log" meta="Stripe webhook">
              <table className="admin-table admin-table--pad9 admin-table--hover">
                <thead>
                  <tr>
                    {['Donor','Type','Amount','Time'].map(h => (
                      <th key={h} className={h==='Amount'||h==='Time' ? 'admin-ta-right' : 'admin-ta-left'}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stripe.donations.map(d => (
                    <tr key={d.id}>
                      <td className="admin-td-strong">{d.donor_name ?? 'Anonymous'}</td>
                      <td>
                        <span className={`admin-type-pill ${d.type==='recurring' ? 'admin-type-pill--recurring' : 'admin-type-pill--onetime'}`}>
                          {d.type === 'recurring' ? 'Recurring' : 'One-time'}
                        </span>
                      </td>
                      <td className="admin-ta-right admin-td-amount">{d.amount_display}</td>
                      <td className="admin-ta-right admin-td-time">{d.time_ago}</td>
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
