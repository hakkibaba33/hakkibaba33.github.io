// ==========================================
// CHECKOUT.JS - GUNCELLENMIS v2
// ==========================================

document.addEventListener('DOMContentLoaded', () => {

    // NOT: getCart ve saveCart common.js'ten geliyor, tekrar tanımlama!
    // Eğer common.js yüklendiyse onları kullan, yoksa kendi tanımlamanı kullan

    // Musteri bilgilerini localStorage'a kaydet (tack sayfasi icin)
    function saveCustomerToLocalStorage() {
        const customerData = {
            firstName: document.getElementById('billing_first_name')?.value?.trim() || '',
            lastName: document.getElementById('billing_last_name')?.value?.trim() || '',
            email: document.getElementById('billing_email')?.value?.trim() || '',
            phone: document.getElementById('billing_phone')?.value?.trim() || '',
            address: document.getElementById('billing_address_1')?.value?.trim() || '',
            postcode: document.getElementById('billing_postcode')?.value?.trim() || '',
            city: document.getElementById('billing_city')?.value?.trim() || ''
        };
        localStorage.setItem('dkrug_checkout_customer', JSON.stringify(customerData));
        console.log('Musteri bilgileri kaydedildi:', customerData);
    }

    let stripe = null;
    let elements = null;
    let paymentElement = null;

    if (typeof Stripe !== 'undefined' && CONFIG?.STRIPE?.PUBLISHABLE_KEY) {
        stripe = Stripe(CONFIG.STRIPE.PUBLISHABLE_KEY);
        console.log('✅ Stripe baslatildi');
    } else {
        console.error('❌ Stripe.js yuklenemedi veya config eksik!');
    }

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

    // getCart common.js'ten gelmeli ama fallback olarak tanımla
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

            // ✅ HESAPLAYICI URUN: size alanını göster, yoksa variants
            const variantDisplay = (item.isM2 || item.isGardin) && item.size 
                ? item.size 
                : (item.variants || 'Standard');

            const productEl = document.createElement('div');
            productEl.className = 'summary-item';
            productEl.innerHTML = `
                <img src="${item.image || ''}" alt="${item.name || ''}" class="item-thumb" onerror="this.style.display='none'">
                <div class="item-details-wrapper">
                    <div class="item-info-left">
                        <p class="item-name">${item.name || 'Urun'}</p>
                        <p class="item-variant">${variantDisplay}</p>
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

        const firstName = document.getElementById('billing_first_name')?.value?.trim();
        const lastName = document.getElementById('billing_last_name')?.value?.trim();
        const email = document.getElementById('billing_email')?.value?.trim();
        const phone = document.getElementById('billing_phone')?.value?.trim();
        const address = document.getElementById('billing_address_1')?.value?.trim();
        const postcode = document.getElementById('billing_postcode')?.value?.trim();
        const city = document.getElementById('billing_city')?.value?.trim();

        const customerData = {};
        if (firstName) customerData.firstName = firstName;
        if (lastName) customerData.lastName = lastName;
        if (email) customerData.email = email;
        if (phone) customerData.phone = phone;
        if (address) customerData.address = address;
        if (postcode) customerData.postcode = postcode;
        if (city) customerData.city = city;

        console.log('Gönderilen customer data:', customerData);

        try {
            console.log('Payment Intent istegi gonderiliyor...');

            // ✅ ADMIN PANEL FORMATINA DÖNÜŞTÜR
            // ✅ ADMIN PANEL FORMATINA DÖNÜŞTÜR
const formattedItems = cart.map(item => {
    const baseItem = {
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        image: item.image || '',
        // ❌ ESKİ: variant: item.variants || 'Standard'
        // ✅ YENİ: Hesaplayıcı verileri ayrı alanlarda, variant'ı da koru
        original_variant: item.variants || 'Standard'
    };

    // M2 hesaplayıcı ürün
    if (item.isM2) {
        return {
            ...baseItem,
            calculatorType: 'm2',
            calc_width_cm: item.en,
            calc_length_cm: item.boy,
            calc_m2: item.m2,
            calc_form: item.form,  // 'Kare', 'Rektangulär', vs.
            // ✅ YENİ: Ölçü bilgisini variant alanına yaz
            variant: item.size || `${item.en}×${item.boy} cm (${item.form || 'Rektangulär'})`,
            // ✅ YENİ: Ham verileri de gönder (admin için)
            calculator_data: {
                width_cm: item.en,
                length_cm: item.boy,
                m2: item.m2,
                form: item.form,
                is_square: item.form === 'Kare' || (item.en === item.boy)
            }
        };
    }

    // Gardin hesaplayıcı ürün
    if (item.isGardin) {
        return {
            ...baseItem,
            calculatorType: 'gardin',
            calc_width_cm: item.en,
            calc_length_cm: item.boy,
            calc_meters: item.metre,
            calc_suspension: item.suspension,
            // ✅ YENİ: Ölçü bilgisini variant alanına yaz
            variant: item.size || `${item.en}×${item.boy} cm | ${item.metre} m`,
            // ✅ YENİ: Ham verileri de gönder (admin için)
            calculator_data: {
                width_cm: item.en,
                length_cm: item.boy,
                meters: item.metre,
                suspension: item.suspension
            }
        };
    }

    // Normal varyasyonlu ürün
    return {
        ...baseItem,
        variant: item.variants || 'Standard'
    };
});

            const response = await fetch(CONFIG.API.PAYMENT_INTENT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: formattedItems,
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
                    errorMessage = `Server fel (${response.status})`;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('clientSecret var mi:', !!data.clientSecret);

            if (!data.clientSecret) {
                throw new Error('clientSecret bos dondu!');
            }

            if (paymentElement) {
                paymentElement.destroy();
                paymentElement = null;
            }

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

            const paymentElementOptions = {
                layout: {
                    type: 'tabs',
                    defaultCollapsed: false
                }
            };

            const billingDetails = {};
            if (firstName && lastName) billingDetails.name = `${firstName} ${lastName}`;
            if (email) billingDetails.email = email;
            if (phone) billingDetails.phone = phone;
            if (address) {
                billingDetails.address = {
                    line1: address,
                    postal_code: postcode || '',
                    city: city || '',
                    country: 'SE'
                };
            }

            if (Object.keys(billingDetails).length > 0) {
                paymentElementOptions.defaultValues = { billingDetails };
            }

            paymentElement = elements.create('payment', paymentElementOptions);

            paymentElementContainer.innerHTML = '';
            paymentElement.mount('#payment-element');

            console.log('Payment Element mount edildi!');

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
        await initPaymentForm();
    }

    async function handlePayment() {
        if (!validateForm()) return;

        if (!elements || !stripe) {
            statusMessage.style.display = 'block';
            statusMessage.innerText = 'Betalningsformuläret är inte redo.';
            return;
        }

        // Musteri bilgilerini kaydet (tack sayfasi icin)
        saveCustomerToLocalStorage();

        confirmBtn.disabled = true;
        confirmBtn.innerText = 'Bearbetar betalning...';

        try {
            const { error } = await stripe.confirmPayment({
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
            }
            // NOT: Basarili odeme durumunda Stripe otomatik /tack sayfasina yonlendirir
            // Kayit islemi tack.html'de yapilir

        } catch (error) {
            console.error('Beklenmeyen hata:', error);
            statusMessage.style.display = 'block';
            statusMessage.innerHTML = `<span style="color:#e54d42;">Ett oväntat fel uppstod. Försök igen.</span>`;
            confirmBtn.disabled = false;
            confirmBtn.innerText = 'Betala nu';
        }
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await handlePayment();
        });
    }

    // Form degisikliklerini dinle + musteri bilgilerini kaydet
    document.querySelectorAll('#address-form input, #accept-terms').forEach(input => {
        input.addEventListener('input', () => {
            input.classList.remove('input-error');
            checkFormValidity();
            saveCustomerToLocalStorage(); // Her degisiklikte kaydet
        });
        input.addEventListener('change', () => {
            checkFormValidity();
            saveCustomerToLocalStorage();
        });
    });

    renderCheckoutItems();

    const cart = getCart();
    if (cart.length > 0) {
        paymentSection.style.display = 'block';
        initPaymentForm();
    }

    checkFormValidity();
});