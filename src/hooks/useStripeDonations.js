/**
 * useStripeDonations — TrueVoice donation data
 *
 * Reads donation events from a Supabase table (`donations`) that is
 * populated by the Stripe webhook (see /api/stripe-webhook.js).
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

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

function centsToDisplay(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function useStripeDonations({ days = 30 } = {}) {
  const [donations, setDonations] = useState([]);
  const [totals,    setTotals]    = useState({
    gross:        0,
    net:          0,
    count:        0,
    recurring:    0,
    oneTime:      0,
    averageCents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchDonations = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data, error: sbErr } = await supabase
      .from('donations')
      .select('*')
      .eq('status', 'succeeded')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (sbErr) {
      setError(sbErr.message);
      setLoading(false);
      return;
    }

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

    setDonations(withFees);
    setTotals({
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
    });
    setError(null);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    fetchDonations();

    // Realtime: re-fetch when a new donation row is inserted
    const channel = supabase
      .channel('donations-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'donations' }, fetchDonations)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchDonations]);

  // Daily totals for a bar chart — last `days` days
  const dailyChart = buildDailyChart(donations, days);

  return { donations, totals, dailyChart, loading, error, refetch: fetchDonations };
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
