// ==========================================
// COMMON.JS - SUPABASE UYUMLU (v6.7 - FULL FIX)
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
            let highlightedName = product.name;
            const idx = product.name.toLowerCase().indexOf(lowerQuery);
            if (idx !== -1) {
                highlightedName = product.name.substring(0, idx) + 
                    '<mark style="background:#ffeb3b;color:#000;padding:0 2px;">' + 
                    product.name.substring(idx, idx + query.length) + 
                    '</mark>' + 
                    product.name.substring(idx + query.length);
            }

            return '<a href="' + product.url + '" class="search-item-row">' +
                '<div class="search-item-image">' +
                    '<img src="' + product.image + '" alt="' + product.name + '" onerror="this.src='https://via.placeholder.com/50'">' +
                '</div>' +
                '<div class="search-item-info">' +
                    '<h4 class="search-item-title">' + highlightedName + '</h4>' +
                    '<span class="search-item-price">' + product.price.toLocaleString('sv-SE') + ' SEK</span>' +
                '</div>' +
            '</a>';
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
            const itemId = String(item.id);
            return '<div class="mini-cart-item" data-id="' + itemId + '">' +
                '<img src="' + (item.image || '') + '" alt="' + (item.name || '') + '" class="item-image" onerror="this.style.display='none'">' +
                '<div class="item-details-left">' +
                    '<span class="item-name">' + (item.name || 'Urun') + '</span>' +
                    '<span class="item-variant">' + (item.variants || 'Standard') + '</span>' +
                    '<div class="quantity-control">' +
                        '<button type="button" class="quantity-btn minus" data-id="' + itemId + '" data-action="decrease">-</button>' +
                        '<input type="text" class="quantity-input" value="' + qty + '" readonly>' +
                        '<button type="button" class="quantity-btn plus" data-id="' + itemId + '" data-action="increase">+</button>' +
                    '</div>' +
                '</div>' +
                '<div class="item-price-right">' +
                    '<span class="item-price">' + itemTotal.toLocaleString('sv-SE') + ' SEK</span>' +
                    '<button type="button" class="remove-item-btn" data-id="' + itemId + '">Ta bort</button>' +
                '</div>' +
            '</div>';
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
        const newItem = Object.assign({}, productData, { quantity: 1 });
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

function initEventListeners() {
    console.log('initEventListeners CAGIRILDI, __commonListenersInitialized:', window.__commonListenersInitialized);
    if (window.__commonListenersInitialized) {
        console.log('Event listenerlar zaten bagli, atlaniyor.');
        return;
    }
    window.__commonListenersInitialized = true;

    console.log('Event listenerlar baslatiliyor...');

    document.addEventListener('click', (e) => {
        console.log('DOCUMENT CLICK:', e.target.tagName, e.target.id, e.target.className);

        if (e.target.closest('#open-mini-cart-btn, .cart-icon-wrapper, .fa-shopping-bag')) {
            e.preventDefault();
            openMiniCart();
            return;
        }

        if (e.target.closest('#close-mini-cart')) {
            closeMiniCart();
            return;
        }

        if (e.target.closest('#open-mobile-menu-btn')) {
            e.preventDefault();
            openMobileMenu();
            return;
        }

        if (e.target.closest('#close-mobile-menu')) {
            closeMobileMenu();
            return;
        }

        if (e.target.id === 'mini-cart-overlay') {
            closeMiniCart();
            return;
        }
        if (e.target.id === 'mobile-menu-overlay') {
            closeMobileMenu();
            return;
        }

        const searchOpen = e.target.closest('#search-open-btn');
        if (searchOpen) {
            e.preventDefault();
            openSearchPopup();
            return;
        }

        const searchClose = e.target.closest('#close-search-popup');
        if (searchClose) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Search X butonu tiklandi (document delegation)');
            closeSearchPopup();
            return;
        }

        const searchOverlay = document.getElementById('search-popup-overlay');
        if (searchOverlay && e.target === searchOverlay) {
            console.log('Search overlaya tiklandi (document delegation)');
            closeSearchPopup();
            return;
        }
    });

    document.addEventListener('click', (e) => {
        const filledState = document.getElementById('cart-filled-state');
        if (!filledState) return;
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
            console.log("Mini sepet: Miktar degisimi tetiklendi, ID:", id, 'tip:', typeof id, "Aksiyon:", action);
            if (id && action) {
                e.stopPropagation();
                updateQuantity(id, action === 'increase' ? 1 : -1);
            }
        }
    });

    console.log('Mini sepet event listenerlari document seviyesine baglandi.');

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

