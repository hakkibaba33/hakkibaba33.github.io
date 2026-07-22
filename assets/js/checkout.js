// ==========================================
// CHECKOUT.JS - v4.0 (Ödeme Sonrası Sipariş)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {

// ==========================================
// STOK KONTROL FONKSIYONLARI (Fallback)
// ==========================================
// Bu fonksiyonlar common.js'te de tanimli. Eger common.js yuklenmediyse calisir.

if (typeof fetchProductStock === 'undefined') {
    async function fetchProductStock(productId, variantLabel, itemData) {
        try {
            const product = await supabaseGetOne('products', { id: 'eq.' + productId });
            if (!product) return { stock: 999 };

            // M2 urunler icin ozel stok hesaplama
            if (itemData && itemData.isM2 && product.m2_stock_per_width) {
                let stockData;
                try {
                    stockData = typeof product.m2_stock_per_width === 'string' 
                        ? JSON.parse(product.m2_stock_per_width) 
                        : product.m2_stock_per_width;
                } catch (e) {
                    stockData = {};
                }

                const widthCm = String(Math.round(parseFloat(itemData.en) || 0));
                const availableMeters = stockData[widthCm];

                if (availableMeters !== undefined && availableMeters !== null) {
                    const widthMeters = parseFloat(widthCm) / 100;
                    const totalM2 = Math.floor(availableMeters * widthMeters);
                    return { stock: totalM2, type: 'm2', rawStock: availableMeters, unit: 'm' };
                }
                return { stock: 0, type: 'm2', rawStock: 0, unit: 'm' };
            }

            if (variantLabel && variantLabel !== 'Standard') {
                const variants = await supabaseGet('product_variants', { 
                    product_id: 'eq.' + productId,
                    select: '*'
                });
                if (variants && variants.length > 0) {
                    const variant = variants.find(v => (v.size || '').trim() === (variantLabel || '').trim());
                    if (variant && variant.stock !== undefined && variant.stock !== null) {
                        return { stock: parseInt(variant.stock) || 0 };
                    }
                }
            }

            const stock = product.stock !== undefined && product.stock !== null 
                ? parseInt(product.stock) : 999;
            return { stock: stock };

        } catch (err) {
            console.error('[Stock] fetchProductStock hatasi:', err);
            return { stock: 999 };
        }
    }
}

