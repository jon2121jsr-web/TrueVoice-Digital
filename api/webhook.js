import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function createPrintfulOrder(session) {
  const { printful_variant_id, product_name, size } = session.metadata;
  const shipping = session.shipping_details?.address;

  if (!shipping) {
    console.error('No shipping address in session');
    return;
  }

  const order = {
    recipient: {
      name: session.shipping_details.name,
      address1: shipping.line1,
      address2: shipping.line2 || '',
      city: shipping.city,
      state_code: shipping.state,
      country_code: shipping.country,
      zip: shipping.postal_code,
      email: session.customer_details?.email || '',
    },
    items: [
      {
        sync_variant_id: printful_variant_id,
        quantity: 1,
        retail_price: (session.amount_total / 100).toFixed(2),
      },
    ],
    retail_costs: {
      currency: 'USD',
      subtotal: (session.amount_total / 100).toFixed(2),
      shipping: '0.00',
      tax: '0.00',
      total: (session.amount_total / 100).toFixed(2),
    },
  };

  const response = await fetch('https://api.printful.com/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
      'X-PF-Store-Id': process.env.PRINTFUL_STORE_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(order),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Printful order error:', data);
  } else {
    console.log('Printful order created:', data.result?.id);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status === 'paid') {
      await createPrintfulOrder(session);
    }
  }

  res.status(200).json({ received: true });
}
