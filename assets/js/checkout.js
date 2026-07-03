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
    // DOM ELEMENTLERI
    // ==========================================

    const checkoutContainer = document.getElementById('checkout-content-root');
    const emptyCartMessage = document.getElementById('empty-cart-message-box');
    const productListContainer = document.querySelector('.summary-product-list');
    const subtotalDisplay = document.getElementById('subtotal-display');
    const grandTotalDisplay = document.getElementById('grand-total-display');

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

        // Event listener'lari ekle
        attachItemEvents();
    }

    // ==========================================
    // EVENT LISTENERLAR
    // ==========================================

    function attachItemEvents() {
        // Miktar artir
        document.querySelectorAll('.qty-btn.plus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                let cart = getCart();
                cart[index].quantity = (cart[index].quantity || 1) + 1;
                saveCart(cart);
                renderCheckoutItems();
            });
        });

        // Miktar azalt
        document.querySelectorAll('.qty-btn.minus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                let cart = getCart();
                cart[index].quantity = (cart[index].quantity || 1) - 1;
                if (cart[index].quantity <= 0) {
                    cart.splice(index, 1);
                }
                saveCart(cart);
                renderCheckoutItems();
            });
        });

        // Kaldir
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
    // ODEME BUTONU
    // ==========================================

    const confirmBtn = document.getElementById('confirm-payment-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', (e) => {
            const form = document.getElementById('address-form');
            const terms = document.getElementById('accept-terms');
            const errorBox = document.getElementById('checkout-validation-error');

            // Form validasyonu
            if (!form.checkValidity()) {
                errorBox.style.display = 'block';
                errorBox.innerText = 'Vänligen fyll i alla obligatoriska fält korrekt.';

                form.querySelectorAll('input[required]').forEach(input => {
                    if (!input.value.trim()) {
                        input.classList.add('input-error');
                    } else {
                        input.classList.remove('input-error');
                    }
                });
                return;
            }

            // Kosullar kabul edilmis mi?
            if (!terms.checked) {
                errorBox.style.display = 'block';
                errorBox.innerText = 'Vänligen godkänn köpvillkoren för att fortsätta.';
                return;
            }

            errorBox.style.display = 'none';

            // Sepet bos mu?
            const cart = getCart();
            if (cart.length === 0) {
                errorBox.style.display = 'block';
                errorBox.innerText = 'Din varukorg är tom.';
                return;
            }

            console.log('Odeme baslatiliyor...');
            console.log('Sepet:', cart);

            // Burada Stripe veya diger odeme entegrasyonu
            // processPayment(cart, form);
        });
    }

    // Input hatalarini temizleme
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