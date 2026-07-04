// ==========================================
// COMMON.JS - SUPABASE UYUMLU (v5.1)
// ==========================================

if (typeof CONFIG === 'undefined') {
    console.error('HATA: config.js yuklenmemis!');
}

var SUPABASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE) ? CONFIG.SUPABASE.URL : '';
var SUPABASE_KEY = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE) ? CONFIG.SUPABASE.ANON_KEY : '';

// ==========================================
// SUPABASE CLIENT
// ==========================================

async function supabaseGet(endpoint, params) {
    var url = new URL(SUPABASE_URL + '/rest/v1/' + endpoint);
    if (params) {
        Object.keys(params).forEach(function(key) {
            url.searchParams.append(key, params[key]);
        });
    }

    var res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        var errText = await res.text();
        console.error('Supabase hata detayi:', errText);
        throw new Error('Supabase GET hatasi: ' + res.status);
    }
    return res.json();
}

async function supabaseGetOne(endpoint, filter) {
    var data = await supabaseGet(endpoint, filter);
    return data[0] || null;
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
    var cart = getCart();
    var badge = document.querySelector('.cart-count-badge');
    if (badge) {
        badge.textContent = cart.reduce(function(sum, item) { return sum + (item.quantity || 1); }, 0);
        badge.classList.toggle('visible', cart.length > 0);
    }
}

// ==========================================
// WISHLIST BADGE
// ==========================================

function updateWishlistBadge() {
    try {
        var wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
        var badge = document.querySelector('.wishlist-count-badge');
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
    var overlay = document.getElementById('mini-cart-overlay');
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.classList.add('cart-open');
    updateMiniCartUI();
}

function closeMiniCart() {
    var overlay = document.getElementById('mini-cart-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.classList.remove('cart-open');
}

// ==========================================
// 3. SEARCH POPUP - SUPABASE UYUMLU
// ==========================================

var searchDebounceTimer = null;
var allProductsCache = [];

function initSearch() {
    var popup = document.getElementById('search-popup-overlay');
    var input = document.getElementById('live-search-input');
    var closeBtn = document.getElementById('close-search-popup');
    var resultsDisplay = document.getElementById('search-results-display');

    if (!popup || !input) {
        console.warn('Search popup elementleri bulunamadi!');
        return;
    }

    document.addEventListener('click', function(e) {
        var openBtn = e.target.closest('#search-open-btn');
        if (openBtn) {
            e.preventDefault();
            e.stopPropagation();
            openSearchPopup();
        }
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            closeSearchPopup();
        });
    }

    popup.addEventListener('click', function(e) {
        if (e.target === popup) closeSearchPopup();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && popup.classList.contains('active')) {
            closeSearchPopup();
        }
    });

    input.addEventListener('input', function(e) {
        var query = e.target.value.trim();
        clearTimeout(searchDebounceTimer);

        if (query.length < 2) {
            if (resultsDisplay) resultsDisplay.style.display = 'none';
            return;
        }

        searchDebounceTimer = setTimeout(function() {
            performSearch(query);
        }, 300);
    });

    console.log('Search popup baslatildi');
}

function openSearchPopup() {
    var popup = document.getElementById('search-popup-overlay');
    var input = document.getElementById('live-search-input');
    var resultsDisplay = document.getElementById('search-results-display');

    if (!popup) return;

    var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = scrollbarWidth + 'px';
    document.body.classList.add('search-active');

    popup.classList.add('active');
    if (resultsDisplay) resultsDisplay.style.display = 'none';

    setTimeout(function() { if (input) input.focus(); }, 100);

    if (allProductsCache.length === 0) {
        fetchAllProductsForSearch();
    }
}

function closeSearchPopup() {
    var popup = document.getElementById('search-popup-overlay');
    var resultsDisplay = document.getElementById('search-results-display');

    if (!popup) return;

    popup.classList.remove('active');
    document.body.classList.remove('search-active');
    document.body.style.paddingRight = '';

    if (resultsDisplay) {
        resultsDisplay.style.display = 'none';
        resultsDisplay.innerHTML = '';
    }

    var input = document.getElementById('live-search-input');
    if (input) input.value = '';
}