// ============================================
// BREADCRUMB - HEMEN CALISTIR
// ============================================

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
    }
    else if (path.includes('product') || document.getElementById('product-main-name-desktop')) {
        crumbs.push({ name: 'Alla Mattor', url: '/category.html' });
        const productName = document.getElementById('product-main-name-desktop')?.textContent?.trim();
        crumbs.push({ name: (productName && productName !== '---') ? productName : 'Produkt', url: '#' });
    }

    let html = '<ol class="breadcrumb-list">';
    crumbs.forEach((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        if (isLast) {
            html += '<li class="active">' + crumb.name + '</li>';
        } else {
            html += '<li><a href="' + crumb.url + '">' + crumb.name + '</a></li>';
        }
    });
    html += '</ol>';

    nav.innerHTML = html;
    console.log('Breadcrumb olusturuldu:', crumbs.map(c => c.name).join(' > '));
})();


// ============================================
// MODERN PRODUCT CAROUSEL SYSTEM (v1.0)
// Tum sayfalarda kullanilabilir
// ============================================

function isInWishlist(productId) {
    try {
        const wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
        return wishlist.some(item => 
            (typeof item === 'string' ? item : String(item.id)) === String(productId)
        );
    } catch (e) {
        return false;
    }
}

function createProductCard(product, isWishlisted) {
    const hasDiscount = product.discount_price && product.discount_price < product.base_price;

    let priceHTML;
    if (hasDiscount) {
        priceHTML = '<span class="original-price" style="text-decoration:line-through;color:#999;font-size:14px;">' + product.base_price.toLocaleString('sv-SE') + ' SEK</span>' +
           '<span class="current-price" style="color:#e54d42;">' + product.price.toLocaleString('sv-SE') + ' SEK</span>';
    } else {
        priceHTML = '<span class="current-price">' + product.price.toLocaleString('sv-SE') + ' SEK</span>';
    }

    const variantText = product.variants && product.variants.length > 1 
        ? product.variants.length + ' storlekar' 
        : (product.variants && product.variants[0] ? product.variants[0].size : 'Standard');

    const productUrl = product.slug ? '/matta/' + product.slug : '/matta/' + product.id;

    let colorsHTML = '';
    if (product.colors && product.colors.length > 0) {
        let swatches = '';
        for (let j = 0; j < Math.min(5, product.colors.length); j++) {
            swatches += '<span class="swatch-circle" style="background-color:' + product.colors[j] + ';" title="' + product.colors[j] + '"></span>';
        }
        colorsHTML = '<div class="product-colors-wrapper">' +
            '<div class="product-colors-swatches">' + swatches + '</div>' +
            (product.colors.length > 5 ? '<span class="color-count-text">+' + (product.colors.length - 5) + ' farger</span>' : '') +
        '</div>';
    }

    return '<div class="product-card" data-id="' + product.id + '">' +
        '<div class="image-box">' +
            '<a href="' + productUrl + '">' +
                '<img src="' + product.image + '" alt="' + product.name + '" loading="lazy" onerror="this.style.display='none'">' +
            '</a>' +
            (hasDiscount ? '<span class="discount-badge">REA</span>' : '') +
            '<button class="wishlist-btn ' + (isWishlisted ? 'active' : '') + '" data-product-id="' + product.id + '" aria-label="Lagg till favoriter">' +
                '<i class="' + (isWishlisted ? 'fa-solid' : 'fa-regular') + ' fa-heart"></i>' +
            '</button>' +
        '</div>' +
        '<div class="product-info">' +
            '<h3 class="product-title">' + product.name + '</h3>' +
            '<div class="product-meta-row">' +
                '<span class="product-acf-dimension">' + variantText + '</span>' +
            '</div>' +
            '<div class="product-price">' + priceHTML + '</div>' +
            colorsHTML +
        '</div>' +
    '</div>';
}

function createCarouselSlide(product, isWishlisted) {
    return '<div class="product-slide">' + createProductCard(product, isWishlisted) + '</div>';
}

