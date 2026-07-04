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
        console.log('Customer email:', customer?.email || 'YOK');

        // Payment Intent parametreleri - SADECE zorunlu alanlar
        const paymentIntentParams = {
            amount: totalAmount,
            currency: 'sek',
            payment_method_types: ['card', 'klarna'],
            metadata: {
                customer_name: (customer?.firstName && customer?.lastName) 
                    ? `${customer.firstName} ${customer.lastName}` 
                    : 'Guest',
                items_count: items.length.toString()
            }
        };

        // Email varsa VE geçerliyse ekle - YOKSA HİÇ EKLEME
        const email = customer?.email?.trim();
        if (email && email.includes('@') && email.includes('.')) {
            paymentIntentParams.receipt_email = email;
            console.log('receipt_email eklendi:', email);
        } else {
            console.log('receipt_email eklenmedi (geçersiz veya boş)');
        }

        // Shipping bilgileri varsa ekle
        if (customer?.address && customer?.firstName) {
            paymentIntentParams.shipping = {
                name: `${customer.firstName} ${customer.lastName || ''}`.trim(),
                address: {
                    line1: customer.address,
                    postal_code: customer.postcode || '',
                    city: customer.city || '',
                    country: 'SE'
                }
            };
            if (customer.phone) {
                paymentIntentParams.shipping.phone = customer.phone;
            }
        }

        console.log('PaymentIntent params:', JSON.stringify(paymentIntentParams, null, 2));

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

        console.log('Payment Intent oluşturuldu:', paymentIntent.id);
        console.log('Client secret var mı:', !!paymentIntent.client_secret);

        res.status(200).json({
            clientSecret: paymentIntent.client_secret
        });

    } catch (error) {
        console.error('Payment Intent hatası:', error);
        console.error('Hata detayı:', error.message);
        res.status(500).json({ error: error.message });
    }
};