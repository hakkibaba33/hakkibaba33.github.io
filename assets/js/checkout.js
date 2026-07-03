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

    function clearCart() {
        localStorage.removeItem('siteCartItems');
    }

    // ==========================================
    // STRIPE BASLAT
    // ==========================================

    let stripe = null;
    if (typeof Stripe !== 'undefined' && CONFIG?.STRIPE?.PUBLISHABLE_KEY) {
        stripe = Stripe(CONFIG.STRIPE.PUBLISHABLE_KEY);
    } else {
        console.error('Stripe.js yuklenemedi veya config eksik!');
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

        // Form validasyonu
        if (!form.checkValidity()) {
            errorBox.style.display = 'block';
            errorBox.innerText = 'Vänligen fyll i alla obligatoriska fält korrekt.';
            form.querySelectorAll('input[required]').forEach(input => {
                input.classList.toggle('input-error', !input.value.trim());
            });
            return false;
        }

        // Koşullar
        if (!terms.checked) {
            errorBox.style.display = 'block';
            errorBox.innerText = 'Vänligen godkänn köpvillkoren för att fortsätta.';
            return false;
        }

        // Sepet boş mu?
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
    // STRIPE CHECKOUT - YÖNLENDİRME METODU
    // ==========================================

    async function redirectToStripeCheckout() {
        if (!stripe) {
            statusMessage.innerHTML = '<span style="color:#e54d42;">Betalningssystemet är inte tillgängligt. Försök igen senare.</span>';
            return;
        }

        const cart = getCart();
        const total = cart.reduce((sum, item) => sum + (parseFloat(item.price) * (item.quantity || 1)), 0);

        // Müşteri bilgileri
        const customerData = {
            firstName: document.getElementById('billing_first_name').value,
            lastName: document.getElementById('billing_last_name').value,
            email: document.getElementById('billing_email').value,
            phone: document.getElementById('billing_phone').value,
            address: document.getElementById('billing_address_1').value,
            postcode: document.getElementById('billing_postcode').value,
            city: document.getElementById('billing_city').value
        };

        // Butonu devre dışı bırak
        confirmBtn.disabled = true;
        confirmBtn.innerText = 'Bearbetar...';
        statusMessage.innerText = 'Omdirigerar till säker betalning...';

        try {
            // Backend API'ye istek at (Stripe Session oluştur)
            const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cart,
                    customer: customerData,
                    success_url: CONFIG.STRIPE.SUCCESS_URL,
                    cancel_url: CONFIG.STRIPE.CANCEL_URL
                })
            });

            if (!response.ok) throw new Error('Server fel');

            const session = await response.json();

            // Stripe Checkout'a yönlendir
            const result = await stripe.redirectToCheckout({
                sessionId: session.id
            });

            if (result.error) {
                throw new Error(result.error.message);
            }

        } catch (error) {
            console.error('Checkout hatasi:', error);
            statusMessage.innerHTML = `<span style="color:#e54d42;">Ett fel uppstod: ${error.message}. Försök igen.</span>`;
            confirmBtn.disabled = false;
            confirmBtn.innerText = 'Slutför köp';
        }
    }

    // ==========================================
    // ALTERNATIF: EMBEDDED STRIPE (Daha gelişmiş)
    // ==========================================

    async function initEmbeddedStripe() {
        // Bu metod Stripe Elements ile kart girişi yapar
        // Daha karmaşık, istersen sonra ekleriz
        console.log('Embedded Stripe - ileride eklenecek');
    }

    // ==========================================
    // ODEME BUTONU EVENT
    // ==========================================

    if (confirmBtn) {
        confirmBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            if (!validateForm()) return;

            // Yönlendirme metodu
            await redirectToStripeCheckout();
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