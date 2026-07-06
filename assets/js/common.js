// ==========================================
// COMMON.JS - SUPABASE UYUMLU (v7.2 - RACE CONDITION FIX)
// Badge'ler her zaman çalışacak - MutationObserver + Retry mekanizması
// ==========================================

// ==========================================
// CACHE BUSTING (Sadece event listenerlar için)
// ==========================================
window.__commonListenersInitialized = false;

if (typeof CONFIG === 'undefined') {
    console.error('HATA: config.js yuklenmemis!');
}

// ==========================================
// SUPABASE CONFIG
// ==========================================
const SUPABASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE) ? CONFIG.SUPABASE.URL : '';
const SUPABASE_KEY = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE) ? CONFIG.SUPABASE.ANON_KEY : '';

// ==========================================
// SUPABASE CLIENT
// ==========================================

async function supabaseGet(endpoint, params) {
    const url = new URL(SUPABASE_URL + '/rest/v1/' + endpoint);
    if (params) {
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    }

    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        const errText = await res.text();
        console.error('Supabase hata detayi:', errText);
        throw new Error('Supabase GET hatasi: ' + res.status);
    }
    return res.json();
}

async function supabaseGetOne(endpoint, filter) {
    const data = await supabaseGet(endpoint, filter);
    return data[0] || null;
}

// ==========================================
// YARDIMCI: ID karsilastirma (int8/string uyumlu)
// ==========================================
function idsMatch(id1, id2) {
    return String(id1) === String(id2);
}

// ==========================================
// CART & WISHLIST - GLOBAL FONKSIYONLAR
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
    window.updateCartBadge();
}

// 🔥 GLOBAL: window'a ata, shadow edilmesin!
window.updateCartBadge = function() {
    const cart = getCart();
    const badges = document.querySelectorAll('.cart-count-badge');

    if (badges.length === 0) {
        console.warn('[Badge] .cart-count-badge elementi henuz DOM\'da yok, retry...');
        return false; // Retry gerekiyor
    }

    const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    badges.forEach(badge => {
        badge.textContent = count;
        badge.classList.toggle('visible', count > 0);
    });

    console.log('[Badge] Cart badge guncellendi:', count, 'urun');
    return true;
};

// 🔥 GLOBAL: window'a ata, shadow edilmesin!
window.updateWishlistBadge = function() {
    try {
        const wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
        const badges = document.querySelectorAll('.wishlist-count-badge');

        if (badges.length === 0) {
            console.warn('[Badge] .wishlist-count-badge elementi henuz DOM\'da yok, retry...');
            return false; // Retry gerekiyor
        }

        badges.forEach(badge => {
            badge.textContent = wishlist.length;
            badge.classList.toggle('visible', wishlist.length > 0);
        });

        console.log('[Badge] Wishlist badge guncellendi:', wishlist.length, 'urun');
        return true;
    } catch (e) {
        console.error('[Badge] Wishlist badge hatasi:', e);
        return true; // Hata durumunda retry yapma
    }
};

// ==========================================
// 🔥 RACE CONDITION FIX: BADGE INIT SISTEMI
// ==========================================

window.__dkBadgeInitDone = false;

function initBadgesWithRetry(maxRetries = 20, interval = 100) {
    if (window.__dkBadgeInitDone) {
        console.log('[Badge] Init zaten tamamlandi, atlaniyor.');
        return;
    }

    let attempts = 0;

    function tryInit() {
        attempts++;

        const cartOk = window.updateCartBadge();
        const wishOk = window.updateWishlistBadge();

        if (cartOk && wishOk) {
            window.__dkBadgeInitDone = true;
            console.log('[Badge] ✅ Init basarili! Deneme:', attempts);
            return;
        }

        if (attempts >= maxRetries) {
            console.warn('[Badge] ⚠️ Max retry asildi (' + maxRetries + '). Badge elementleri bulunamadi.');
            console.warn('[Badge] HTML\'de .cart-count-badge ve .wishlist-count-badge elementleri var mi kontrol et!');
            return;
        }

        console.log('[Badge] Retry ' + attempts + '/' + maxRetries + '...');
        setTimeout(tryInit, interval);
    }

    tryInit();
}

// ==========================================
// 🔥 MUTATION OBSERVER: DOM degisikliklerini izle
// ==========================================

