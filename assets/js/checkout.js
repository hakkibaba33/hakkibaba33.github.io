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
    const embeddedCheckoutContainer = document.getElementById('embedded-checkout');

    console.log('DOM Elements:', {
        paymentSection: !!paymentSection,
        embeddedCheckoutContainer: !!embeddedCheckoutContainer,
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
            });
        });

        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                let cart = getCart();
                cart.splice(index, 1);
                saveCart(cart);
                renderCheckoutItems();
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
    // EMBEDDED STRIPE CHECKOUT
    // ==========================================

    let checkoutInstance = null;

    async function initEmbeddedCheckout() {
        console.log('initEmbeddedCheckout basladi...');
        
        if (!stripe) {
            console.error('Stripe yok!');
            statusMessage.style.display = 'block';
            statusMessage.innerHTML = '<span style="color:#e54d42;">Betalningssystemet är inte tillgängligt.</span>';
            return;
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
            console.log('API istegi gonderiliyor...');
            
            const response = await fetch('/api/create-checkout-session', {
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
            console.log('clientSecret uzunluk:', data.clientSecret ? data.clientSecret.length : 0);

            if (!data.clientSecret) {
                throw new Error('clientSecret bos dondu!');
            }

            // ÖNCE container'ı görünür yap
            paymentSection.style.display = 'block';
            console.log('Payment section acildi');

            // Sonra mount et
            console.log('Stripe initEmbeddedCheckout cagriliyor...');
            
            checkoutInstance = await stripe.initEmbeddedCheckout({
                clientSecret: data.clientSecret
            });

            console.log('Mount ediliyor...');
            checkoutInstance.mount('#embedded-checkout');
            console.log('Mount tamamlandi!');

            // Butonu gizle
            confirmBtn.style.display = 'none';

        } catch (error) {
            console.error('Embedded checkout hatasi:', error);
            statusMessage.style.display = 'block';
            statusMessage.innerHTML = `<span style="color:#e54d42;">Ett fel uppstod: ${error.message}</span>`;
            confirmBtn.disabled = false;
            confirmBtn.innerText = 'Gå till betalning';
        }
    }

    // ==========================================
    // ODEME BUTONU
    // ==========================================

    if (confirmBtn) {
        confirmBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            if (!validateForm()) return;

            confirmBtn.disabled = true;
            confirmBtn.innerText = 'Laddar...';

            await initEmbeddedCheckout();
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