function renderProductCarousel(trackId, products, options) {
    options = options || {};
    const track = document.getElementById(trackId);
    if (!track || !products || products.length === 0) {
        console.warn('Carousel track bulunamadi veya urun yok: ' + trackId);
        return;
    }

    const settings = Object.assign({
        showWishlist: true,
        showQuickAdd: false
    }, options);

    track.innerHTML = products.map(function(p) {
        const isWishlisted = settings.showWishlist ? isInWishlist(p.id) : false;
        return createCarouselSlide(p, isWishlisted);
    }).join('');

    if (settings.showWishlist) {
        attachCarouselWishlistEvents(track);
    }

    track.querySelectorAll('.product-card').forEach(function(card) {
        card.addEventListener('click', function(e) {
            if (e.target.closest('.wishlist-btn')) return;
            const id = card.dataset.id;
            const product = products.find(function(p) { return p.id === id; });
            if (product) {
                window.location.href = product.slug ? '/matta/' + product.slug : '/matta/' + id;
            }
        });
    });

    return track;
}

function attachCarouselWishlistEvents(container) {
    container.querySelectorAll('.wishlist-btn').forEach(function(btn) {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const productId = newBtn.dataset.productId;
            const product = findProductInCarousel(container, productId);

            if (!product) return;

            let wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
            const index = wishlist.findIndex(function(item) {
                return (typeof item === 'string' ? item : String(item.id)) === String(productId);
            });

            const icon = newBtn.querySelector('i');

            if (index > -1) {
                wishlist.splice(index, 1);
                newBtn.classList.remove('active');
                icon.className = 'fa-regular fa-heart';
                console.log('Favorilerden kaldirildi:', product.name);
            } else {
                wishlist.push({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.image
                });
                newBtn.classList.add('active');
                icon.className = 'fa-solid fa-heart';
                console.log('Favorilere eklendi:', product.name);
            }

            localStorage.setItem('wishlistItems', JSON.stringify(wishlist));
            if (typeof updateWishlistBadge === 'function') {
                updateWishlistBadge();
            }
        });
    });
}

function findProductInCarousel(container, productId) {
    const card = container.querySelector('.product-card[data-id="' + productId + '"]');
    if (!card) return null;

    return {
        id: productId,
        name: card.querySelector('.product-title')?.textContent || '',
        price: 0,
        image: card.querySelector('img')?.src || ''
    };
}

class ProductCarousel {
    constructor(wrapperId, trackId, options) {
        options = options || {};
        this.wrapper = document.getElementById(wrapperId);
        this.track = document.getElementById(trackId);
        if (!this.wrapper || !this.track) {
            console.warn('Carousel elementleri bulunamadi: ' + wrapperId + ', ' + trackId);
            return;
        }

        this.options = Object.assign({
            showDots: true,
            showArrows: true,
            showScrollHint: true,
            slidesToShow: 'auto'
        }, options);

        this.currentIndex = 0;
        this.slides = [];
        this.init();
    }

    init() {
        this.slides = this.track.querySelectorAll('.product-slide');
        if (this.slides.length === 0) {
            console.warn('Slide bulunamadi');
            return;
        }

        this.createNavigation();
        this.bindEvents();
        this.updateDots();
    }

    createNavigation() {
        if (this.options.showArrows && window.innerWidth > 768) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'carousel-nav prev';
            prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
            prevBtn.setAttribute('aria-label', 'Foregaende');

            const nextBtn = document.createElement('button');
            nextBtn.className = 'carousel-nav next';
            nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            nextBtn.setAttribute('aria-label', 'Nasta');

            this.wrapper.appendChild(prevBtn);
            this.wrapper.appendChild(nextBtn);

            prevBtn.addEventListener('click', () => this.scrollTo('prev'));
            nextBtn.addEventListener('click', () => this.scrollTo('next'));
        }

        if (this.options.showDots) {
            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'carousel-dots';

            for (let i = 0; i < this.slides.length; i++) {
                const dot = document.createElement('button');
                dot.className = 'carousel-dot';
                dot.setAttribute('aria-label', 'Ga till produkt ' + (i + 1));
                if (i === 0) dot.classList.add('active');
                dot.addEventListener('click', () => this.scrollToIndex(i));
                dotsContainer.appendChild(dot);
            }

            this.wrapper.appendChild(dotsContainer);
            this.dots = dotsContainer.querySelectorAll('.carousel-dot');
        }

