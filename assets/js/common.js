// ==========================================
// COMMON.JS - TEMIZLENMIS (v4)
// ==========================================

// CONFIG kontrolu
if (typeof CONFIG === 'undefined') {
    console.error('HATA: config.js yuklenmemis!');
}

const API_KEY = (typeof CONFIG !== 'undefined') ? CONFIG.AIRTABLE.API_KEY : '';
const BASE_ID = (typeof CONFIG !== 'undefined') ? CONFIG.AIRTABLE.BASE_ID : '';
const TABLE_NAME = (typeof CONFIG !== 'undefined') ? CONFIG.AIRTABLE.TABLE_NAME : 'products';

// ==========================================
// 1. YARDIMCI FONKSIYONLAR
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
    updateCartBadge();
}

function updateCartBadge() {
    const cart = getCart();
    const badge = document.querySelector('.cart-count-badge');
    if (badge) {
        badge.textContent = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        badge.classList.toggle('visible', cart.length > 0);
    }
}

// ==========================================
// 2. MINI SEPET - ACMA / KAPAMA
// ==========================================

function openMiniCart() {
    const overlay = document.getElementById('mini-cart-overlay');
    if (!overlay) {
        console.error('mini-cart-overlay bulunamadi!');
        return;
    }
    overlay.classList.add('open');
    document.body.classList.add('cart-open');
    updateMiniCartUI();
    console.log('Mini sepet ACILDI');
}

function closeMiniCart() {
    const overlay = document.getElementById('mini-cart-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.classList.remove('cart-open');
    console.log('Mini sepet KAPANDI');
}













// ==========================================
// 8. ARAMA FONKSİYONU
// ==========================================
function initSearch() {
    const searchInput = document.getElementById('live-search-input');
    const resultsDisplay = document.getElementById('search-results-display');
    const searchPopup = document.getElementById('search-popup-overlay');
    const searchOpenBtn = document.getElementById('search-open-btn');
    const searchCloseBtn = document.getElementById('search-close-btn') || document.getElementById('close-search-popup');

    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            const query = this.value.trim();
            
            if (query.length < 2) {
                if (resultsDisplay) resultsDisplay.innerHTML = '';
                return;
            }

            debounceTimer = setTimeout(() => {
                fetch('/wp-admin/admin-ajax.php?action=klasik_search&term=' + encodeURIComponent(query))
                    .then(r => r.text())
                    .then(data => {
                        if (resultsDisplay) resultsDisplay.innerHTML = data;
                    })
                    .catch(() => {
                        ToastSystem.error('Sökningen misslyckades. Försök igen.');
                    });
            }, 300);
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = searchInput.value.trim();
                if (query) {
                    window.location.href = '/?s=' + encodeURIComponent(query) + '&post_type=product';
                }
            }
        });
    }

    if (searchOpenBtn && searchPopup) {
        searchOpenBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleModal(searchPopup, 'open');
            setTimeout(() => searchInput?.focus(), 300);
        });

        const closeSearch = () => toggleModal(searchPopup, 'close');
        if (searchCloseBtn) searchCloseBtn.addEventListener('click', closeSearch);
        searchPopup.addEventListener('click', (e) => {
            if (e.target === searchPopup) closeSearch();
        });
    }

document.querySelectorAll('.mobile-menu-list .menu-item-has-children > a').forEach(item => {
    // Event listener yok - normal link davranışı
    // Kullanıcı ana kategoriye tıklayınca sayfaya gider
    console.log('Mobil menü: Alt kategoriler chips butonlarından erişilecek');
});
 }





























// ==========================================
// 3. MINI SEPET - ICERIK YONETIMI
// ==========================================

function updateMiniCartUI() {
    const cart = getCart();
    const emptyState = document.getElementById('cart-empty-state');
    const filledState = document.getElementById('cart-filled-state');
    const footer = document.getElementById('mini-cart-footer');

    if (!emptyState || !filledState || !footer) {
        console.error('Mini sepet elementleri bulunamadi!');
        return;
    }

    if (cart.length === 0) {
        emptyState.style.display = 'block';
        filledState.style.display = 'none';
        footer.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        filledState.style.display = 'block';
        footer.style.display = 'block';

        let total = 0;
        filledState.innerHTML = cart.map(item => {
            const qty = item.quantity || 1;
            const itemTotal = item.price * qty;
            total += itemTotal;
            return `
                <div class="mini-cart-item" data-id="${item.id}">
                    <img src="${item.image || ''}" alt="${item.name || ''}" class="item-image" onerror="this.style.display='none'">
                    <div class="item-details-left">
                        <span class="item-name">${item.name || 'Urun'}</span>
                        <span class="item-variant">${item.variants || 'Standard'}</span>
                        <div class="quantity-control">
                            <button class="quantity-btn minus" data-id="${item.id}" data-action="decrease">-</button>
                            <input type="text" class="quantity-input" value="${qty}" readonly>
                            <button class="quantity-btn plus" data-id="${item.id}" data-action="increase">+</button>
                        </div>
                    </div>
                    <div class="item-price-right">
                        <span class="item-price">${itemTotal.toFixed(2)} SEK</span>
                        <button class="remove-item-btn" data-id="${item.id}">Ta bort</button>
                    </div>
                </div>
            `;
        }).join('');

        const grandTotal = document.getElementById('cart-grand-total');
        if (grandTotal) grandTotal.textContent = total.toFixed(2) + ' SEK';
    }
}