if (typeof showStockWarning === 'undefined') {
    function showStockWarning(message) {
        let toast = document.getElementById('stock-warning-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'stock-warning-toast';
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #e54d42;
                color: #fff;
                padding: 14px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                z-index: 99999;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                transform: translateX(120%);
                transition: transform 0.3s ease;
                max-width: 320px;
                line-height: 1.4;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => { toast.style.transform = 'translateX(120%)'; }, 4000);
    }
}



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
    }

    let stripe = null;
    let elements = null;
    let paymentElement = null;
    let currentClientSecret = null;
    let currentPaymentIntentId = null;
    let isSubmitting = false;

    if (typeof Stripe !== 'undefined' && CONFIG?.STRIPE?.PUBLISHABLE_KEY) {
        stripe = Stripe(CONFIG.STRIPE.PUBLISHABLE_KEY);
        console.log('Stripe baslatildi');
    } else {
        console.error('Stripe.js yuklenemedi veya config eksik!');
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

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

            let variantDisplay = (item.isM2 || item.isGardin) && item.size 
                ? item.size 
                : (item.variants || 'Standard');

            if (!item.isM2 && !item.isGardin && item.color && item.color.trim() !== '') {
                variantDisplay += ' <span style="color:#888;">(' + escapeHtml(item.color) + ')</span>';
            }

            if (item.isGardin && item.note && item.note.trim() !== '') {
                variantDisplay += '<br><span style="color:#666;font-size:12px;font-style:italic;">📝 ' + escapeHtml(item.note) + '</span>';
            }

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
            btn.addEventListener('click', async (e) => {
                const index = parseInt(e.target.dataset.index);
                let cart = getCart();
                const item = cart[index];
                const currentQty = item.quantity || 1;
                const newQty = currentQty + 1;

                // Butonu gecici olarak devre disi birak (cift tiklamayi engelle)
                btn.disabled = true;
                btn.style.opacity = '0.5';

                try {
                    // Stok kontrolu
                    const variantLabel = (item.isM2 || item.isGardin) && item.size 
                        ? item.size 
                        : (item.variants || 'Standard');

                    const stockInfo = await fetchProductStock(item.id, variantLabel, item);
                    const maxStock = stockInfo.stock;

                    if (newQty > maxStock) {
                        showStockWarning(`Endast ${maxStock} st. i lager för "${item.name}"`);
                        btn.disabled = false;
                        btn.style.opacity = '1';
                        return;
                    }

                    item.quantity = newQty;
                    saveCart(cart);
                    renderCheckoutItems();
                    // Sepet degisince Payment Intent'i yeniden olustur
                    initPaymentForm();

                } catch (err) {
                    console.error('[Checkout] Stok kontrol hatasi:', err);
                    // Hata durumunda yine de artir ama uyar
                    item.quantity = newQty;
                    saveCart(cart);
                    renderCheckoutItems();
                    initPaymentForm();
                } finally {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
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
                initPaymentForm();
            });
        });

        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                let cart = getCart();
                cart.splice(index, 1);
                saveCart(cart);
                renderCheckoutItems();
                initPaymentForm();
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

    // ==========================================
    // Payment Intent oluştur (SADECE Stripe)
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

     const formattedItems = cart.map(item => {
    const baseItem = {
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        image: item.image || '',
        original_variant: item.variants || 'Standard'
    };

    // M2 urunler - sepetteki item.en, item.boy, item.m2 kullan
    if (item.isM2) {
        const widthCm = item.en || item.calc_width_cm || item.width_cm || 0;
        const lengthCm = item.boy || item.calc_length_cm || item.length_cm || 0;
        const m2Value = item.m2 || item.calc_m2 || ((widthCm/100) * (lengthCm/100)) || 0;
        const formValue = item.form || item.calc_form || 'Rektangulär';
        
        return {
            ...baseItem,
            calculatorType: 'm2',
            calc_width_cm: widthCm,
            calc_length_cm: lengthCm,
            calc_m2: m2Value,
            calc_form: formValue,
            variant: item.size || `${widthCm}×${lengthCm} cm (${formValue})`,
            calculator_data: {
                width_cm: widthCm,
                length_cm: lengthCm,
                m2: m2Value,
                form: formValue,
                is_square: formValue === 'Kare' || formValue === 'Rund' || (widthCm === lengthCm)
            }
        };
    }

    if (item.isGardin) {
        const widthCm = item.en || item.calc_width_cm || 0;
        const lengthCm = item.boy || item.calc_length_cm || 0;
        const metreValue = item.metre || item.calc_meters || ((widthCm / 100) * (item.pileRatio || 3.0)) || 0;
        const suspensionValue = item.suspension || item.calc_suspension || 'Gardinskena (Veckband)';
        
        return {
            ...baseItem,
            calculatorType: 'gardin',
            calc_width_cm: widthCm,
            calc_length_cm: lengthCm,
            calc_meters: metreValue,
            calc_suspension: suspensionValue,
            calc_note: item.note || item.calc_note || null,
            variant: item.size || `${widthCm}×${lengthCm} cm | ${metreValue.toFixed(2)} m`,
            calculator_data: {
                width_cm: widthCm,
                length_cm: lengthCm,
                meters: metreValue,
                suspension: suspensionValue,
                note: item.note || null
            }
        };
    }

    return {
        ...baseItem,
        variant: item.variants || 'Standard',
        color: item.color || null
    };
});

        try {
            console.log('Payment Intent istegi gonderiliyor...');

            const response = await fetch(CONFIG.API.PAYMENT_INTENT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: formattedItems
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

            currentClientSecret = data.clientSecret;
            currentPaymentIntentId = data.paymentIntentId || null;

            // Eğer zaten bir Payment Element varsa, sadece güncelle
            if (paymentElement && elements) {
                console.log('Mevcut Payment Element guncelleniyor...');
                elements.update({ clientSecret: data.clientSecret });
                return true;
            }

            // İlk kez oluşturuyorsak
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

            const firstName = document.getElementById('billing_first_name')?.value?.trim();
            const lastName = document.getElementById('billing_last_name')?.value?.trim();
            const email = document.getElementById('billing_email')?.value?.trim();
            const phone = document.getElementById('billing_phone')?.value?.trim();
            const address = document.getElementById('billing_address_1')?.value?.trim();
            const postcode = document.getElementById('billing_postcode')?.value?.trim();
            const city = document.getElementById('billing_city')?.value?.trim();

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

    // ==========================================
    // SADECE Stripe ödemesini onayla
    // ==========================================
    async function handlePayment() {
        if (isSubmitting) {
            console.log('Zaten işlemde, çift tıklama engellendi');
            return;
        }
        
        if (!validateForm()) return;

        if (!elements || !stripe || !paymentElement) {
            statusMessage.style.display = 'block';
            statusMessage.innerText = 'Betalningsformuläret är inte redo.';
            return;
        }

        if (!currentClientSecret) {
            statusMessage.style.display = 'block';
            statusMessage.innerText = 'Betalningsinformationen är inte redo. Vänligen uppdatera sidan.';
            return;
        }

        isSubmitting = true;
        saveCustomerToLocalStorage();

        confirmBtn.disabled = true;
        confirmBtn.innerText = 'Bearbetar betalning...';

        try {
            const firstName = document.getElementById('billing_first_name').value.trim();
            const lastName = document.getElementById('billing_last_name').value.trim();
            const email = document.getElementById('billing_email').value.trim();
            const phone = document.getElementById('billing_phone').value.trim();
            const address = document.getElementById('billing_address_1').value.trim();
            const postcode = document.getElementById('billing_postcode').value.trim();
            const city = document.getElementById('billing_city').value.trim();

            // Sepet ve müşteri bilgilerini localStorage'a kaydet (tack.html'de kullanacak)
            const cart = getCart();
            const customerData = { firstName, lastName, email, phone, address, postcode, city };
            
            localStorage.setItem('dkrug_pending_order', JSON.stringify({
                paymentIntentId: currentPaymentIntentId,
                items: cart,
                customer: customerData,
                timestamp: Date.now()
            }));

            // Stripe ödemesini onayla - sipariş kaydetme YOK
            const { error } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: window.location.origin + '/tack',
                    payment_method_data: {
                        billing_details: {
                            name: firstName + ' ' + lastName,
                            email: email,
                            phone: phone,
                            address: {
                                line1: address,
                                postal_code: postcode,
                                city: city,
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
                isSubmitting = false;
                confirmBtn.disabled = false;
                confirmBtn.innerText = 'Betala nu';
            }

        } catch (error) {
            console.error('Beklenmeyen hata:', error);
            statusMessage.style.display = 'block';
            statusMessage.innerHTML = `<span style="color:#e54d42;">Ett oväntat fel uppstod. Försök igen.</span>`;
            isSubmitting = false;
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

    document.querySelectorAll('#address-form input, #accept-terms').forEach(input => {
        input.addEventListener('input', () => {
            input.classList.remove('input-error');
            checkFormValidity();
            saveCustomerToLocalStorage();
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