function observeBadgeElements() {
    const observer = new MutationObserver((mutations) => {
        // Badge elementleri yeni eklendiyse, badge'leri guncelle
        const hasNewBadges = mutations.some(mutation => {
            return Array.from(mutation.addedNodes).some(node => {
                if (node.nodeType !== 1) return false; // Element degilse atla
                return node.querySelector && (
                    node.querySelector('.cart-count-badge') ||
                    node.querySelector('.wishlist-count-badge') ||
                    node.classList?.contains('cart-count-badge') ||
                    node.classList?.contains('wishlist-count-badge')
                );
            });
        });

        if (hasNewBadges && !window.__dkBadgeInitDone) {
            console.log('[Badge] Yeni badge elementleri tespit edildi, init calistiriliyor...');
            initBadgesWithRetry();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('[Badge] MutationObserver baslatildi.');
    return observer;
}

// ==========================================
// MINI CART - OPEN / CLOSE / UPDATE
// ==========================================

function openMiniCart() {
    const overlay = document.getElementById('mini-cart-overlay');
    const drawer = document.getElementById('mini-cart-drawer');
    if (!overlay || !drawer) return;
    overlay.classList.add('active');
    drawer.classList.add('active');
    document.body.classList.add('cart-open');
    document.body.style.overflow = 'hidden';
    updateMiniCartUI();
}

function closeMiniCart() {
    const overlay = document.getElementById('mini-cart-overlay');
    const drawer = document.getElementById('mini-cart-drawer');
    if (!overlay || !drawer) return;
    overlay.classList.remove('active');
    drawer.classList.remove('active');
    document.body.classList.remove('cart-open');
    document.body.style.overflow = '';
}

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
        footer.style.display = 'flex';

        let total = 0;

        const html = cart.map(item => {
            const qty = item.quantity || 1;
            const itemTotal = item.price * qty;
            total += itemTotal;
            const itemId = String(item.id);
            return `<div class="mini-cart-item" data-id="${itemId}">
                <img src="${item.image || ''}" alt="${item.name || ''}" class="item-image" onerror="this.style.display='none'">
                <div class="item-details-left">
                    <span class="item-name">${item.name || 'Urun'}</span>
                    <span class="item-variant">${item.variants || 'Standard'}</span>
                    <div class="quantity-control">
                        <button type="button" class="quantity-btn minus" data-id="${itemId}" data-action="decrease">-</button>
                        <input type="text" class="quantity-input" value="${qty}" readonly>
                        <button type="button" class="quantity-btn plus" data-id="${itemId}" data-action="increase">+</button>
                    </div>
                </div>
                <div class="item-price-right">
                    <span class="item-price">${itemTotal.toLocaleString('sv-SE')} SEK</span>
                    <button type="button" class="remove-item-btn" data-id="${itemId}">Ta bort</button>
                </div>
            </div>`;
        }).join('');

        filledState.innerHTML = html;

        const grandTotal = document.getElementById('cart-grand-total');
        if (grandTotal) grandTotal.textContent = total.toLocaleString('sv-SE') + ' SEK';
    }
}

function updateQuantity(productId, change) {
    let cart = getCart();
    const item = cart.find(i => idsMatch(i.id, productId));
    if (!item) {
        console.warn('updateQuantity: Urun bulunamadi, ID:', productId);
        return;
    }

    item.quantity = (item.quantity || 1) + change;
    if (item.quantity <= 0) {
        cart = cart.filter(i => !idsMatch(i.id, productId));
    }
    saveCart(cart);
    updateMiniCartUI();
}

function removeFromCart(productId) {
    let cart = getCart().filter(i => !idsMatch(i.id, productId));
    saveCart(cart);
    updateMiniCartUI();
}

function addProductToCart(productData) {
    let cart = getCart();
    const existing = cart.find(i => idsMatch(i.id, productData.id) && i.variants === productData.variants);

    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        const newItem = { ...productData, quantity: 1 };
        cart.push(newItem);
    }

    saveCart(cart);
    updateMiniCartUI();
    openMiniCart();
}