function updateQuantity(productId, change) {
    let cart = getCart();
    const item = cart.find(i => i.id === productId);
    if (!item) return;

    item.quantity = (item.quantity || 1) + change;
    if (item.quantity <= 0) {
        cart = cart.filter(i => i.id !== productId);
    }
    saveCart(cart);
    updateMiniCartUI();
}

function removeFromCart(productId) {
    let cart = getCart().filter(i => i.id !== productId);
    saveCart(cart);
    updateMiniCartUI();
}

// ==========================================
// 4. URUN EKLEME
// ==========================================

function addProductToCart(productData) {
    let cart = getCart();
    const existing = cart.find(i => i.id === productData.id);

    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        cart.push({
            ...productData,
            quantity: 1
        });
    }

    saveCart(cart);
    updateMiniCartUI();
    openMiniCart();
    console.log('Urun sepete eklendi:', productData.name);
}

// ==========================================
// 5. AIRTABLE - URUN EKLEME
// ==========================================

async function addAirtableProductToCart(productId) {
    try {
        const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}/${productId}`, {
            headers: { Authorization: `Bearer ${API_KEY}` }
        });

        if (!response.ok) throw new Error('Urun bulunamadi');

        const productData = await response.json();
        const f = productData.fields;

        const cartItem = {
            id: productData.id,
            name: f.Name,
            price: parseFloat(f.Price) || 0,
            image: f.imageURL && f.imageURL[0] ? f.imageURL[0].url : '',
            variants: f.Variants || 'Standard',
            delivery: f.Delivery_time || '',
            quantity: 1
        };

        let cart = getCart();
        const existing = cart.find(i => i.id === productId);
        if (existing) {
            existing.quantity = (existing.quantity || 1) + 1;
        } else {
            cart.push(cartItem);
        }

        saveCart(cart);
        updateMiniCartUI();
        openMiniCart();

    } catch (error) {
        console.error('Urun ekleme hatasi:', error);
        alert('Urun sepete eklenirken bir hata olustu.');
    }
}

// ==========================================
// 6. MOBIL MENU
// ==========================================

function openMobileMenu() {
    const overlay = document.getElementById('mobile-menu-overlay');
    if (overlay) {
        overlay.classList.add('open');
        document.body.classList.add('no-scroll');
    }
}

function closeMobileMenu() {
    const overlay = document.getElementById('mobile-menu-overlay');
    if (overlay) {
        overlay.classList.remove('open');
        document.body.classList.remove('no-scroll');
    }
}

// ==========================================
// 7. EVENT LISTENERS
// ==========================================

// 🎯 GLOBAL FLAG: Listener'lar zaten bağlandıysa tekrar bağlama
let __commonListenersInitialized = false;

function initEventListeners() {
    if (__commonListenersInitialized) {
        console.log('⚠️ Event listenerlar zaten bağlı, atlanıyor.');
        return;
    }
    __commonListenersInitialized = true;

    console.log('✅ Event listenerlar başlatılıyor...');

    // SEPET ACMA
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#open-mini-cart-btn, .cart-icon-wrapper, .fa-shopping-bag');
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            openMiniCart();
        }
    });

    // SEPET KAPAMA (X butonu)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#close-mini-cart');
        if (btn) {
            e.stopPropagation();
            closeMiniCart();
        }
    });

    // MINI SEPET ICINDEKI BUTONLAR
    document.addEventListener('click', (e) => {
        const qtyBtn = e.target.closest('.quantity-btn');
        if (qtyBtn) {
            e.stopPropagation();
            const id = qtyBtn.dataset.id;
            const action = qtyBtn.dataset.action;
            if (id && action) {
                updateQuantity(id, action === 'increase' ? 1 : -1);
            }
            return;
        }

        const removeBtn = e.target.closest('.remove-item-btn');
        if (removeBtn) {
            e.stopPropagation();
            const id = removeBtn.dataset.id;
            if (id) removeFromCart(id);
            return;
        }
    });

    // OVERLAY'A TIKLAYINCA KAPAMA
    document.addEventListener('click', (e) => {
        if (e.target.id === 'mini-cart-overlay') {
            closeMiniCart();
        }
        if (e.target.id === 'mobile-menu-overlay') {
            closeMobileMenu();
        }
    });

    // MOBIL MENU
    document.addEventListener('click', (e) => {
        const openBtn = e.target.closest('#open-mobile-menu-btn');
        if (openBtn) {
            e.preventDefault();
            openMobileMenu();
        }
    });

    document.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('#close-mobile-menu');
        if (closeBtn) {
            closeMobileMenu();
        }
    });

    // ESC TUSU ILE KAPAMA
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMiniCart();
            closeMobileMenu();
        }
    });

    console.log('✅ Event listenerlar bağlandı');
}

// ==========================================
// 8. BASLATMA
// ==========================================

// 🎯 common.js kendi kendine başlatma YAPMAYACAK
// Başlatma, header.html yüklendikten sonra product.html'deki loadComponents() tarafından çağrılacak
// Bu, birden fazla kez çalışmayı engeller

console.log('📦 common.js yüklendi (başlatma bekleniyor...)');