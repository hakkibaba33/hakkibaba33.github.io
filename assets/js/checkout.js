// ==========================================
// CHECKOUT.JS - GUNCELLENMIS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {

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

// ==========================================
// CHECKOUT.JS - TAMAMEN DÜZELTİLMİŞ
// ==========================================

let stripe = null;
let elements = null;
let paymentElement = null;

// --- FONKSİYONLARI BURAYA GERİ KOYUYORUZ ---

function getCart() {
    try { return JSON.parse(localStorage.getItem('siteCartItems')) || []; } 
    catch (e) { return []; }
}

function saveCart(cart) {
    localStorage.setItem('siteCartItems', JSON.stringify(cart));
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

function renderCheckoutItems() {
    // Eski render fonksiyonunun içeriğini buraya aynen yapıştır
    console.log("Ürünler listeleniyor...");
    // (Kodun burada devam etmeli)
}

function initPaymentForm() {
    console.log("Ödeme formu başlatılıyor...");
    // (Kodun burada devam etmeli)
}

function checkFormValidity() {
    // (Kodun burada devam etmeli)
}

// --- BAŞLATMA MANTIĞI ---

function initializeCheckout() {
    if (typeof Stripe === 'undefined') {
        console.error('❌ Stripe kütüphanesi bulunamadı!');
        return;
    }
    
    console.log('✅ Stripe kütüphanesi hazır, başlatılıyor...');
    stripe = Stripe(CONFIG.STRIPE.PUBLISHABLE_KEY);
    
    renderCheckoutItems();
    initPaymentForm();
    checkFormValidity();
}

// Sayfa tamamen yüklendiğinde çalıştır
window.addEventListener('load', () => {
    // Stripe'ın yüklenmesi için 300ms bekle
    setTimeout(initializeCheckout, 300);
});

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
