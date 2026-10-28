/**
 * useStripeDonations — TrueVoice donation data
 *
 * Reads authorized, paginated donation data through /api/admin-metrics.
 * The existing Stripe webhook populates the unchanged donations table.
 *
 * Usage:
 *   const { donations, totals, loading, error } = useStripeDonations({ days: 30 })
 *
 * Env vars required (already in your CrestPoint/TrueVoice setup):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *
 * Supabase table schema (run the SQL in /api/stripe-webhook.js to create it):
 *   donations (id, stripe_payment_intent_id, amount_cents, currency,
 *              donor_name, donor_email, type, status, created_at)
 */

import { useAdminRows } from './useAdminRows';

function centsToDisplay(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function useStripeDonations({ days = 30, token } = {}) {
  const state = useAdminRows('donations', days, token);
  const data = state.rows;
  const invalid = data?.some(d => d.currency !== 'usd' || !Number.isFinite(d.amount_cents));
  if (!data || invalid) return { donations: [], totals: {}, dailyChart: [], loading: state.loading,
    error: invalid ? 'Donation totals unavailable: currency or amount requires review.' : state.error };
  // Stripe processing fee estimate: 2.9% + $0.30
  const withFees = (data ?? []).map(d => ({
    ...d,
    amount_display: centsToDisplay(d.amount_cents),
    fee_cents:      Math.round(d.amount_cents * 0.029 + 30),
    net_cents:      Math.round(d.amount_cents - (d.amount_cents * 0.029 + 30)),
    time_ago:       timeAgo(d.created_at),
  }));

  const gross        = withFees.reduce((s, d) => s + d.amount_cents, 0);
  const fees         = withFees.reduce((s, d) => s + d.fee_cents, 0);
  const recurringAmt = withFees.filter(d => d.type === 'recurring').reduce((s, d) => s + d.amount_cents, 0);
  const oneTimeAmt   = withFees.filter(d => d.type === 'one_time').reduce((s, d) => s + d.amount_cents, 0);

  const totals = {
    gross,
    net:          gross - fees,
    fees,
    count:        withFees.length,
    recurring:    recurringAmt,
    oneTime:      oneTimeAmt,
    averageCents: withFees.length ? Math.round(gross / withFees.length) : 0,
    grossDisplay:     centsToDisplay(gross),
    netDisplay:       centsToDisplay(gross - fees),
    feesDisplay:      centsToDisplay(fees),
    recurringDisplay: centsToDisplay(recurringAmt),
    oneTimeDisplay:   centsToDisplay(oneTimeAmt),
    averageDisplay:   centsToDisplay(withFees.length ? Math.round(gross / withFees.length) : 0),
  };
  return { donations: withFees, totals, dailyChart: buildDailyChart(withFees, days), loading: false, error: null };
}

function buildDailyChart(donations, days) {
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const d  = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = 0;
  }
  donations.forEach(d => {
    const key = d.created_at.slice(0, 10);
    if (key in buckets) buckets[key] += d.amount_cents;
  });
  return Object.entries(buckets).map(([date, cents]) => ({
    label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: cents / 100,
  }));
}

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}