async function fetchAllProductsForSearch() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Supabase config eksik!');
        return;
    }

    try {
        var data = await supabaseGet('products', {
            select: '*',
            active: 'eq.true'
        });

        allProductsCache = data.map(function(product) {
            var displayPrice = product.discount_price || product.base_price || 0;
            return {
                id: product.id,
                name: product.name || '',
                price: displayPrice,
                image: product.images && product.images[0] ? product.images[0] : '',
                category: product.category || '',
                url: '/matta/' + (product.slug || product.id)
            };
        });

        console.log(allProductsCache.length + ' urun cachelendi');

    } catch (error) {
        console.error('Urun cache hatasi:', error);
    }
}

function performSearch(query) {
    var resultsDisplay = document.getElementById('search-results-display');
    if (!resultsDisplay) return;

    if (allProductsCache.length === 0) {
        resultsDisplay.innerHTML = '<div class="no-results-found">Laddar produkter...</div>';
        resultsDisplay.style.display = 'block';
        return;
    }

    var lowerQuery = query.toLowerCase();
    var filtered = allProductsCache.filter(function(product) {
        return product.name.toLowerCase().includes(lowerQuery) ||
               product.category.toLowerCase().includes(lowerQuery);
    });

    if (filtered.length === 0) {
        resultsDisplay.innerHTML = '<div class="no-results-found">Inga produkter hittades.</div>';
    } else {
        resultsDisplay.innerHTML = filtered.slice(0, 8).map(function(product) {
            return '<a href="' + product.url + '" class="search-item-row">' +
                '<div class="search-item-image">' +
                '<img src="' + product.image + '" alt="' + product.name + '" onerror="this.src='https://via.placeholder.com/50'">' +
                '</div>' +
                '<div class="search-item-info">' +
                '<h4 class="search-item-title">' + highlightMatch(product.name, query) + '</h4>' +
                '<span class="search-item-price">' + product.price.toLocaleString('sv-SE') + ' SEK</span>' +
                '</div>' +
                '</a>';
        }).join('');
    }

    resultsDisplay.style.display = 'block';
}

