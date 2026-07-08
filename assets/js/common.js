// ==========================================
// COMMON.JS - TEMEL FONKSIYONLAR (v8.2)
// Badge'ler her zaman calisacak - MutationObserver + Retry mekanizmasi
// Search fix: Fetch retry, hata yonetimi, cache kontrolu
// ==========================================

// ==========================================
// CACHE BUSTING
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

async function supabasePost(endpoint, data) {
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + endpoint, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const errText = await res.text();
        console.error('Supabase POST hata:', errText);
        throw new Error('Supabase POST hatasi: ' + res.status);
    }
    return res.json();
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

// GLOBAL: window'a ata, shadow edilmesin!
window.updateCartBadge = function() {
    const cart = getCart();
    const badges = document.querySelectorAll('.cart-count-badge');

    if (badges.length === 0) {
        console.warn('[Badge] .cart-count-badge elementi henuz DOM\'da yok, retry...');
        return false;
    }

    const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    badges.forEach(badge => {
        badge.textContent = count;
        badge.classList.toggle('visible', count > 0);
    });

    console.log('[Badge] Cart badge guncellendi:', count, 'urun');
    return true;
};

// GLOBAL: window'a ata, shadow edilmesin!
window.updateWishlistBadge = function() {
    try {
        const wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
        const badges = document.querySelectorAll('.wishlist-count-badge');

        if (badges.length === 0) {
            console.warn('[Badge] .wishlist-count-badge elementi henuz DOM\'da yok, retry...');
            return false;
        }

        badges.forEach(badge => {
            badge.textContent = wishlist.length;
            badge.classList.toggle('visible', wishlist.length > 0);
        });

        console.log('[Badge] Wishlist badge guncellendi:', wishlist.length, 'urun');
        return true;
    } catch (e) {
        console.error('[Badge] Wishlist badge hatasi:', e);
        return true;
    }
};

// ==========================================
// RACE CONDITION FIX: BADGE INIT SISTEMI
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
            console.log('[Badge] Init basarili! Deneme:', attempts);
            return;
        }

        if (attempts >= maxRetries) {
            console.warn('[Badge] Max retry asildi (' + maxRetries + '). Badge elementleri bulunamadi.');
            return;
        }

        console.log('[Badge] Retry ' + attempts + '/' + maxRetries + '...');
        setTimeout(tryInit, interval);
    }

    tryInit();
}

// ==========================================
// MUTATION OBSERVER: DOM degisikliklerini izle
// ==========================================

