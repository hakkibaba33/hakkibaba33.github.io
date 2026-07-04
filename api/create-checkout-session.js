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

        // Toplam tutarı hesapla (öre cinsinden)
        const totalAmount = items.reduce((sum, item) => {
            const qty = item.quantity || 1;
            return sum + (Math.round(parseFloat(item.price) * 100) * qty);
        }, 0);

        console.log('Payment Intent oluşturuluyor...');
        console.log('Toplam tutar (öre):', totalAmount);

        // Payment Intent oluştur
        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmount,
            currency: 'sek',
            payment_method_types: ['card', 'klarna'],
            receipt_email: customer.email,
            metadata: {
                customer_name: `${customer.firstName} ${customer.lastName}`,
                customer_email: customer.email,
                customer_phone: customer.phone,
                customer_address: `${customer.address}, ${customer.postcode} ${customer.city}`,
                items_count: items.length.toString()
            },
            shipping: {
                name: `${customer.firstName} ${customer.lastName}`,
                address: {
                    line1: customer.address,
                    postal_code: customer.postcode,
                    city: customer.city,
                    country: 'SE'
                },
                phone: customer.phone
            }
        });

        console.log('Payment Intent oluşturuldu:', paymentIntent.id);
        console.log('Client secret var mı:', !!paymentIntent.client_secret);

        res.status(200).json({
            clientSecret: paymentIntent.client_secret
        });

    } catch (error) {
        console.error('Payment Intent hatası:', error);
        res.status(500).json({ error: error.message });
    }
};