function highlightMatch(text, query) {
    var regex = new RegExp('(' + escapeRegex(query) + ')', 'gi');
    return text.replace(regex, '<mark style="background:#ffeb3b;color:#000;padding:0 2px;">$1</mark>');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ==========================================
// 4. MINI SEPET - ICERIK YONETIMI
// ==========================================

function updateMiniCartUI() {
    var cart = getCart();
    var emptyState = document.getElementById('cart-empty-state');
    var filledState = document.getElementById('cart-filled-state');
    var footer = document.getElementById('mini-cart-footer');

    if (!emptyState || !filledState || !footer) return;

    if (cart.length === 0) {
        emptyState.style.display = 'block';
        filledState.style.display = 'none';
        footer.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        filledState.style.display = 'block';
        footer.style.display = 'block';

        var total = 0;
        filledState.innerHTML = cart.map(function(item) {
            var qty = item.quantity || 1;
            var itemTotal = item.price * qty;
            total += itemTotal;
            return '<div class="mini-cart-item" data-id="' + item.id + '">' +
                '<img src="' + (item.image || '') + '" alt="' + (item.name || '') + '" class="item-image" onerror="this.style.display='none'">' +
                '<div class="item-details-left">' +
                '<span class="item-name">' + (item.name || 'Urun') + '</span>' +
                '<span class="item-variant">' + (item.variants || 'Standard') + '</span>' +
                '<div class="quantity-control">' +
                '<button class="quantity-btn minus" data-id="' + item.id + '" data-action="decrease">-</button>' +
                '<input type="text" class="quantity-input" value="' + qty + '" readonly>' +
                '<button class="quantity-btn plus" data-id="' + item.id + '" data-action="increase">+</button>' +
                '</div>' +
                '</div>' +
                '<div class="item-price-right">' +
                '<span class="item-price">' + itemTotal.toLocaleString('sv-SE') + ' SEK</span>' +
                '<button class="remove-item-btn" data-id="' + item.id + '">Ta bort</button>' +
                '</div>' +
                '</div>';
        }).join('');

        var grandTotal = document.getElementById('cart-grand-total');
        if (grandTotal) grandTotal.textContent = total.toLocaleString('sv-SE') + ' SEK';
    }
}

function updateQuantity(productId, change) {
    var cart = getCart();
    var item = cart.find(function(i) { return i.id === productId; });
    if (!item) return;

    item.quantity = (item.quantity || 1) + change;
    if (item.quantity <= 0) {
        cart = cart.filter(function(i) { return i.id !== productId; });
    }
    saveCart(cart);
    updateMiniCartUI();
}

function removeFromCart(productId) {
    var cart = getCart().filter(function(i) { return i.id !== productId; });
    saveCart(cart);
    updateMiniCartUI();
}

// ==========================================
// 5. URUN EKLEME
// ==========================================

function addProductToCart(productData) {
    var cart = getCart();
    var existing = cart.find(function(i) { return i.id === productData.id && i.variants === productData.variants; });

    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        cart.push(Object.assign({}, productData, { quantity: 1 }));
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
        var product = await supabaseGetOne('products', {
            id: 'eq.' + productId
        });

        if (!product) throw new Error('Urun bulunamadi');

        var variants = await supabaseGet('product_variants', {
            product_id: 'eq.' + productId
        });

        product.product_variants = variants;

        var displayPrice = product.discount_price || product.base_price || 0;
        if (variantSize && variants.length > 0) {
            var variant = variants.find(function(v) { return v.size === variantSize; });
            if (variant) {
                displayPrice = variant.discount_price || variant.price || displayPrice;
            }
        }

        var variantLabel = variantSize || 'Standard';

        var cartItem = {
            id: product.id,
            name: product.name,
            price: displayPrice,
            image: product.images && product.images[0] ? product.images[0] : '',
            variants: variantLabel,
            delivery: product.delivery_time || '3-7 arbetsdagar',
            quantity: 1
        };

        var cart = getCart();
        var existing = cart.find(function(i) { return i.id === productId && i.variants === variantLabel; });
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
    var overlay = document.getElementById('mobile-menu-overlay');
    if (overlay) {
        overlay.classList.add('open');
        document.body.classList.add('no-scroll');
    }
}

function closeMobileMenu() {
    var overlay = document.getElementById('mobile-menu-overlay');
    if (overlay) {
        overlay.classList.remove('open');
        document.body.classList.remove('no-scroll');
    }
}

// ==========================================
// 8. EVENT LISTENERS
// ==========================================

var __commonListenersInitialized = false;

function initEventListeners() {
    if (__commonListenersInitialized) {
        console.log('Event listenerlar zaten bagli, atlaniyor.');
        return;
    }
    __commonListenersInitialized = true;

    console.log('Event listenerlar baslatiliyor...');

    // SEPET ACMA
    document.addEventListener('click', function(e) {
        var btn = e.target.closest('#open-mini-cart-btn, .cart-icon-wrapper, .fa-shopping-bag');
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            openMiniCart();
        }
    });

    // SEPET KAPAMA
    document.addEventListener('click', function(e) {
        var btn = e.target.closest('#close-mini-cart');
        if (btn) {
            e.stopPropagation();
            closeMiniCart();
        }
    });

    // MINI SEPET ICINDEKI BUTONLAR
    document.addEventListener('click', function(e) {
        var qtyBtn = e.target.closest('.quantity-btn');
        if (qtyBtn) {
            e.stopPropagation();
            var id = qtyBtn.dataset.id;
            var action = qtyBtn.dataset.action;
            if (id && action) updateQuantity(id, action === 'increase' ? 1 : -1);
            return;
        }

        var removeBtn = e.target.closest('.remove-item-btn');
        if (removeBtn) {
            e.stopPropagation();
            var id = removeBtn.dataset.id;
            if (id) removeFromCart(id);
            return;
        }
    });

    // OVERLAY'A TIKLAYINCA KAPAMA
    document.addEventListener('click', function(e) {
        if (e.target.id === 'mini-cart-overlay') closeMiniCart();
        if (e.target.id === 'mobile-menu-overlay') closeMobileMenu();
    });

    // MOBIL MENU
    document.addEventListener('click', function(e) {
        var openBtn = e.target.closest('#open-mobile-menu-btn');
        if (openBtn) {
            e.preventDefault();
            openMobileMenu();
        }
    });

    document.addEventListener('click', function(e) {
        var closeBtn = e.target.closest('#close-mobile-menu');
        if (closeBtn) closeMobileMenu();
    });

    // ESC TUSU
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeMiniCart();
            closeMobileMenu();
            closeSearchPopup();
        }
    });

    // SEARCH POPUP'I BASLAT
    initSearch();
    updateWishlistBadge();

    console.log('Event listenerlar baglandi');
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