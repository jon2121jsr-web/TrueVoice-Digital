import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SIZES = {
  S:   '69ffaf136218b1',
  M:   '69ffaf13621923',
  L:   '69ffaf13621965',
  XL:  '69ffaf136219b8',
  '3XL': '69ffaf13621a46',
  '4XL': '69ffaf13621a84',
  '5XL': '69ffaf13621ac8',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { size, productName, price, image } = req.body;

  if (!size || !SIZES[size]) {
    return res.status(400).json({ error: 'Invalid size' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${productName} — Size ${size}`,
              images: image ? [image] : [],
              metadata: { printful_variant_id: SIZES[size], size },
            },
            unit_amount: Math.round(parseFloat(price.replace('$', '')) * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://truevoice.digital'}?order=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://truevoice.digital'}?order=cancelled`,
      metadata: {
        printful_variant_id: SIZES[size],
        product_name: productName,
        size,
      },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message });
  }
}