function observeBadgeElements() {
    const observer = new MutationObserver((mutations) => {
        const hasNewBadges = mutations.some(mutation => {
            return Array.from(mutation.addedNodes).some(node => {
                if (node.nodeType !== 1) return false;
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
// SEARCH POPUP - DUZELTILMIS v8.2
// ==========================================

let searchDebounceTimer = null;
let allProductsCache = [];
let isFetchingProducts = false;
let searchInputElement = null;
let searchResultsElement = null;

function getSearchElements() {
    searchInputElement = document.getElementById('live-search-input');
    searchResultsElement = document.getElementById('search-results-display');
    return { input: searchInputElement, results: searchResultsElement };
}

function initSearch() {
    const { input, results } = getSearchElements();

         if (!input) {
        console.warn('[Search] Input bulunamadi. Header yuklenince otomatik init edilecek.');
        // Sonsuz retry YOK - sadece bir kez dene
        return;
    }

    console.log('[Search] Input bulundu, listener baglaniyor...');

    // Eski listener varsa kaldirmak icin - inputu klonla ve yerine koy
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    searchInputElement = newInput;

    searchInputElement.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(searchDebounceTimer);

        if (query.length < 2) {
            if (searchResultsElement) searchResultsElement.style.display = 'none';
            return;
        }

        // Cache bossa once fetch et, sonra ara
        if (allProductsCache.length === 0 && !isFetchingProducts) {
            console.log('[Search] Cache bossa, once urunleri cekiyorum...');
            if (searchResultsElement) {
                searchResultsElement.innerHTML = '<div class="no-results-found">Laddar produkter...</div>';
                searchResultsElement.style.display = 'block';
            }
            fetchAllProductsForSearch().then(() => {
                performSearch(query);
            });
            return;
        }

        // Zaten fetch ediliyorsa bekle
        if (isFetchingProducts) {
            console.log('[Search] Urunler hala yukleniyor, bekleniyor...');
            if (searchResultsElement) {
                searchResultsElement.innerHTML = '<div class="no-results-found">Laddar produkter...</div>';
                searchResultsElement.style.display = 'block';
            }
            return;
        }

        searchDebounceTimer = setTimeout(() => {
            performSearch(query);
        }, 300);
    });

    // Input focus oldugunda da cache kontrolu yap
    searchInputElement.addEventListener('focus', () => {
        if (allProductsCache.length === 0 && !isFetchingProducts) {
            console.log('[Search] Focus - urunleri onceden cekiyorum...');
            fetchAllProductsForSearch();
        }
    });

    console.log('[Search] Listener basariyla baglandi!');
}

function openSearchPopup() {
    const popup = document.getElementById('search-popup-overlay');
    const input = document.getElementById('live-search-input');
    const resultsDisplay = document.getElementById('search-results-display');

    if (!popup) {
        console.error('[Search] Popup bulunamadi!');
        return;
    }

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = scrollbarWidth + 'px';
    document.body.classList.add('search-active');

    popup.classList.add('active');
    if (resultsDisplay) resultsDisplay.style.display = 'none';

    setTimeout(() => {
        if (input) {
            input.focus();
            // Popup acildiginda cache bossa fetch et
            if (allProductsCache.length === 0 && !isFetchingProducts) {
                fetchAllProductsForSearch();
            }
        }
    }, 300);
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
        console.error('[Search] Supabase config eksik! URL:', SUPABASE_URL, 'KEY var mi:', !!SUPABASE_KEY);
        return;
    }

    if (isFetchingProducts) {
        console.log('[Search] Zaten fetch ediliyor, atlaniyor...');
        return;
    }

    isFetchingProducts = true;
    console.log('[Search] Urunler Supabase\'den cekiliyor...');

    try {
        const data = await supabaseGet('products', {
            select: '*',
            active: 'eq.true'
        });

        console.log('[Search] Ham veri:', data);

        if (!data || !Array.isArray(data)) {
            console.error('[Search] Beklenmeyen veri formati:', data);
            allProductsCache = [];
            return;
        }

        allProductsCache = data.map(product => ({
            id: product.id,
            name: product.name || '',
            price: product.discount_price || product.base_price || 0,
            image: product.images && product.images[0] ? product.images[0] : '',
            category: product.category || '',
            url: '/matta/' + (product.slug || product.id)
        }));

        console.log('[Search] ' + allProductsCache.length + ' urun basariyla cachelendi');

    } catch (error) {
        console.error('[Search] Urun cache hatasi:', error);
        allProductsCache = [];
    } finally {
        isFetchingProducts = false;
    }
}

function performSearch(query) {
    const resultsDisplay = document.getElementById('search-results-display');
    if (!resultsDisplay) {
        console.error('[Search] Results display elementi bulunamadi!');
        return;
    }

    console.log('[Search] Arama yapiliyor:', query, 'Cache uzunlugu:', allProductsCache.length);

    if (allProductsCache.length === 0) {
        resultsDisplay.innerHTML = '<div class="no-results-found">Inga produkter tillgangliga. Forsok igen om en stund.</div>';
        resultsDisplay.style.display = 'block';
        // Tekrar fetch dene
        if (!isFetchingProducts) {
            fetchAllProductsForSearch();
        }
        return;
    }

    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) {
        resultsDisplay.style.display = 'none';
        return;
    }

    const filtered = allProductsCache.filter(product => {
        const nameMatch = product.name.toLowerCase().includes(lowerQuery);
        const catMatch = product.category.toLowerCase().includes(lowerQuery);
        return nameMatch || catMatch;
    });

    console.log('[Search] Filtrelenen:', filtered.length, 'urun');

    if (filtered.length === 0) {
        resultsDisplay.innerHTML = '<div class="no-results-found">Inga produkter hittades for "' + escapeHtml(query) + '".</div>';
    } else {
        resultsDisplay.innerHTML = filtered.slice(0, 8).map(product => {
            let highlightedName = escapeHtml(product.name);
            const idx = product.name.toLowerCase().indexOf(lowerQuery);
            if (idx !== -1) {
                highlightedName = escapeHtml(product.name.substring(0, idx)) +
                    '<mark style="background:#ffeb3b;color:#000;padding:0 2px;">' +
                    escapeHtml(product.name.substring(idx, idx + query.length)) +
                    '</mark>' +
                    escapeHtml(product.name.substring(idx + query.length));
            }

            return `<a href="${escapeHtml(product.url)}" class="search-item-row">
                <div class="search-item-image">
                    <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" onerror="this.src='https://via.placeholder.com/50'">
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

// XSS korumasi icin basit escape
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
        // Mini cart open - GENISLETILMIS SECICILER
        if (e.target.closest('#open-mini-cart-btn, .cart-icon-wrapper, .fa-shopping-bag, .cart-trigger, [data-action="open-cart"], .header-cart-icon')) {
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
        if (e.target.closest('#open-mobile-menu-btn, .mobile-menu-trigger, [data-action="open-menu"], .hamburger-btn')) {
            e.preventDefault();
            openMobileMenu();
            return;
        }

        // Mobile menu close
        if (e.target.closest('#close-mobile-menu')) {
            closeMobileMenu();
            return;
        }

        // Search open - GENISLETILMIS SECICILER
        if (e.target.closest('#search-open-btn, .search-trigger, [data-action="open-search"], .header-search-icon, .fa-magnifying-glass, .fa-search')) {
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
                'kok': 'Kok'
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
    console.log('Breadcrumb olusturuldu:', crumbs.map(c => c.name).join(' > '));
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
    initAll();
}

// Ek guvenlik: window.load'da da bir kez daha dene
window.addEventListener('load', () => {
    console.log('[Init] window.load eventi, badge kontrolu...');
    if (!window.__dkBadgeInitDone) {
        console.log('[Init] Badge init yapilmamis, retry baslatiliyor...');
        initBadgesWithRetry(10, 50);
    }
    // Search init kontrolu
    const input = document.getElementById('live-search-input');
    if (input && !input._searchInitialized) {
        console.log('[Init] Search init yapilmamis, retry baslatiliyor...');
        initSearch();
    }
});

console.log('common.js v8.2 yuklendi - Search fix aktif');