        if (this.options.showScrollHint && window.innerWidth <= 768) {
            const hint = document.createElement('div');
            hint.className = 'scroll-hint';
            hint.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Svep for att se mer <i class="fa-solid fa-arrow-right"></i>';
            this.wrapper.appendChild(hint);

            this.track.addEventListener('scroll', () => {
                hint.style.opacity = '0';
                setTimeout(() => hint.remove(), 500);
            }, { once: true });
        }
    }

    bindEvents() {
        let scrollTimeout;
        this.track.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => this.updateDots(), 50);
        });

        let startX, scrollLeft;
        this.track.addEventListener('touchstart', (e) => {
            startX = e.touches[0].pageX - this.track.offsetLeft;
            scrollLeft = this.track.scrollLeft;
        }, { passive: true });

        this.track.addEventListener('touchmove', (e) => {
            const x = e.touches[0].pageX - this.track.offsetLeft;
            const walk = (x - startX) * 1.5;
            this.track.scrollLeft = scrollLeft - walk;
        }, { passive: true });
    }

    scrollTo(direction) {
        const slideWidth = this.slides[0].offsetWidth + 16;
        const scrollAmount = direction === 'next' ? slideWidth : -slideWidth;
        this.track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }

    scrollToIndex(index) {
        const slide = this.slides[index];
        if (slide) {
            slide.scrollIntoView({ behavior: 'smooth', inline: 'start' });
        }
    }

    updateDots() {
        if (!this.dots || this.dots.length === 0) return;

        const scrollLeft = this.track.scrollLeft;
        const slideWidth = this.slides[0].offsetWidth + 16;
        const newIndex = Math.min(
            Math.round(scrollLeft / slideWidth),
            this.dots.length - 1
        );

        this.dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === newIndex);
        });
    }
}

async function fetchProductsForCarousel(params) {
    params = params || {};
    try {
        const defaultParams = Object.assign({
            select: '*',
            active: 'eq.true',
            limit: 25
        }, params);

        const products = await supabaseGet('products', defaultParams);
        const variants = await supabaseGet('product_variants', { select: '*' });

        return products.map(function(p) {
            return {
                id: p.id,
                name: p.name || 'Urun',
                price: p.discount_price || p.base_price || 0,
                base_price: p.base_price || 0,
                discount_price: p.discount_price || null,
                image: p.images && p.images[0] ? p.images[0] : '',
                slug: p.slug || '',
                colors: p.colors || [],
                variants: variants.filter(function(v) { return v.product_id === p.id; }),
                sizes: variants.filter(function(v) { return v.product_id === p.id; }).map(function(v) { return v.size; }),
                stock: variants.filter(function(v) { return v.product_id === p.id; }).some(function(v) { return v.stock > 0; }) 
                    ? 'In Stock' 
                    : 'Out of Stock',
                delivery_time: p.delivery_time || '3-7 arbetsdagar'
            };
        });

    } catch (error) {
        console.error('Urun cekme hatasi:', error);
        return [];
    }
}

async function initRelatedProducts(productId, category) {
    const products = await fetchProductsForCarousel({
        category: category ? 'eq.' + category : undefined,
        limit: 25
    });

    const filtered = products.filter(function(p) { return p.id !== productId; });

    renderProductCarousel('related-carousel-track', filtered);

    new ProductCarousel('related-carousel-wrapper', 'related-carousel-track', {
        showDots: true,
        showArrows: true,
        showScrollHint: true
    });
}

async function initBestSellers() {
    const products = await fetchProductsForCarousel({
        limit: 20,
        order: 'sales.desc.nullslast'
    });

    renderProductCarousel('bestseller-carousel-track', products);

    new ProductCarousel('bestseller-carousel-wrapper', 'bestseller-carousel-track', {
        showDots: true,
        showArrows: true,
        showScrollHint: true
    });
}

async function initPopular() {
    const products = await fetchProductsForCarousel({
        limit: 20,
        order: 'views.desc.nullslast'
    });

    renderProductCarousel('popular-carousel-track', products);

    new ProductCarousel('popular-carousel-wrapper', 'popular-carousel-track', {
        showDots: true,
        showArrows: false,
        showScrollHint: true
    });
}

function initRecentlyViewed() {
    const items = JSON.parse(localStorage.getItem('recentlyViewed')) || [];
    if (items.length < 2) {
        const el = document.getElementById('recently-viewed-section');
        if (el) el.style.display = 'none';
        return;
    }

    renderProductCarousel('recent-carousel-track', items);

    new ProductCarousel('recent-carousel-wrapper', 'recent-carousel-track', {
        showDots: true,
        showArrows: false,
        showScrollHint: false
    });
}

console.log('Product Carousel System yuklendi');
