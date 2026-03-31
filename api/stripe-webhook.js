/**
 * Stripe Webhook Handler — /api/stripe-webhook.js
 *
 * Deploy as a Vercel serverless function (already on Vercel).
 * Place this file at: /api/stripe-webhook.js
 *
 * 1. In your Stripe dashboard → Developers → Webhooks, add endpoint:
 *      https://yourdomain.com/api/stripe-webhook
 *    Listen for: payment_intent.succeeded, customer.subscription.created,
 *                customer.subscription.updated, charge.refunded
 *
 * 2. Copy the webhook signing secret into your Vercel env vars:
 *      STRIPE_SECRET_KEY        (your existing Stripe secret)
 *      STRIPE_WEBHOOK_SECRET    (from Stripe webhook dashboard)
 *      SUPABASE_URL             (server-side, not VITE_ prefixed)
 *      SUPABASE_SERVICE_KEY     (service role key — NOT anon key)
 *
 * SQL to run in Supabase (once):
 * ─────────────────────────────────────────────────────────────────
 *   create table if not exists donations (
 *     id                      uuid primary key default gen_random_uuid(),
 *     stripe_payment_intent_id text unique,
 *     stripe_customer_id      text,
 *     amount_cents            integer not null,
 *     currency                text default 'usd',
 *     donor_name              text,
 *     donor_email             text,
 *     type                    text default 'one_time',  -- 'one_time' | 'recurring'
 *     status                  text default 'succeeded',
 *     stripe_event_id         text,
 *     metadata                jsonb,
 *     created_at              timestamptz default now()
 *   );
 *   alter table donations enable row level security;
 *   create policy "Service role full access" on donations
 *     using (true) with check (true);
 * ─────────────────────────────────────────────────────────────────
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
    req.on('end',   () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const rawBody = await getRawBody(req);
  const sig     = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe signature verification failed:', err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  try {
    switch (event.type) {

      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        // Try to get customer name/email from the charge
        const charges = await stripe.charges.list({ payment_intent: pi.id, limit: 1 });
        const charge  = charges.data[0];
        const isRecurring = !!pi.invoice; // invoices = subscription charges

        await supabase.from('donations').upsert({
          stripe_payment_intent_id: pi.id,
          stripe_customer_id:       pi.customer ?? null,
          amount_cents:             pi.amount_received,
          currency:                 pi.currency,
          donor_name:               charge?.billing_details?.name  ?? pi.metadata?.donor_name ?? null,
          donor_email:              charge?.billing_details?.email  ?? pi.metadata?.donor_email ?? null,
          type:                     isRecurring ? 'recurring' : 'one_time',
          status:                   'succeeded',
          stripe_event_id:          event.id,
          metadata:                 pi.metadata ?? {},
          created_at:               new Date(pi.created * 1000).toISOString(),
        }, { onConflict: 'stripe_payment_intent_id' });
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        await supabase
          .from('donations')
          .update({ status: 'refunded' })
          .eq('stripe_payment_intent_id', charge.payment_intent);
        break;
      }

      default:
        // Ignore other events
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: err.message });
  }
}
