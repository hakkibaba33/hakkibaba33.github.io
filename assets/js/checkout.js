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
    const statusMessage = document.getElementById('checkout-status-message');
    const embeddedCheckoutContainer = document.getElementById('embedded-checkout');
    const paymentSection = document.getElementById('checkout-section-card');

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
        const errorBox = document.getElementById('checkout-validation-error');

        if (!form.checkValidity()) {
            errorBox.style.display = 'block';
            errorBox.innerText = 'Vänligen fyll i alla obligatoriska fält korrekt.';
            form.querySelectorAll('input[required]').forEach(input => {
                input.classList.toggle('input-error', !input.value.trim());
            });
            return false;
        }

        if (!terms.checked) {
            errorBox.style.display = 'block';
            errorBox.innerText = 'Vänligen godkänn köpvillkoren för att fortsätta.';
            return false;
        }

        const cart = getCart();
        if (cart.length === 0) {
            errorBox.style.display = 'block';
            errorBox.innerText = 'Din varukorg är tom.';
            return false;
        }

        errorBox.style.display = 'none';
        return true;
    }

    // ==========================================
    // EMBEDDED STRIPE CHECKOUT - YENI
    // ==========================================

    let checkoutInstance = null;

    async function initEmbeddedCheckout() {
        if (!stripe) {
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
            // Session oluştur (embedded mode)
            const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cart,
                    customer: customerData,
                    mode: 'embedded' // ← YENI
                })
            });

            if (!response.ok) throw new Error('Server fel');

            const { clientSecret } = await response.json();

            // Embedded checkout'u başlat
            checkoutInstance = await stripe.initEmbeddedCheckout({
                clientSecret,
                onComplete: () => {
                    // Ödeme tamamlandı
                    window.location.href = '/tack';
                }
            });

            // Sayfaya yerleştir
            checkoutInstance.mount('#embedded-checkout');
            paymentSection.style.display = 'block';

        } catch (error) {
            console.error('Embedded checkout hatasi:', error);
            statusMessage.innerHTML = `<span style="color:#e54d42;">Ett fel uppstod: ${error.message}</span>`;
        }
    }

    // ==========================================
    // ODEME BUTONU - ARTIK "KARTI GOSTER" OLACAK
    // ==========================================

    if (confirmBtn) {
        confirmBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            if (!validateForm()) return;

            // Butonu değiştir
            confirmBtn.innerText = 'Laddar betalning...';
            confirmBtn.disabled = true;

            // Embedded checkout'u başlat
            await initEmbeddedCheckout();

            // Butonu gizle (artık Stripe'un kendi butonu var)
            confirmBtn.style.display = 'none';
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