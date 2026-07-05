// ==========================================
// COMMON.JS - SUPABASE UYUMLU (v6.5 - SEARCH FIX v2)
// Eski Airtable yapısını koru, sadece API Supabase'e çevrildi
// ==========================================

// ==========================================
// CACHE BUSTING - Her yükleniste yeniden baslat
// ==========================================
window.__commonListenersInitialized = false;

if (typeof CONFIG === 'undefined') {
    console.error('HATA: config.js yuklenmemis!');
}

// SUPABASE CONFIG
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
// WISHLIST BADGE
// ==========================================

function updateWishlistBadge() {
    try {
        const wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
        const badge = document.querySelector('.wishlist-count-badge');
        if (badge) {
            badge.textContent = wishlist.length;
            badge.classList.toggle('visible', wishlist.length > 0);
        }
    } catch (e) {
        console.error('Wishlist badge hatasi:', e);
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
// 3. SEARCH POPUP - SUPABASE UYUMLU (FIXED v2)
// ==========================================

let searchDebounceTimer = null;
let allProductsCache = [];

function initSearch() {
    const popup = document.getElementById('search-popup-overlay');
    const input = document.getElementById('live-search-input');
    const resultsDisplay = document.getElementById('search-results-display');

    if (!popup || !input) {
        console.warn('Search popup elementleri bulunamadi!');
        return;
    }

    console.log('Search popup init basladi');

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

    console.log('Search popup baslatildi');
}

function openSearchPopup() {
    const popup = document.getElementById('search-popup-overlay');
    const input = document.getElementById('live-search-input');
    const resultsDisplay = document.getElementById('search-results-display');

    if (!popup) {
        console.error('Search popup bulunamadi!');
        return;
    }

    console.log('Search popup aciliyor...');

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
    console.log('closeSearchPopup cagrildi');
    const popup = document.getElementById('search-popup-overlay');
    const resultsDisplay = document.getElementById('search-results-display');

    if (!popup) {
        console.warn('Search popup kapatilirken bulunamadi');
        return;
    }

    popup.classList.remove('active');
    document.body.classList.remove('search-active');
    document.body.style.paddingRight = '';

    if (resultsDisplay) {
        resultsDisplay.style.display = 'none';
        resultsDisplay.innerHTML = '';
    }

    const input = document.getElementById('live-search-input');
    if (input) input.value = '';

    console.log('Search popup kapandi');
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
            // Highlight
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

        const html = cart.map(item => {
            const qty = item.quantity || 1;
            const itemTotal = item.price * qty;
            total += itemTotal;
            // ID'yi string olarak yazdir (int8 uyumluluk)
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
        console.warn('updateQuantity: Urun bulunamadi, ID:', productId, 'Cart IDs:', cart.map(c => c.id));
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

// ==========================================
// 5. URUN EKLEME
// ==========================================

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

// ==========================================
// 6. SUPABASE - URUN EKLEME (SEPETE)
// ==========================================

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
// 8. EVENT LISTENERS - TUMU DOCUMENT SEVIYESINDE
// ==========================================
// ONEMLI: Tüm event listener'lar document seviyesinde.
// Bu sayede dinamik olarak eklenen elementler de calisir.
// ==========================================

function initEventListeners() {
    console.log('initEventListeners CAGIRILDI, __commonListenersInitialized:', window.__commonListenersInitialized);
    if (window.__commonListenersInitialized) {
        console.log('Event listenerlar zaten bagli, atlaniyor.');
        return;
    }
    window.__commonListenersInitialized = true;

    console.log('Event listenerlar baslatiliyor...');

    // --- 1. GENEL TIKLAMALAR (Açma/Kapama/Menü/Arama/Search Kapama) ---
    document.addEventListener('click', (e) => {
        console.log('DOCUMENT CLICK:', e.target.tagName, e.target.id, e.target.className);

        // Mini sepet açma
        if (e.target.closest('#open-mini-cart-btn, .cart-icon-wrapper, .fa-shopping-bag')) {
            e.preventDefault();
            openMiniCart();
            return;
        }

        // Mini sepet kapama
        if (e.target.closest('#close-mini-cart')) {
            closeMiniCart();
            return;
        }

        // Mobil menü açma
        if (e.target.closest('#open-mobile-menu-btn')) {
            e.preventDefault();
            openMobileMenu();
            return;
        }

        // Mobil menü kapama
        if (e.target.closest('#close-mobile-menu')) {
            closeMobileMenu();
            return;
        }

        // Overlay'lara tıklama
        if (e.target.id === 'mini-cart-overlay') {
            closeMiniCart();
            return;
        }
        if (e.target.id === 'mobile-menu-overlay') {
            closeMobileMenu();
            return;
        }

        // Arama popup açma
        const searchOpen = e.target.closest('#search-open-btn');
        if (searchOpen) {
            e.preventDefault();
            openSearchPopup();
            return;
        }

        // Search popup KAPATMA - X butonu
        const searchClose = e.target.closest('#close-search-popup');
        if (searchClose) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Search X butonu tiklandi (document delegation)');
            closeSearchPopup();
            return;
        }

        // Search popup KAPATMA - overlay/bos alan
        const searchOverlay = document.getElementById('search-popup-overlay');
        if (searchOverlay && e.target === searchOverlay) {
            console.log('Search overlaya tiklandi (document delegation)');
            closeSearchPopup();
            return;
        }
    });

    // --- 2. MINI SEPET İÇİ İŞLEMLER (Document seviyesinde delegation) ---
    document.addEventListener('click', (e) => {
        const filledState = document.getElementById('cart-filled-state');
        if (!filledState) return;

        // Tıklanan element filledState içinde mi kontrol et
        if (!filledState.contains(e.target)) return;

        const removeBtn = e.target.closest('.remove-item-btn');
        const qtyBtn = e.target.closest('.quantity-btn');

        if (removeBtn) {
            const id = removeBtn.getAttribute('data-id');
            console.log("Mini sepet: Silme tetiklendi, ID:", id, 'tip:', typeof id);
            if (id) {
                e.stopPropagation();
                removeFromCart(id);
            }
        } else if (qtyBtn) {
            const id = qtyBtn.getAttribute('data-id');
            const action = qtyBtn.getAttribute('data-action');
            console.log("Mini sepet: Miktar değişimi tetiklendi, ID:", id, 'tip:', typeof id, "Aksiyon:", action);
            if (id && action) {
                e.stopPropagation();
                updateQuantity(id, action === 'increase' ? 1 : -1);
            }
        }
    });

    console.log('Mini sepet event listenerlari document seviyesine baglandi.');

    // --- 3. ESC TUSU ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMiniCart();
            closeMobileMenu();
            closeSearchPopup();
        }
    });

    initSearch();
    updateWishlistBadge();
    console.log('Tum event listenerlar basariyla baglandi!');
}


// ==========================================
// OTOMATIK BASLATMA
// ==========================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEventListeners);
} else {
    initEventListeners();
}

