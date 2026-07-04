document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // YARDIMCI FONKSIYONLAR
    // ==========================================

    function getCart() {
        try {
            return JSON.parse(localStorage.getItem('siteCartItems')) || [];
        } catch (e) {
            return [];
        }
    }

    function saveCart(cart) {
        localStorage.setItem('siteCartItems', JSON.stringify(cart));
    }

    // ==========================================
    // STRIPE BASLAT
    // ==========================================

    let stripe = null;
    let elements = null;
    let paymentElement = null;

    if (typeof Stripe !== 'undefined' && CONFIG?.STRIPE?.PUBLISHABLE_KEY) {
        stripe = Stripe(CONFIG.STRIPE.PUBLISHABLE_KEY);
        console.log('✅ Stripe baslatildi');
    } else {
        console.error('❌ Stripe.js yuklenemedi veya config eksik!');
    }

    // ==========================================
    // DOM ELEMENTLERI
    // ==========================================

    const checkoutContainer = document.getElementById('checkout-content-root');
    const emptyCartMessage = document.getElementById('empty-cart-message-box');
    const productListContainer = document.querySelector('.summary-product-list');
    const subtotalDisplay = document.getElementById('subtotal-display');
    const grandTotalDisplay = document.getElementById('grand-total-display');
    const confirmBtn = document.getElementById('confirm-payment-btn');
    const statusMessage = document.getElementById('checkout-validation-error');
    const paymentSection = document.getElementById('payment-section');
    const paymentElementContainer = document.getElementById('payment-element');
    const addressForm = document.getElementById('address-form');

    // ==========================================
    // SEPET RENDER
    // ==========================================

    function renderCheckoutItems() {
        const cart = getCart();

        if (cart.length === 0) {
            checkoutContainer.style.display = 'none';
            emptyCartMessage.style.display = 'flex';
            return;
        }

        checkoutContainer.style.display = 'grid';
        emptyCartMessage.style.display = 'none';

        productListContainer.innerHTML = '';
        let total = 0;

        cart.forEach((item, index) => {
            const qty = item.quantity || 1;
            const itemTotal = parseFloat(item.price) * qty;
            total += itemTotal;

            const productEl = document.createElement('div');
            productEl.className = 'summary-item';
            productEl.innerHTML = `
                <img src="${item.image || ''}" alt="${item.name || ''}" class="item-thumb" onerror="this.style.display='none'">
                <div class="item-details-wrapper">
                    <div class="item-info-left">
                        <p class="item-name">${item.name || 'Urun'}</p>
                        <p class="item-variant">${item.variants || 'Standard'}</p>
                        <div class="quantity-control">
                            <button class="qty-btn minus" data-index="${index}">-</button>
                            <input type="text" class="qty-display" value="${qty}" readonly>
                            <button class="qty-btn plus" data-index="${index}">+</button>
                        </div>
                    </div>
                    <div class="item-actions">
                        <span class="item-price">${itemTotal.toLocaleString('sv-SE')} SEK</span>
                        <button class="remove-btn" data-index="${index}">Ta bort</button>
                    </div>
                </div>
            `;
            productListContainer.appendChild(productEl);
        });

        subtotalDisplay.innerText = `${total.toLocaleString('sv-SE')} SEK`;
        grandTotalDisplay.innerText = `${total.toLocaleString('sv-SE')} SEK`;

        attachItemEvents();
    }

    function attachItemEvents() {
        document.querySelectorAll('.qty-btn.plus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                let cart = getCart();
                cart[index].quantity = (cart[index].quantity || 1) + 1;
                saveCart(cart);
                renderCheckoutItems();
                updatePaymentAmount();
            });
        });

        document.querySelectorAll('.qty-btn.minus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                let cart = getCart();
                cart[index].quantity = (cart[index].quantity || 1) - 1;
                if (cart[index].quantity <= 0) cart.splice(index, 1);
                saveCart(cart);
                renderCheckoutItems();
                updatePaymentAmount();
            });
        });

        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                let cart = getCart();
                cart.splice(index, 1);
                saveCart(cart);
                renderCheckoutItems();
                updatePaymentAmount();
            });
        });
    }

    // ==========================================
    // FORM VALIDASYON
    // ==========================================

    function validateForm() {
        const terms = document.getElementById('accept-terms');

        if (!addressForm.checkValidity()) {
            statusMessage.style.display = 'block';
            statusMessage.innerText = 'Vänligen fyll i alla obligatoriska fält korrekt.';
            addressForm.querySelectorAll('input[required]').forEach(input => {
                input.classList.toggle('input-error', !input.value.trim());
            });
            return false;
        }

        if (!terms.checked) {
            statusMessage.style.display = 'block';
            statusMessage.innerText = 'Vänligen godkänn köpvillkoren för att fortsätta.';
            return false;
        }

        const cart = getCart();
        if (cart.length === 0) {
            statusMessage.style.display = 'block';
            statusMessage.innerText = 'Din varukorg är tom.';
            return false;
        }

        statusMessage.style.display = 'none';
        return true;
    }

    function checkFormValidity() {
        const terms = document.getElementById('accept-terms');
        const isValid = addressForm.checkValidity() && terms.checked && getCart().length > 0;

        if (isValid) {
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('btn-disabled');
            confirmBtn.innerText = 'Betala nu';
        } else {
            confirmBtn.disabled = true;
            confirmBtn.classList.add('btn-disabled');
            confirmBtn.innerText = 'Fyll i leveransadressen först';
        }
        return isValid;
    }

    // ==========================================
    // STRIPE ELEMENTS - ÖDEME FORMU
    // ==========================================

    async function initPaymentForm() {
        console.log('initPaymentForm basladi...');

        if (!stripe) {
            console.error('Stripe yok!');
            paymentElementContainer.innerHTML = '<p style="color:#e54d42; padding:20px;">Betalningssystemet är inte tillgängligt.</p>';
            return false;
        }

        const cart = getCart();

        if (cart.length === 0) {
            paymentElementContainer.innerHTML = '<p style="color:#666; padding:20px; text-align:center;">Lägg till produkter i varukorgen för att se betalningsalternativ.</p>';
            return false;
        }

        // Müşteri bilgilerini formdan al (boş olabilir)
        const customerData = {
            firstName: document.getElementById('billing_first_name').value || '',
            lastName: document.getElementById('billing_last_name').value || '',
            email: document.getElementById('billing_email').value || '',
            phone: document.getElementById('billing_phone').value || '',
            address: document.getElementById('billing_address_1').value || '',
            postcode: document.getElementById('billing_postcode').value || '',
            city: document.getElementById('billing_city').value || ''
        };

        try {
            console.log('Payment Intent istegi gonderiliyor...');

            const response = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cart,
                    customer: customerData
                })
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                let errorMessage = 'Server fel';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // JSON parse hatası durumunda
                    errorMessage = `Server fel (${response.status})`;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('clientSecret var mi:', !!data.clientSecret);

            if (!data.clientSecret) {
                throw new Error('clientSecret bos dondu!');
            }

            // Eski elementleri temizle
            if (paymentElement) {
                paymentElement.destroy();
                paymentElement = null;
            }

            // Stripe Elements'i başlat
            elements = stripe.elements({
                clientSecret: data.clientSecret,
                appearance: {
                    theme: 'stripe',
                    variables: {
                        colorPrimary: '#000000',
                        colorBackground: '#ffffff',
                        colorText: '#333333',
                        colorDanger: '#e54d42',
                        borderRadius: '6px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
                    }
                }
            });

            // Payment Element oluştur
            const paymentElementOptions = {
                layout: 'tabs'
            };

            // Billing details varsa ekle
            if (customerData.firstName || customerData.email) {
                paymentElementOptions.defaultValues = {
                    billingDetails: {}
                };
                if (customerData.firstName && customerData.lastName) {
                    paymentElementOptions.defaultValues.billingDetails.name = `${customerData.firstName} ${customerData.lastName}`;
                }
                if (customerData.email) {
                    paymentElementOptions.defaultValues.billingDetails.email = customerData.email;
                }
                if (customerData.phone) {
                    paymentElementOptions.defaultValues.billingDetails.phone = customerData.phone;
                }
                if (customerData.address) {
                    paymentElementOptions.defaultValues.billingDetails.address = {
                        line1: customerData.address,
                        postal_code: customerData.postcode,
                        city: customerData.city,
                        country: 'SE'
                    };
                }
            }

            paymentElement = elements.create('payment', paymentElementOptions);

            // Payment Element'i DOM'a mount et
            paymentElementContainer.innerHTML = '';
            paymentElement.mount('#payment-element');

            console.log('Payment Element mount edildi!');

            // Form validasyonunu kontrol et
            checkFormValidity();

            return true;

        } catch (error) {
            console.error('Payment form hatasi:', error);
            paymentElementContainer.innerHTML = `
                <div style="color:#e54d42; padding:20px; text-align:center;">
                    <p style="font-weight:600; margin-bottom:8px;">Ett fel uppstod</p>
                    <p style="font-size:13px; color:#666;">${error.message}</p>
                    <button onclick="location.reload()" style="margin-top:15px; padding:8px 20px; background:#000; color:#fff; border:none; border-radius:4px; cursor:pointer;">Försök igen</button>
                </div>
            `;
            return false;
        }
    }

    async function updatePaymentAmount() {
        // Sepet değişince ödeme formunu yeniden başlat
        await initPaymentForm();
    }

    // ==========================================
    // ODEME ISLEMI
    // ==========================================

    async function handlePayment() {
        if (!validateForm()) return;

        if (!elements || !stripe) {
            statusMessage.style.display = 'block';
            statusMessage.innerText = 'Betalningsformuläret är inte redo.';
            return;
        }

        confirmBtn.disabled = true;
        confirmBtn.innerText = 'Bearbetar betalning...';

        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: window.location.origin + '/tack',
                    payment_method_data: {
                        billing_details: {
                            name: document.getElementById('billing_first_name').value + ' ' + document.getElementById('billing_last_name').value,
                            email: document.getElementById('billing_email').value,
                            phone: document.getElementById('billing_phone').value,
                            address: {
                                line1: document.getElementById('billing_address_1').value,
                                postal_code: document.getElementById('billing_postcode').value,
                                city: document.getElementById('billing_city').value,
                                country: 'SE'
                            }
                        }
                    }
                }
            });

            if (error) {
                console.error('Ödeme hatası:', error);
                statusMessage.style.display = 'block';
                statusMessage.innerHTML = `<span style="color:#e54d42;">${error.message}</span>`;
                confirmBtn.disabled = false;
                confirmBtn.innerText = 'Betala nu';
            } else if (paymentIntent && paymentIntent.status === 'succeeded') {
                saveCart([]);
                window.location.href = '/tack?payment_intent=' + paymentIntent.id;
            }

        } catch (error) {
            console.error('Beklenmeyen hata:', error);
            statusMessage.style.display = 'block';
            statusMessage.innerHTML = `<span style="color:#e54d42;">Ett oväntat fel uppstod. Försök igen.</span>`;
            confirmBtn.disabled = false;
            confirmBtn.innerText = 'Betala nu';
        }
    }

    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    // Ödeme butonu
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await handlePayment();
        });
    }

    // Input değişikliklerini dinle
    document.querySelectorAll('#address-form input, #accept-terms').forEach(input => {
        input.addEventListener('input', () => {
            input.classList.remove('input-error');
            checkFormValidity();
        });
        input.addEventListener('change', () => {
            checkFormValidity();
        });
    });

    // ==========================================
    // BASLAT
    // ==========================================

    renderCheckoutItems();

    // Sepet doluysa ödeme formunu hemen başlat
    const cart = getCart();
    if (cart.length > 0) {
        paymentSection.style.display = 'block';
        initPaymentForm();
    }

    // Butonu başlangıçta disabled yap
    checkFormValidity();
});