async function addSupabaseProductToCart(productId, variantSize) {
    try {
        const product = await supabaseGetOne('products', {
            id: 'eq.' + productId
        });

        if (!product) throw new Error('Urun bulunamadi');

        const variants = await supabaseGet('product_variants', {
            product_id: 'eq.' + productId
        });

        let displayPrice = product.discount_price || product.base_price || 0;
        if (variantSize && variants.length > 0) {
            const variant = variants.find(v => v.size === variantSize);
            if (variant) {
                displayPrice = variant.discount_price || variant.price || displayPrice;
            }
        }

        const variantLabel = variantSize || 'Standard';

        const cartItem = {
            id: product.id,
            name: product.name,
            price: displayPrice,
            image: product.images && product.images[0] ? product.images[0] : '',
            variants: variantLabel,
            delivery: product.delivery_time || '3-7 arbetsdagar',
            quantity: 1
        };

        let cart = getCart();
        const existing = cart.find(i => idsMatch(i.id, productId) && i.variants === variantLabel);
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
// SEARCH POPUP
// ==========================================

let searchDebounceTimer = null;
let allProductsCache = [];

function initSearch() {
    const input = document.getElementById('live-search-input');
    const resultsDisplay = document.getElementById('search-results-display');

    if (!input) {
        console.warn('Search input bulunamadi!');
        return;
    }

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
}

function openSearchPopup() {
    const popup = document.getElementById('search-popup-overlay');
    const input = document.getElementById('live-search-input');
    const resultsDisplay = document.getElementById('search-results-display');

    if (!popup) {
        console.error('Search popup bulunamadi!');
        return;
    }

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = scrollbarWidth + 'px';
    document.body.classList.add('search-active');

    popup.classList.add('active');
    if (resultsDisplay) resultsDisplay.style.display = 'none';

    setTimeout(() => { if (input) input.focus(); }, 100);

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
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Supabase config eksik!');
        return;
    }

    try {
        const data = await supabaseGet('products', {
            select: '*',
            active: 'eq.true'
        });

        allProductsCache = data.map(product => ({
            id: product.id,
            name: product.name || '',
            price: product.discount_price || product.base_price || 0,
            image: product.images && product.images[0] ? product.images[0] : '',
            category: product.category || '',
            url: '/matta/' + (product.slug || product.id)
        }));

        console.log(allProductsCache.length + ' urun cachelendi');

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
        resultsDisplay.innerHTML = filtered.slice(0, 8).map(product => {
            let highlightedName = product.name;
            const idx = product.name.toLowerCase().indexOf(lowerQuery);
            if (idx !== -1) {
                highlightedName = product.name.substring(0, idx) +
                    '<mark style="background:#ffeb3b;color:#000;padding:0 2px;">' +
                    product.name.substring(idx, idx + query.length) +
                    '</mark>' +
                    product.name.substring(idx + query.length);
            }

            return `<a href="${product.url}" class="search-item-row">
                <div class="search-item-image">
                    <img src="${product.image}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/50'">
                </div>
                <div class="search-item-info">
                    <h4 class="search-item-title">${highlightedName}</h4>
                    <span class="search-item-price">${product.price.toLocaleString('sv-SE')} SEK</span>
                </div>
            </a>`;
        }).join('');
    }

    resultsDisplay.style.display = 'block';
}

// ==========================================
// MOBILE MENU
// ==========================================

function openMobileMenu() {
    const overlay = document.getElementById('mobile-menu-overlay');
    const drawer = document.getElementById('mobile-menu-drawer');
    if (overlay) overlay.classList.add('active');
    if (drawer) drawer.classList.add('active');
    document.body.classList.add('no-scroll');
    document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
    const overlay = document.getElementById('mobile-menu-overlay');
    const drawer = document.getElementById('mobile-menu-drawer');
    if (overlay) overlay.classList.remove('active');
    if (drawer) drawer.classList.remove('active');
    document.body.classList.remove('no-scroll');
    document.body.style.overflow = '';
}

// ==========================================
// HEADER SCROLL EFFECT
// ==========================================

function initHeaderScroll() {
    const header = document.getElementById('main-header');
    if (!header) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

// ==========================================
// EVENT LISTENERS - TEK BIR YERDE
// ==========================================

function initEventListeners() {
    console.log('initEventListeners CAGIRILDI, __commonListenersInitialized:', window.__commonListenersInitialized);
    if (window.__commonListenersInitialized) {
        console.log('Event listenerlar zaten bagli, atlaniyor.');
        return;
    }
    window.__commonListenersInitialized = true;

    console.log('Event listenerlar baslatiliyor...');

    // --- Header scroll effect ---
    initHeaderScroll();

    // --- Document-level click delegation ---
    document.addEventListener('click', (e) => {
        // Mini cart open
        if (e.target.closest('#open-mini-cart-btn, .cart-icon-wrapper, .fa-shopping-bag')) {
            e.preventDefault();
            openMiniCart();
            return;
        }

        // Mini cart close
        if (e.target.closest('#close-mini-cart')) {
            closeMiniCart();
            return;
        }

        // Mobile menu open
        if (e.target.closest('#open-mobile-menu-btn')) {
            e.preventDefault();
            openMobileMenu();
            return;
        }

        // Mobile menu close
        if (e.target.closest('#close-mobile-menu')) {
            closeMobileMenu();
            return;
        }

        // Search open
        if (e.target.closest('#search-open-btn')) {
            e.preventDefault();
            openSearchPopup();
            return;
        }

        // Search close (X button)
        if (e.target.closest('#close-search-popup')) {
            e.preventDefault();
            e.stopPropagation();
            closeSearchPopup();
            return;
        }

        // Overlay clicks
        if (e.target.id === 'mini-cart-overlay') {
            closeMiniCart();
            return;
        }
        if (e.target.id === 'mobile-menu-overlay') {
            closeMobileMenu();
            return;
        }
        if (e.target.id === 'search-popup-overlay') {
            closeSearchPopup();
            return;
        }
    });

    // --- Mini cart item actions (delegation) ---
    document.addEventListener('click', (e) => {
        const filledState = document.getElementById('cart-filled-state');
        if (!filledState || !filledState.contains(e.target)) return;

        const removeBtn = e.target.closest('.remove-item-btn');
        const qtyBtn = e.target.closest('.quantity-btn');

        if (removeBtn) {
            const id = removeBtn.getAttribute('data-id');
            if (id) {
                e.stopPropagation();
                removeFromCart(id);
            }
        } else if (qtyBtn) {
            const id = qtyBtn.getAttribute('data-id');
            const action = qtyBtn.getAttribute('data-action');
            if (id && action) {
                e.stopPropagation();
                updateQuantity(id, action === 'increase' ? 1 : -1);
            }
        }
    });

    // --- ESC key ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMiniCart();
            closeMobileMenu();
            closeSearchPopup();
        }
    });

    // --- Init search ---
    initSearch();

    console.log('Tum event listenerlar basariyla baglandi!');
}

// ==========================================
// BREADCRUMB
// ==========================================

(function() {
    if (window.innerWidth <= 768) return;

    const nav = document.getElementById('breadcrumb-nav');
    if (!nav) return;

    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    const crumbs = [{ name: 'Hem', url: '/' }];

    if (path.includes('category') || path.includes('kategori') || document.getElementById('category-main-title')) {
        crumbs.push({ name: 'Alla Mattor', url: '/category.html' });
        const cat = urlParams.get('kategori');
        if (cat) {
            const catNames = {
                'vardagsrum': 'Vardagsrum',
                'sovrum': 'Sovrum',
                'kok': 'Kök'
            };
            crumbs.push({ name: catNames[cat] || cat, url: '#' });
        }
    } else if (path.includes('product') || document.getElementById('product-main-name-desktop')) {
        crumbs.push({ name: 'Alla Mattor', url: '/category.html' });
        const productName = document.getElementById('product-main-name-desktop')?.textContent?.trim();
        crumbs.push({ name: (productName && productName !== '---') ? productName : 'Produkt', url: '#' });
    }

    let html = '<ol class="breadcrumb-list">';
    crumbs.forEach((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        html += isLast
            ? `<li class="active">${crumb.name}</li>`
            : `<li><a href="${crumb.url}">${crumb.name}</a></li>`;
    });
    html += '</ol>';

    nav.innerHTML = html;
    console.log('✅ Breadcrumb oluşturuldu:', crumbs.map(c => c.name).join(' > '));
})();

