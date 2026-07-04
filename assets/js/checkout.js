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
        console.log('Stripe var mi:', typeof Stripe !== 'undefined');
        console.log('CONFIG var mi:', typeof CONFIG !== 'undefined');
        console.log('CONFIG.STRIPE var mi:', CONFIG?.STRIPE ? 'EVET' : 'HAYIR');
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

    console.log('DOM Elements:', {
        paymentSection: !!paymentSection,
        paymentElementContainer: !!paymentElementContainer,
        confirmBtn: !!confirmBtn
    });

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
                // Sepet değişince ödeme formunu resetle
                resetPaymentForm();
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
                resetPaymentForm();
            });
        });

        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                let cart = getCart();
                cart.splice(index, 1);
                saveCart(cart);
                renderCheckoutItems();
                resetPaymentForm();
            });
        });
    }

    // ==========================================
    // FORM VALIDASYON
    // ==========================================

    function validateForm() {
        const form = document.getElementById('address-form');
        const terms = document.getElementById('accept-terms');

        if (!form.checkValidity()) {
            statusMessage.style.display = 'block';
            statusMessage.innerText = 'Vänligen fyll i alla obligatoriska fält korrekt.';
            form.querySelectorAll('input[required]').forEach(input => {
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

    // ==========================================
    // STRIPE ELEMENTS - ÖDEME FORMU
    // ==========================================

    let isPaymentFormInitialized = false;

    function resetPaymentForm() {
        // Sepet değişince ödeme formunu temizle ve yeniden başlat
        if (paymentElement) {
            paymentElement.destroy();
            paymentElement = null;
        }
        if (elements) {
            elements = null;
        }
        isPaymentFormInitialized = false;
        paymentElementContainer.innerHTML = '';
        paymentSection.style.display = 'none';
        confirmBtn.style.display = 'block';
        confirmBtn.disabled = false;
        confirmBtn.innerText = 'Gå till betalning';
    }

    async function initPaymentForm() {
        console.log('initPaymentForm basladi...');

        if (!stripe) {
            console.error('Stripe yok!');
            statusMessage.style.display = 'block';
            statusMessage.innerHTML = '<span style="color:#e54d42;">Betalningssystemet är inte tillgängligt.</span>';
            return false;
        }

        const cart = getCart();
        const customerData = {
            firstName: document.getElementById('billing_first_name').value,
            lastName: document.getElementById('billing_last_name').value,
            email: document.getElementById('billing_email').value,
            phone: document.getElementById('billing_phone').value,
            address: document.getElementById('billing_address_1').value,
            postcode: document.getElementById('billing_postcode').value,
            city: document.getElementById('billing_city').value
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
                const errorData = await response.json();
                throw new Error(errorData.error || 'Server fel');
            }

            const data = await response.json();
            console.log('Response data:', data);
            console.log('clientSecret var mi:', !!data.clientSecret);

            if (!data.clientSecret) {
                throw new Error('clientSecret bos dondu!');
            }

            // Ödeme bölümünü göster
            paymentSection.style.display = 'block';

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

            // Payment Element oluştur (kart + Klarna)
            paymentElement = elements.create('payment', {
                layout: 'tabs',
                defaultValues: {
                    billingDetails: {
                        name: `${customerData.firstName} ${customerData.lastName}`,
                        email: customerData.email,
                        phone: customerData.phone,
                        address: {
                            line1: customerData.address,
                            postal_code: customerData.postcode,
                            city: customerData.city,
                            country: 'SE'
                        }
                    }
                }
            });

            // Payment Element'i DOM'a mount et
            paymentElement.mount('#payment-element');

            isPaymentFormInitialized = true;

            // Butonu "Betala nu" olarak değiştir
            confirmBtn.innerText = 'Betala nu';
            confirmBtn.disabled = false;

            console.log('Payment Element mount edildi!');

            return true;

        } catch (error) {
            console.error('Payment form hatasi:', error);
            statusMessage.style.display = 'block';
            statusMessage.innerHTML = `<span style="color:#e54d42;">Ett fel uppstod: ${error.message}</span>`;
            confirmBtn.disabled = false;
            confirmBtn.innerText = 'Gå till betalning';
            return false;
        }
    }

    // ==========================================
    // ODEME ISLEMI
    // ==========================================

    async function handlePayment() {
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
                // Ödeme başarılı - sepeti temizle ve teşekkür sayfasına yönlendir
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
    // ODEME BUTONU
    // ==========================================

    if (confirmBtn) {
        confirmBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            if (!validateForm()) return;

            // Eğer ödeme formu henüz başlatılmadıysa, başlat
            if (!isPaymentFormInitialized) {
                confirmBtn.disabled = true;
                confirmBtn.innerText = 'Laddar...';

                const success = await initPaymentForm();
                if (!success) {
                    confirmBtn.disabled = false;
                    confirmBtn.innerText = 'Gå till betalning';
                }
                return;
            }

            // Ödeme formu zaten açıksa, ödemeyi gerçekleştir
            await handlePayment();
        });
    }

    // Input hatalarını temizleme
    document.querySelectorAll('#address-form input').forEach(input => {
        input.addEventListener('input', () => {
            input.classList.remove('input-error');
        });
    });

    // ==========================================
    // BASLAT
    // ==========================================

    renderCheckoutItems();
});