console.log('common.js yuklendi ve baslatildi');







// ========== DINAMIK BREADCRUMB ==========

function generateBreadcrumb() {
    const breadcrumbNav = document.getElementById('breadcrumb-nav');
    if (!breadcrumbNav) return;

    const urlParams = new URLSearchParams(window.location.search);
    const kategori = urlParams.get('kategori');
    const pageName = document.title.replace(' | DKRUG', '').trim();

    // Breadcrumb yapılandırması (her sayfa için özelleştirilebilir)
    const breadcrumbs = [
        { name: 'Hem', url: 'index.html' },
        { name: 'Mattor', url: 'category.html' }
    ];

    // Aktif kategori varsa ekle
    if (kategori) {
        const kategoriNames = {
            'vardagsrum': 'Vardagsrum',
            'sovrum': 'Sovrum',
            'kok': 'Kök'
        };
        breadcrumbs.push({
            name: kategoriNames[kategori] || kategori,
            url: `category.html?kategori=${kategori}`
        });
    }

    // HTML oluştur
    let html = '<ol class="breadcrumb-list">';
    breadcrumbs.forEach((item, index) => {
        const isLast = index === breadcrumbs.length - 1;
        if (isLast) {
            html += `<li class="breadcrumb-item active" aria-current="page">${item.name}</li>`;
        } else {
            html += `<li class="breadcrumb-item"><a href="${item.url}">${item.name}</a></li>`;
        }
    });
    html += '</ol>';

    breadcrumbNav.innerHTML = html;
}

// Sayfa yüklendiğinde çalıştır
document.addEventListener('DOMContentLoaded', generateBreadcrumb);