// ==========================================
// OTOMATIK BASLATMA - RACE CONDITION FIX
// ==========================================

function initAll() {
    console.log('[Init] common.js initAll baslatiliyor...');

    // 1. Event listenerlar (cache flag kontrollu)
    initEventListeners();

    // 2. Badge'ler (HER ZAMAN, flag'den bagimsiz)
    initBadgesWithRetry();

    // 3. MutationObserver (DOM degisikliklerini izle)
    observeBadgeElements();

    console.log('[Init] common.js initAll tamamlandi.');
}

// Sayfa yuklenme durumuna gore baslat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
} else {
    // DOM zaten yuklenmis, hemen baslat
    initAll();
}

// Ek guvenlik: window.load'da da bir kez daha dene
window.addEventListener('load', () => {
    console.log('[Init] window.load eventi, badge kontrolu...');
    if (!window.__dkBadgeInitDone) {
        console.log('[Init] Badge init yapilmamis, retry baslatiliyor...');
        initBadgesWithRetry(10, 50);
    }
});

console.log('common.js v7.2 yuklendi - Race Condition Fix aktif');





// ==========================================
// DKRUG CHATBOT - API'siz + Supabase Entegre
// v1.0 - info@dekorist.se | +46763016775
// ==========================================

(function() {
    'use strict';
    
    // ==========================================
    // KONFIGURASYON
    // ==========================================
    
    const CONFIG = {
        email: 'info@dekorist.se',
        phone: '+46763016775',
        phoneDisplay: '076-301 67 75',
        workHours: 'vardagar 9-17',
        freeShippingThreshold: 500,
        deliveryDays: '3-7 arbetsdagar',
        returnDays: 30,
        maxMessages: 50  // Bellek temizliği için
    };
    
    // ==========================================
    // SUPABASE BAGLANTISI (Mevcut config.js'den)
    // ==========================================
    
    const SUPABASE_URL = (typeof window.CONFIG !== 'undefined' && window.CONFIG.SUPABASE) 
        ? window.CONFIG.SUPABASE.URL 
        : '';
    const SUPABASE_KEY = (typeof window.CONFIG !== 'undefined' && window.CONFIG.SUPABASE) 
        ? window.CONFIG.SUPABASE.ANON_KEY 
        : '';
    
    // ==========================================
    // URUN VERISI CACHE
    // ==========================================
    
    let productsCache = [];
    let categoriesCache = [];
    let isProductsLoaded = false;
    
    async function loadProducts() {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            console.warn('[Chatbot] Supabase config bulunamadi');
            return;
        }
        
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&active=eq.true`, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });
            
            if (!res.ok) throw new Error('Supabase hatasi');
            
            productsCache = await res.json();
            categoriesCache = [...new Set(productsCache.map(p => p.category).filter(Boolean))];
            isProductsLoaded = true;
            
            console.log(`[Chatbot] ${productsCache.length} urun yuklendi`);
            
        } catch (err) {
            console.error('[Chatbot] Urun yukleme hatasi:', err);
        }
    }
    
    // Sayfa yuklenince urunleri cek
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadProducts);
    } else {
        loadProducts();
    }
    
    // ==========================================
    // CHATBOT MOTORU
    // ==========================================
    
    const ChatEngine = {
        // Anahtar kelime -> Niyet eslestirmesi
        patterns: {
            // Selamlasma
            'hej|hallå|tjena|merhaba|hey|hi|hello': 'greeting',
            
            // Urun arama
            'matta|kilim|halı|rug|carpet|vardagsrum|sovrum|kok|persisk|orientalisk|modern': 'product_search',
            
            // Fiyat
            'pris|kostar|hur mycket|fiyat|price|billig|dyr': 'price',
            
            // Stok
            'lager|finns|stock|tilgänglig|slut|var finns': 'stock',
            
            // Olcu/Size
            'storlek|ölçü|size|dimension|cm|meter|bredd|längd|200x300|160x230': 'size',
            
            // Malzeme
            'material|ull|bomull|silke|skötsel|tvätt|rengöring|wool|cotton|silk': 'material',
            
            // Kargo/Teslimat
            'leverans|frakt|kargo|shipping|när kommer|leveranstid|fri frakt': 'shipping',
            
            // Iade/Degisim
            'retur|iade|return|ångra|byta|öppet köp|ångerrätt': 'return',
            
            // Odeme
            'betal|payment|faktura|klarna|swish|kort|visa|mastercard': 'payment',
            
            // Iletisim
            'kontakt|telefon|mail|support|människa|ringa|maila|reach': 'contact',
            
            // Magaza/Hakkimizda
            'butik|magaza|om oss|hakkimizda|företag|dream kilim|dekorist': 'about',
            
            // Kampanya/Indirim
            'rea|rabatt|kampanj|indirim|erbjudande|outlet': 'campaign'
        },
        
        // Kullanici mesajini analiz et
        analyze(message) {
            const lower = message.toLowerCase().trim();
            
            // Direkt eslesme
            for (const [pattern, intent] of Object.entries(this.patterns)) {
                const regex = new RegExp(pattern, 'i');
                if (regex.test(lower)) return { intent, query: lower };
            }
            
            // Urun ismi mi? (Supabase'den kontrol)
            if (isProductsLoaded) {
                const matchedProduct = this.findProduct(lower);
                if (matchedProduct) {
                    return { intent: 'product_detail', product: matchedProduct };
                }
            }
            
            return { intent: 'unknown', query: lower };
        },
        
        // Urun ara
        findProduct(query) {
            return productsCache.find(p => {
                const name = (p.name || '').toLowerCase();
                const slug = (p.slug || '').toLowerCase();
                const category = (p.category || '').toLowerCase();
                const desc = (p.description || '').toLowerCase();
                
                return name.includes(query) || 
                       slug.includes(query) || 
                       category.includes(query) ||
                       desc.includes(query);
            });
        },
        
        // Kategoriye gore urun bul
        findByCategory(category) {
            return productsCache.filter(p => {
                const cat = (p.category || '').toLowerCase();
                return cat.includes(category.toLowerCase());
            });
        },
        
        // Fiyat araligina gore urun bul
        findByPrice(maxPrice) {
            return productsCache.filter(p => {
                const price = p.discount_price || p.base_price || 0;
                return price <= maxPrice;
            }).sort((a, b) => (a.discount_price || a.base_price) - (b.discount_price || b.base_price));
        }
    };
    
    // ==========================================
    // YANIT GENERATORU
    // ==========================================
    
    const ResponseBuilder = {
        
        greeting() {
            return `
                <strong>Hej! 👋 Välkommen till Dream Kilim!</strong><br><br>
                Jag kan hjälpa dig med:<br>
                • 🔍 <em>Hitta mattor</em> (skriv t.ex. "vardagsrum" eller "persisk")<br>
                • 📏 <em>Storlekar och mått</em><br>
                • 🚚 <em>Leverans och returer</em><br>
                • 💰 <em>Priser och betalning</em><br><br>
                <em style="font-size:12px;opacity:0.7;">Vad letar du efter?</em>
            `;
        },
        
        product_search(data) {
            if (!isProductsLoaded) {
                return 'Ursäkt, produktdatabasen laddar fortfarande. Försök igen om en stund!';
            }
            
            const query = data.query;
            let results = [];
            
            // Kategori ara
            const categoryMatches = ChatEngine.findByCategory(query);
            if (categoryMatches.length > 0) results = categoryMatches;
            
            // Isim ara
            if (results.length === 0) {
                results = productsCache.filter(p => {
                    const name = (p.name || '').toLowerCase();
                    return name.includes(query) || query.includes(name);
                });
            }
            
            if (results.length === 0) {
                return `
                    Jag hittade inga mattor som matchar "<em>${query}</em>".<br><br>
                    Prova med: <em>vardagsrum</em>, <em>sovrum</em>, <em>persisk</em>, <em>modern</em><br>
                    Eller se alla våra mattor <a href="/category.html" style="color:var(--dk-accent);">här →</a>
                `;
            }
            
            // En fazla 5 urun goster
            const display = results.slice(0, 5);
            const hasMore = results.length > 5;
            
            return `
                <strong>Hittade ${results.length} mattor:</strong><br><br>
                ${display.map(p => {
                    const price = (p.discount_price || p.base_price || 0).toLocaleString('sv-SE');
                    const img = p.images && p.images[0] ? p.images[0] : '';
                    return `
                        <div style="display:flex;gap:10px;margin-bottom:10px;align-items:center;">
                            ${img ? `<img src="${img}" style="width:50px;height:67px;object-fit:cover;border-radius:4px;">` : ''}
                            <div>
                                <a href="/matta/${p.slug}" style="color:var(--dk-accent);font-weight:600;">${p.name}</a><br>
                                <span style="font-size:13px;">${price} SEK</span>
                                ${p.discount_price && p.base_price ? `<span style="font-size:12px;text-decoration:line-through;opacity:0.6;margin-left:5px;">${p.base_price.toLocaleString('sv-SE')} SEK</span>` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
                ${hasMore ? `<br><em>...och ${results.length - 5} till. <a href="/category.html" style="color:var(--dk-accent);">Se alla →</a></em>` : ''}
            `;
        },
        
        product_detail(data) {
            const p = data.product;
            const price = (p.discount_price || p.base_price || 0).toLocaleString('sv-SE');
            const oldPrice = p.base_price && p.discount_price ? p.base_price.toLocaleString('sv-SE') : null;
            const img = p.images && p.images[0] ? p.images[0] : '';
            const variants = p.variants || [];
            const sizes = variants.map(v => v.size).join(', ') || 'Standard';
            const inStock = variants.some(v => v.stock > 0);
            
            return `
                <div style="display:flex;gap:12px;margin-bottom:12px;">
                    ${img ? `<img src="${img}" style="width:80px;height:107px;object-fit:cover;border-radius:8px;border:1px solid var(--dk-border);">` : ''}
                    <div>
                        <strong style="font-size:15px;">${p.name}</strong><br>
                        <span style="font-size:18px;font-weight:700;color:var(--dk-accent);">${price} SEK</span>
                        ${oldPrice ? `<span style="font-size:14px;text-decoration:line-through;opacity:0.6;margin-left:8px;">${oldPrice} SEK</span>` : ''}<br>
                        <span style="font-size:13px;color:var(--dk-text-light);">${p.category || ''}</span>
                    </div>
                </div>
                <div style="background:var(--dk-secondary);padding:10px 14px;border-radius:8px;margin:10px 0;">
                    <strong>Storlekar:</strong> ${sizes}<br>
                    <strong>Lagerstatus:</strong> ${inStock ? '✅ I lager' : '❌ Slut i lager'}<br>
                    <strong>Leverans:</strong> ${CONFIG.deliveryDays}
                </div>
                ${p.description ? `<p style="font-size:13px;line-height:1.5;margin:10px 0;">${p.description.substring(0, 150)}${p.description.length > 150 ? '...' : ''}</p>` : ''}
                <a href="/matta/${p.slug}" style="display:inline-block;background:var(--dk-accent);color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:5px;">Se produkt →</a>
            `;
        },
        
        price() {
            if (!isProductsLoaded || productsCache.length === 0) {
                return `
                    Våra mattor varierar beroende på storlek, material och ursprung:<br><br>
                    • <strong>Små mattor</strong> (80x150 cm): från 1 500 SEK<br>
                    • <strong>Medel</strong> (160x230 cm): från 3 500 SEK<br>
                    • <strong>Stora</strong> (200x300 cm): från 5 500 SEK<br>
                    • <strong>Persiska/Orientaliska</strong>: från 8 000 SEK<br><br>
                    <em>🎁 Fri frakt vid köp över ${CONFIG.freeShippingThreshold} SEK!</em><br>
                    <a href="/category.html" style="color:var(--dk-accent);">Se alla priser →</a>
                `;
            }
            
            // Gercek fiyat araligini goster
            const prices = productsCache.map(p => p.discount_price || p.base_price || 0).filter(p => p > 0);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
            
            // En ucuz 3 urun
            const cheapest = [...productsCache]
                .sort((a, b) => (a.discount_price || a.base_price) - (b.discount_price || b.base_price))
                .slice(0, 3);
            
            return `
                <strong>Vårt prisspann:</strong><br>
                <div style="font-size:24px;font-weight:700;color:var(--dk-accent);margin:10px 0;">
                    ${minPrice.toLocaleString('sv-SE')} – ${maxPrice.toLocaleString('sv-SE')} SEK
                </div>
                <em>Genomsnittligt pris: ${avgPrice.toLocaleString('sv-SE')} SEK</em><br><br>
                
                <strong>Bästa erbjudanden just nu:</strong><br>
                ${cheapest.map(p => `
                    • <a href="/matta/${p.slug}" style="color:var(--dk-accent);">${p.name}</a> — 
                    <strong>${(p.discount_price || p.base_price).toLocaleString('sv-SE')} SEK</strong>
                    ${p.discount_price ? `<span style="text-decoration:line-through;opacity:0.6;font-size:12px;">${p.base_price.toLocaleString('sv-SE')}</span>` : ''}
                `).join('<br>')}<br><br>
                
                <em>🎁 Fri frakt över ${CONFIG.freeShippingThreshold} SEK!</em>
            `;
        },
        
        stock() {
            if (!isProductsLoaded) {
                return 'Lagerstatus uppdateras... Försök igen om en stund!';
            }
            
            const inStock = productsCache.filter(p => {
                const variants = p.variants || [];
                return variants.some(v => v.stock > 0);
            });
            
            const lowStock = productsCache.filter(p => {
                const variants = p.variants || [];
                return variants.some(v => v.stock > 0 && v.stock <= 3);
            });
            
            return `
                <strong>Lagerstatus:</strong><br>
                • <strong>${inStock.length}</strong> mattor finns i lager<br>
                • <strong>${lowStock.length}</strong> produkter är lågt i lager (högst 3 kvar)<br><br>
                
                ${lowStock.length > 0 ? `
                    <strong>⚡ Sista chansen:</strong><br>
                    ${lowStock.slice(0, 3).map(p => `
                        • <a href="/matta/${p.slug}" style="color:var(--dk-accent);">${p.name}</a>
                    `).join('<br>')}
                    <br><br>
                ` : ''}
                
                <em>Vill du se en specifik matta? Skriv namnet!</em>
            `;
        },
        
        size() {
            return `
                <strong>Vanliga mattstorlekar:</strong><br><br>
                
                <div style="background:var(--dk-secondary);padding:12px;border-radius:8px;margin:8px 0;">
                    <strong>🛋️ Vardagsrum</strong><br>
                    • 200×300 cm (soffgrupp)<br>
                    • 160×230 cm (mindre rum)<br>
                    • 300×400 cm (stora rum)
                </div>
                
                <div style="background:var(--dk-secondary);padding:12px;border-radius:8px;margin:8px 0;">
                    <strong>🛏️ Sovrum</strong><br>
                    • 80×150 cm (sängkant)<br>
                    • 120×170 cm (under sängen)
                </div>
                
                <div style="background:var(--dk-secondary);padding:12px;border-radius:8px;margin:8px 0;">
                    <strong>🍽️ Kök/Matplats</strong><br>
                    • 80×200 cm (löpare)<br>
                    • 140×200 cm (matbord)
                </div>
                
                <br><em>💡 Tips: Mät ditt rum och lägg till 20 cm på varje sida om möjligt!</em><br>
                <em>Vill du ha hjälp att välja storlek? Beskriv ditt rum!</em>
            `;
        },
        
        material() {
            return `
                <strong>Våra material:</strong><br><br>
                
                <strong>🐑 Ull</strong><br>
                • Varmt, hållbart, naturligt smutsavvisande<br>
                • Idealiskt för: Vardagsrum, sovrum<br><br>
                
                <strong>🌿 Bomull</strong><br>
                • Mjukt, lättskött, maskintvättbart<br>
                • Idealiskt för: Kök, barnrum<br><br>
                
                <strong>✨ Silke/Bambu</strong><br>
                • Lyxigt skimmer, svalt, allergivänligt<br>
                • Idealiskt för: Sovrum, gästrum<br><br>
                
                <strong>🧵 Syntet</strong><br>
                • Budgetvänligt, färgstarkt, lättskött<br>
                • Idealiskt för: Uterum, hemmakontor<br><br>
                
                <em>🧼 Skötselråd: Dammsug regelbundet, tvätta vid fläckar, undvik direkt solljus.</em>
            `;
        },
        
        shipping() {
            return `
                <strong>🚚 Leveransinformation:</strong><br><br>
                
                <div style="background:var(--dk-secondary);padding:14px;border-radius:8px;">
                    <strong>Fri frakt</strong> vid köp över <strong>${CONFIG.freeShippingThreshold} SEK</strong> 🎁<br>
                    Under ${CONFIG.freeShippingThreshold} SEK: 79 SEK i frakt
                </div><br>
                
                <strong>Leveranstid:</strong> ${CONFIG.deliveryDays}<br>
                <strong>Leveransalternativ:</strong><br>
                • Hemleverans till dörren<br>
                • Ombud (närmaste utlämningsställe)<br><br>
                
                <strong>Spåra din beställning:</strong><br>
                Du får ett spårningsnummer via e-post när din matta skickas.<br><br>
                
                <em>📦 Alla mattor rullas professionellt för att undvika veck.</em>
            `;
        },
        
        return() {
            return `
                <strong>🔄 Retur & Byte:</strong><br><br>
                
                <div style="background:#e8f5e9;padding:14px;border-radius:8px;border-left:4px solid #4caf50;">
                    <strong>${CONFIG.returnDays} dagars öppet köp</strong> ✅<br>
                    Helt nöjd eller pengarna tillbaka!
                </div><br>
                
                <strong>Så här returnerar du:</strong><br>
                1. Kontakta oss på <a href="mailto:${CONFIG.email}" style="color:var(--dk-accent);">${CONFIG.email}</a><br>
                2. Vi skickar en retursedel<br>
                3. Packa mattan i originalförpackning<br>
                4. Lämna på närmaste ombud<br><br>
                
                <strong>Observera:</strong><br>
                • Mattan måste vara oanvänd och i originalskick<br>
                • Specialbeställningar (måttanpassade) kan ej returneras<br>
                • Returfrakt betalas av köparen (om inte felexpedierat)<br><br>
                
                <em>Har du frågor? Vi hjälper dig gärna! 😊</em>
            `;
        },
        
        payment() {
            return `
                <strong>💳 Betalningsalternativ:</strong><br><br>
                
                <div style="display:flex;flex-direction:column;gap:10px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:24px;">💸</span>
                        <div><strong>Swish</strong> — Direktbetalning, snabbast</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:24px;">💳</span>
                        <div><strong>Kortbetalning</strong> — Visa, Mastercard, Maestro</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:24px;">📋</span>
                        <div><strong>Faktura</strong> — Via Klarna (14 eller 30 dagar)</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:24px;">📅</span>
                        <div><strong>Delbetalning</strong> — Klarna, 3-36 månader</div>
                    </div>
                </div><br>
                
                <em>🔒 Alla betalningar är säkra och krypterade med SSL.</em>
            `;
        },
        
        contact() {
            return `
                <strong>📞 Kontakta oss:</strong><br><br>
                
                <div style="background:var(--dk-secondary);padding:16px;border-radius:8px;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                        <span style="font-size:20px;">📧</span>
                        <div>
                            <strong>E-post</strong><br>
                            <a href="mailto:${CONFIG.email}" style="color:var(--dk-accent);font-size:15px;">${CONFIG.email}</a>
                        </div>
                    </div>
                    
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                        <span style="font-size:20px;">📱</span>
                        <div>
                            <strong>Telefon/SMS</strong><br>
                            <a href="tel:${CONFIG.phone}" style="color:var(--dk-accent);font-size:15px;">${CONFIG.phoneDisplay}</a>
                        </div>
                    </div>
                    
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:20px;">🕐</span>
                        <div>
                            <strong>Öppettider</strong><br>
                            ${CONFIG.workHours}
                        </div>
                    </div>
                </div><br>
                
                <em>Vi svarar vanligtvis inom 2 timmar under öppettider!</em><br>
                <em>För brådskande ärenden, ring oss gärna.</em>
            `;
        },
        
        about() {
            return `
                <strong>🏛️ Om Dream Kilim (Dekorist)</strong><br><br>
                
                Vi är en svensk familjeägd mattbutik med rötter i Anatolien. Sedan 2015 förmedlar vi handknutna och vävda mattor direkt från producenterna till ditt hem.<br><br>
                
                <strong>Vår filosofi:</strong><br>
                • Äkta hantverk till rimliga priser<br>
                • Rättvis handel med vävare<br>
                • Hållbart sortiment<br>
                • Personlig service<br><br>
                
                <strong>Vårt lager:</strong> Stockholm<br>
                <strong>Frakt:</em> Hela Sverige<br><br>
                
                <em>"Varje matta har en historia. Vi hjälper dig hitta din."</em> 🧡
            `;
        },
        
        campaign() {
            // Aktif kampanyalari Supabase'den cek
            const onSale = productsCache.filter(p => p.discount_price && p.base_price && p.discount_price < p.base_price);
            
            if (onSale.length === 0) {
                return `
                    <strong>Just nu har vi inga aktiva kampanjer.</strong><br><br>
                    Men missa inte våra <a href="/category.html" style="color:var(--dk-accent);">bästsäljare</a>!<br><br>
                    <em>🎁 Tips: Anmäl dig till vårt nyhetsbrev för exklusiva erbjudanden.</em>
                `;
            }
            
            const bestDeals = onSale
                .sort((a, b) => ((b.base_price - b.discount_price) / b.base_price) - ((a.base_price - a.discount_price) / a.base_price))
                .slice(0, 3);
            
            return `
                <strong>🔥 Aktuella erbjudanden:</strong><br><br>
                ${bestDeals.map(p => {
                    const discount = Math.round(((p.base_price - p.discount_price) / p.base_price) * 100);
                    return `
                        <div style="background:#fff3e0;padding:12px;border-radius:8px;margin-bottom:10px;border-left:4px solid #ff9800;">
                            <a href="/matta/${p.slug}" style="color:var(--dk-accent);font-weight:600;">${p.name}</a><br>
                            <span style="font-size:20px;font-weight:700;">${p.discount_price.toLocaleString('sv-SE')} SEK</span>
                            <span style="text-decoration:line-through;opacity:0.6;margin-left:8px;">${p.base_price.toLocaleString('sv-SE')} SEK</span>
                            <span style="background:#ff9800;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;margin-left:8px;">-${discount}%</span>
                        </div>
                    `;
                }).join('')}<br>
                
                <a href="/category.html" style="color:var(--dk-accent);">Se alla reamattor →</a>
            `;
        },
        
        unknown() {
            return `
                <em>Ursäkt, jag förstod inte riktigt. 😅</em><br><br>
                
                Jag kan hjälpa dig med:<br>
                • 🏠 <em>Hitta mattor</em> — skriv t.ex. "vardagsrum" eller "persisk"<br>
                • 📏 <em>Storleksguide</em><br>
                • 🚚 <em>Leveransinfo</em><br>
                • 💰 <em>Priser</em><br>
                • 📞 <em>Kontakta oss</em><br><br>
                
                <strong>Eller nå oss direkt:</strong><br>
                📧 <a href="mailto:${CONFIG.email}" style="color:var(--dk-accent);">${CONFIG.email}</a><br>
                📱 <a href="tel:${CONFIG.phone}" style="color:var(--dk-accent);">${CONFIG.phoneDisplay}</a>
            `;
        }
    };
    
    // ==========================================
    // CHAT Arayuzu
    // ==========================================
    
    const ChatUI = {
        trigger: null,
        window: null,
        messages: null,
        input: null,
        typing: null,
        isOpen: false,
        messageCount: 0,
        
        init() {
            this.trigger = document.getElementById('chat-trigger');
            this.window = document.getElementById('chat-window');
            this.messages = document.getElementById('chat-messages');
            this.input = document.getElementById('chat-input');
            this.typing = document.getElementById('chat-typing');
            
            if (!this.trigger || !this.window) {
                console.warn('[Chatbot] HTML elementleri bulunamadi');
                return;
            }
            
            // Event listeners
            this.trigger.addEventListener('click', () => this.toggle());
            document.getElementById('close-chat')?.addEventListener('click', () => this.close());
            document.getElementById('send-chat')?.addEventListener('click', () => this.send());
            this.input?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.send();
            });
            
            // ESC ile kapat
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) this.close();
            });
            
            console.log('[Chatbot] Hazir!');
        },
        
        toggle() {
            this.isOpen = !this.isOpen;
            this.window.classList.toggle('active', this.isOpen);
            this.trigger.classList.toggle('hidden', this.isOpen);
            if (this.isOpen) {
                this.input?.focus();
                // İlk acilista mesaj yoksa selam ver
                if (this.messageCount === 0) {
                    this.addBotMessage(ResponseBuilder.greeting());
                }
            }
        },
        
        close() {
            this.isOpen = false;
            this.window.classList.remove('active');
            this.trigger.classList.remove('hidden');
        },
        
        async send() {
            const text = this.input?.value.trim();
            if (!text) return;
            
            // Kullanici mesaji
            this.addUserMessage(text);
            this.input.value = '';
            
            // Bellek temizligi
            this.messageCount++;
            if (this.messageCount > CONFIG.maxMessages) {
                this.clearOldMessages();
            }
            
            // AI "yaziyor" animasyonu
            this.showTyping(true);
            
            // Yanit olustur (kucuk gecikme ile dogal his)
            await new Promise(r => setTimeout(r, 600 + Math.random() * 800));
            
            const analysis = ChatEngine.analyze(text);
            let response;
            
            if (analysis.intent === 'product_detail' && analysis.product) {
                response = ResponseBuilder.product_detail(analysis);
            } else if (ResponseBuilder[analysis.intent]) {
                response = ResponseBuilder[analysis.intent](analysis);
            } else {
                response = ResponseBuilder.unknown();
            }
            
            this.showTyping(false);
            this.addBotMessage(response);
        },
        
        addUserMessage(text) {
            const div = document.createElement('div');
            div.className = 'user-msg';
            div.textContent = text;
            this.messages.appendChild(div);
            this.scrollToBottom();
        },
        
        addBotMessage(html) {
            const div = document.createElement('div');
            div.className = 'bot-msg';
            div.innerHTML = html;
            this.messages.appendChild(div);
            this.scrollToBottom();
        },
        
        showTyping(show) {
            if (this.typing) {
                this.typing.style.display = show ? 'flex' : 'none';
                if (show) this.scrollToBottom();
            }
        },
        
        scrollToBottom() {
            if (this.messages) {
                this.messages.scrollTop = this.messages.scrollHeight;
            }
        },
        
        clearOldMessages() {
            // Son 20 mesaji tut
            const allMsgs = this.messages.querySelectorAll('.bot-msg, .user-msg');
            if (allMsgs.length > 20) {
                for (let i = 0; i < allMsgs.length - 20; i++) {
                    allMsgs[i].remove();
                }
            }
            this.messageCount = 20;
        }
    };
    
    // Baslat
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ChatUI.init());
    } else {
        ChatUI.init();
    }
    
})();
