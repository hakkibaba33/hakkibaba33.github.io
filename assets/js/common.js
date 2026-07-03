// ==========================================
// COMMON.JS - TEMIZLENMIS (v4)
// ==========================================

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
// 2. MINI SEPET
// ==========================================

function openMiniCart() {
    const overlay = document.getElementById('mini-cart-overlay');
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.classList.add('cart-open');
    updateMiniCartUI();
}

function closeMiniCart() {
    const overlay = document.getElementById('mini-cart-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.classList.remove('cart-open');
}

// ==========================================
// 3. SEARCH POPUP - DUZELTILMIS
// ==========================================

let searchDebounceTimer = null;
let allProductsCache = [];

function initSearch() {
    const popup = document.getElementById('search-popup-overlay');
    const input = document.getElementById('live-search-input');
    const closeBtn = document.getElementById('close-search-popup');
    const resultsDisplay = document.getElementById('search-results-display');

    if (!popup || !input) {
        console.warn('Search popup elementleri bulunamadi!');
        return;
    }

    // Açma butonları
    document.addEventListener('click', (e) => {
        const openBtn = e.target.closest('#search-open-btn');
        if (openBtn) {
            e.preventDefault();
            e.stopPropagation();
            openSearchPopup();
        }
    });

    // Kapatma butonu
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeSearchPopup();
        });
    }

    // Overlay'a tıklayınca kapat
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            closeSearchPopup();
        }
    });

    // ESC ile kapat
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && popup.classList.contains('active')) {
            closeSearchPopup();
        }
    });

    // Input dinleme
    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(searchDebounceTimer);
        
        if (query.length < 2) {
            if (resultsDisplay) resultsDisplay.style.display = 'none';
            return;
        }

        searchDebounceTimer = setTimeout(() => {
            performSearch(query);
        }, 300);
    });

    console.log('✅ Search popup baslatildi');
}

function openSearchPopup() {
    const popup = document.getElementById('search-popup-overlay');
    const input = document.getElementById('live-search-input');
    const resultsDisplay = document.getElementById('search-results-display');
    
    if (!popup) return;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = scrollbarWidth + 'px';
    document.body.classList.add('search-active');

    popup.classList.add('active');
    if (resultsDisplay) resultsDisplay.style.display = 'none';
    
    setTimeout(() => input?.focus(), 100);

    if (allProductsCache.length === 0) {
        fetchAllProductsForSearch();
    }
}

function closeSearchPopup() {
    const popup = document.getElementById('search-popup-overlay');
    const resultsDisplay = document.getElementById('search-results-display');
    
    if (!popup) return;

    popup.classList.remove('active');
    document.body.classList.remove('search-active');
    document.body.style.paddingRight = '';
    
    if (resultsDisplay) {
        resultsDisplay.style.display = 'none';
        resultsDisplay.innerHTML = '';
    }
    
    const input = document.getElementById('live-search-input');
    if (input) input.value = '';
}

async function fetchAllProductsForSearch() {
    if (!API_KEY || !BASE_ID) {
        console.error('Airtable config eksik!');
        return;
    }

    try {
        const response = await fetch(
            `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}?pageSize=100`,
            { headers: { Authorization: `Bearer ${API_KEY}` } }
        );

        if (!response.ok) throw new Error('Airtable hatasi');

        const data = await response.json();
        allProductsCache = data.records.map(record => ({
            id: record.id,
            name: record.fields.Name || '',
            price: parseFloat(record.fields.Price) || 0,
            image: record.fields.imageURL && record.fields.imageURL[0] ? record.fields.imageURL[0].url : '',
            category: record.fields.Category || '',
            url: `/product.html?id=${record.id}`
        }));

        console.log(`${allProductsCache.length} urun cache'lendi`);

    } catch (error) {
        console.error('Urun cache hatasi:', error);
    }
}

function performSearch(query) {
    const resultsDisplay = document.getElementById('search-results-display');
    if (!resultsDisplay) return;

    if (allProductsCache.length === 0) {
        resultsDisplay.innerHTML = '<div class="no-results-found">Laddar produkter...</div>';
        resultsDisplay.style.display = 'block';
        return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = allProductsCache.filter(product => 
        product.name.toLowerCase().includes(lowerQuery) ||
        product.category.toLowerCase().includes(lowerQuery)
    );

    if (filtered.length === 0) {
        resultsDisplay.innerHTML = '<div class="no-results-found">Inga produkter hittades.</div>';
    } else {
        resultsDisplay.innerHTML = filtered.slice(0, 8).map(product => `
            <a href="${product.url}" class="search-item-row">
                <div class="search-item-image">
                    <img src="${product.image}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/50'">
                </div>
                <div class="search-item-info">
                    <h4 class="search-item-title">${highlightMatch(product.name, query)}</h4>
                    <span class="search-item-price">${product.price.toFixed(2)} SEK</span>
                </div>
            </a>
        `).join('');
    }

    resultsDisplay.style.display = 'block';
}

function highlightMatch(text, query) {
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark style="background:#ffeb3b;color:#000;padding:0 2px;">$1</mark>');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ==========================================
// 4. MINI SEPET - ICERIK YONETIMI
// ==========================================

function updateMiniCartUI() {
    const cart = getCart();
    const emptyState = document.getElementById('cart-empty-state');
    const filledState = document.getElementById('cart-filled-state');
    const footer = document.getElementById('mini-cart-footer');

    if (!emptyState || !filledState || !footer) return;

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
// 5. URUN EKLEME
// ==========================================

function addProductToCart(productData) {
    let cart = getCart();
    const existing = cart.find(i => i.id === productData.id);

    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        cart.push({ ...productData, quantity: 1 });
    }

    saveCart(cart);
    updateMiniCartUI();
    openMiniCart();
}

// ==========================================
// 6. AIRTABLE - URUN EKLEME
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
// 7. MOBIL MENU
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
// 8. EVENT LISTENERS
// ==========================================

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

    // SEPET KAPAMA
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
            if (id && action) updateQuantity(id, action === 'increase' ? 1 : -1);
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
        if (e.target.id === 'mini-cart-overlay') closeMiniCart();
        if (e.target.id === 'mobile-menu-overlay') closeMobileMenu();
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
        if (closeBtn) closeMobileMenu();
    });

    // ESC TUSU
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMiniCart();
            closeMobileMenu();
            closeSearchPopup();
        }
    });

    // SEARCH POPUP'I BASLAT
    initSearch();

    console.log('✅ Event listenerlar bağlandı');
}

console.log('📦 common.js yüklendi (başlatma bekleniyor...)');