// /api/create-checkout-session.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { items, customer, success_url, cancel_url } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        const lineItems = items.map(item => ({
            price_data: {
                currency: 'sek',
                product_data: {
                    name: item.name,
                    description: item.variants || '',
                    images: item.image ? [item.image] : []
                },
                unit_amount: Math.round(parseFloat(item.price) * 100)
            },
            quantity: item.quantity || 1
        }));

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancel_url,
            customer_email: customer.email,
            metadata: {
                customer_name: `${customer.firstName} ${customer.lastName}`,
                customer_phone: customer.phone,
                customer_address: `${customer.address}, ${customer.postcode} ${customer.city}`
            }
        });

        res.status(200).json({ id: session.id });

    } catch (error) {
        console.error('Stripe hatasi:', error);
        res.status(500).json({ error: error.message });
    }
};