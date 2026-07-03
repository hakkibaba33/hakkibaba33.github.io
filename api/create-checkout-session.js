const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { items, customer } = req.body;

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

        console.log('Creating embedded session...');
        console.log('Return URL:', 'https://www.dekorist.se/tack?session_id={CHECKOUT_SESSION_ID}');

        const session = await stripe.checkout.sessions.create({
            ui_mode: 'embedded',
            payment_method_types: ['card', 'klarna'],
            line_items: lineItems,
            mode: 'payment',
            return_url: 'https://www.dekorist.se/tack?session_id={CHECKOUT_SESSION_ID}',
            customer_email: customer.email,
            metadata: {
                customer_name: `${customer.firstName} ${customer.lastName}`,
                customer_phone: customer.phone,
                customer_address: `${customer.address}, ${customer.postcode} ${customer.city}`
            }
        });

        console.log('Session created:', session.id);
        console.log('Client secret exists:', !!session.client_secret);
        console.log('Client secret length:', session.client_secret ? session.client_secret.length : 0);

        // client_secret var mı kontrol et
        if (!session.client_secret) {
            console.error('ERROR: client_secret is undefined!');
            console.log('Session object keys:', Object.keys(session));
            return res.status(500).json({ error: 'client_secret not generated' });
        }

        res.status(200).json({ 
            clientSecret: session.client_secret 
        });

    } catch (error) {
        console.error('Stripe hatasi:', error);
        res.status(500).json({ error: error.message });
    }
};