// ==========================================
// COMMON.JS - TEMEL FONKSIYONLAR (v9.0)
// IS_CHECKOUT_PAGE kontrolu kaldirildi - sayfalar kendi elementlerini kontrol ediyor
// Badge spam loglari temizlendi
// ==========================================

window.__commonListenersInitialized = false;

if (typeof CONFIG === 'undefined') {
    console.error('HATA: config.js yuklenmemis!');
}

const SUPABASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE) ? CONFIG.SUPABASE.URL : '';
const SUPABASE_KEY = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE) ? CONFIG.SUPABASE.ANON_KEY : '';

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

function idsMatch(id1, id2) {
    return String(id1) === String(id2);
}

// ==========================================
// SEPET FONKSIYONLARI - VARYASYON FIX v8.9
// ==========================================

function getCart() {
    try {
        let cart = JSON.parse(localStorage.getItem('siteCartItems')) || [];
        // MIGRATE: Eski sepet verilerine cartItemId ekle (geriye donuk uyumluluk)
        let needsSave = false;
        cart = cart.map(item => {
            if (!item.cartItemId) {
                item.cartItemId = generateCartItemId(item.id, item.variants);
                needsSave = true;
                console.log('[Cart] Migrate edildi:', item.cartItemId);
            }
            return item;
        });
        if (needsSave) {
            localStorage.setItem('siteCartItems', JSON.stringify(cart));
            console.log('[Cart] Sepet migrate edildi ve kaydedildi');
        }
        return cart;
    } catch (e) {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem('siteCartItems', JSON.stringify(cart));
    window.updateCartBadge();
}

// Benzersiz sepet ogesi ID'si olustur
function generateCartItemId(productId, variantLabel) {
    return String(productId) + '_' + (variantLabel || 'default')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '');
}

// SEPETTEKI OGEYI BUL - cartItemId, id+variants, veya sadece id ile
function findCartItem(cart, cartItemId, productId, variantLabel) {
    // 1. Once cartItemId ile dene
    let item = cart.find(i => i.cartItemId === cartItemId);
    if (item) return item;
    
    // 2. Yoksa id + variants ile dene (geriye donuk uyumluluk)
    if (productId !== undefined) {
        item = cart.find(i => idsMatch(i.id, productId) && i.variants === variantLabel);
        if (item) return item;
        
        // 3. En kotu ihtimal sadece id ile dene
        item = cart.find(i => idsMatch(i.id, productId));
        if (item) return item;
    }
    
    return null;
}

// SEPETTEN OGE KALDIR - cartItemId veya id+variants ile
function filterCartItem(cart, cartItemId, productId, variantLabel) {
    // 1. Once cartItemId ile filtrele
    let filtered = cart.filter(i => i.cartItemId !== cartItemId);
    if (filtered.length < cart.length) return filtered;
    
    // 2. Yoksa id + variants ile filtrele
    if (productId !== undefined) {
        filtered = cart.filter(i => !(idsMatch(i.id, productId) && i.variants === variantLabel));
        if (filtered.length < cart.length) return filtered;
    }
    
    return filtered;
}

window.updateCartBadge = function() {
    const cart = getCart();
    const badges = document.querySelectorAll('.cart-count-badge');
    if (badges.length === 0) {
        return false;
    }
    const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    badges.forEach(badge => {
        badge.textContent = count;
        badge.classList.toggle('visible', count > 0);
    });
    return true;
};

window.updateWishlistBadge = function() {
    try {
        const wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
        const badges = document.querySelectorAll('.wishlist-count-badge');
        if (badges.length === 0) {
            return false;
        }
        badges.forEach(badge => {
            badge.textContent = wishlist.length;
            badge.classList.toggle('visible', wishlist.length > 0);
        });
        return true;
    } catch (e) {
        console.error('[Badge] Wishlist badge hatasi:', e);
        return true;
    }
};

window.__dkBadgeInitDone = false;
window.__dkBadgeInitInProgress = false;

function initBadgesWithRetry(maxRetries = 20, interval = 100) {
    // Badge elementleri yoksa bu sayfada badge yok demektir, sessizce cik
    const cartBadges = document.querySelectorAll('.cart-count-badge');
    const wishBadges = document.querySelectorAll('.wishlist-count-badge');
    if (cartBadges.length === 0 && wishBadges.length === 0) {
        return;
    }
    
    if (window.__dkBadgeInitDone || window.__dkBadgeInitInProgress) {
        return;
    }
    
    window.__dkBadgeInitInProgress = true;
    
    let attempts = 0;
    function tryInit() {
        attempts++;
        const cartOk = window.updateCartBadge();
        const wishOk = window.updateWishlistBadge();
        if (cartOk && wishOk) {
            window.__dkBadgeInitDone = true;
            window.__dkBadgeInitInProgress = false;
            return;
        }
        if (attempts >= maxRetries) {
            window.__dkBadgeInitInProgress = false;
            console.warn('[Badge] Max retry asildi (' + maxRetries + '). Badge elementleri bulunamadi.');
            return;
        }
        setTimeout(tryInit, interval);
    }
    tryInit();
}

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
        if (hasNewBadges && !window.__dkBadgeInitDone && !window.__dkBadgeInitInProgress) {
            initBadgesWithRetry();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    return observer;
}

// ==========================================
// STOK KONTROL FONKSIYONLARI
// ==========================================

async function fetchProductStock(productId, variantLabel, itemData) {
    try {
        const product = await supabaseGetOne('products', { id: 'eq.' + productId });
        if (!product) return { stock: 999 };

        // M2 urunler icin ozel stok hesaplama
        // m2_stock_per_width JSON: {"100": 15, "150": 20, "200": 20}
        // Key = en (cm), Value = metre cinsinden stok
        if (itemData && itemData.isM2 && product.m2_stock_per_width) {
            let stockData;
            try {
                stockData = typeof product.m2_stock_per_width === 'string' 
                    ? JSON.parse(product.m2_stock_per_width) 
                    : product.m2_stock_per_width;
            } catch (e) {
                console.error('[Stock] m2_stock_per_width parse hatasi:', e);
                stockData = {};
            }

            const widthCm = String(Math.round(parseFloat(itemData.en) || 0));
            const availableMeters = stockData[widthCm];

            if (availableMeters !== undefined && availableMeters !== null) {
                // Stok metre cinsinden, m2'ye cevirelim
                const widthMeters = parseFloat(widthCm) / 100;
                const totalM2 = Math.floor(availableMeters * widthMeters);
                return { stock: totalM2, type: 'm2', rawStock: availableMeters, unit: 'm' };
            }
            
            // Eger bu genislik yoksa, stok yok demektir
            console.warn('[Stock] Bu genislik icin stok bulunamadi:', widthCm, 'Mevcut:', Object.keys(stockData));
            return { stock: 0, type: 'm2', rawStock: 0, unit: 'm' };
        }

        // Normal varyantli urunler
        if (variantLabel && variantLabel !== 'Standard') {
            const variants = await supabaseGet('product_variants', { 
                product_id: 'eq.' + productId,
                select: '*'
            });
            if (variants && variants.length > 0) {
                const variant = variants.find(v => {
                    const vSize = (v.size || '').trim();
                    const vLabel = (variantLabel || '').trim();
                    return vSize === vLabel;
                });
                if (variant && variant.stock !== undefined && variant.stock !== null) {
                    return { stock: parseInt(variant.stock) || 0 };
                }
            }
        }

        // Varyantsiz urunler
        const stock = product.stock !== undefined && product.stock !== null 
            ? parseInt(product.stock) : 999;
        return { stock: stock };

    } catch (err) {
        console.error('[Stock] fetchProductStock hatasi:', err);
        return { stock: 999 };
    }
}

function showStockWarning(message) {
    // Mevcut bir toast/uyari sistemi var mi kontrol et
    let toast = document.getElementById('stock-warning-toast');

    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'stock-warning-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e54d42;
            color: #fff;
            padding: 14px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 99999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateX(120%);
            transition: transform 0.3s ease;
            max-width: 320px;
            line-height: 1.4;
        `;
        document.body.appendChild(toast);
    }

    toast.textContent = message;

    // Goster
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
    });

    // 4 saniye sonra gizle
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
    }, 4000);
}

// ==========================================
// MINI SEPET FONKSIYONLARI
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
        
        let grandTotal = 0;
        let totalOriginalPrice = 0;
        let totalDiscount = 0;
        
        const html = cart.map(item => {
            const qty = item.quantity || 1;
            const currentPrice = Number(item.price) || 0;
            
            let originalPrice = Number(item.original_price) || Number(item.base_price) || Number(item.old_price) || currentPrice;
            if (!originalPrice || originalPrice <= 0) {
                originalPrice = currentPrice;
            }
            
            const itemCurrentTotal = currentPrice * qty;
            const itemOriginalTotal = originalPrice * qty;
            const itemDiscount = itemOriginalTotal - itemCurrentTotal;
            
            grandTotal += itemCurrentTotal;
            totalOriginalPrice += itemOriginalTotal;
            if (itemDiscount > 0) totalDiscount += itemDiscount;
            
            const itemId = item.cartItemId || generateCartItemId(item.id, item.variants);
            
            // RENK bilgisi varsa göster
            const isCalculatorItem = item.isM2 || item.isGardin;
            let variantDisplay = '';

            if (isCalculatorItem && item.size) {
                variantDisplay = item.size;
                if (item.isGardin && item.note && item.note.trim() !== '') {
                    variantDisplay += ' <span style="color:#888;font-size:12px;">📝 ' + item.note + '</span>';
                }
            } else {
                const colorDisplay = item.color ? ` / ${item.color}` : '';
                variantDisplay = (item.variants || 'Standard') + colorDisplay;
            }
            
            // Fiyat gösterimi
            let priceHtml = '';
            if (itemDiscount > 0 && originalPrice > currentPrice) {
                priceHtml = `
                    <div class="price-stack">
                        <span class="original-price">${itemOriginalTotal.toLocaleString('sv-SE')} SEK</span>
                        <span class="discounted-price">${itemCurrentTotal.toLocaleString('sv-SE')} SEK</span>
                    </div>
                `;
            } else {
                priceHtml = `<span class="item-price">${itemCurrentTotal.toLocaleString('sv-SE')} SEK</span>`;
            }
            
            return `<div class="mini-cart-item" data-cart-item-id="${itemId}">
                <img src="${item.image || ''}" alt="${item.name || ''}" class="item-image" onerror="this.style.display='none'">
                <div class="item-details-left">
                    <span class="item-name">${item.name || 'Urun'}</span>
                    <span class="item-variant">${variantDisplay}</span>
                    <div class="quantity-control">
                        <button type="button" class="quantity-btn minus" data-cart-item-id="${itemId}" data-action="decrease">-</button>
                        <input type="text" class="quantity-input" value="${qty}" readonly>
                        <button type="button" class="quantity-btn plus" data-cart-item-id="${itemId}" data-action="increase">+</button>
                    </div>
                </div>
                <div class="item-price-right">
                    ${priceHtml}
                    <button type="button" class="remove-item-btn" data-cart-item-id="${itemId}">Ta bort</button>
                </div>
            </div>`;
        }).join('');
        
        filledState.innerHTML = html;
        
        // Toplam indirim gösterimi
        const discountWrapper = document.getElementById('discount-wrapper');
        const discountAmount = document.getElementById('cart-total-discount');
        if (discountWrapper && discountAmount) {
            if (totalDiscount > 0) {
                discountWrapper.style.display = 'flex';
                discountAmount.textContent = '-' + totalDiscount.toLocaleString('sv-SE') + ' SEK';
            } else {
                discountWrapper.style.display = 'none';
            }
        }
        
        const grandTotalEl = document.getElementById('cart-grand-total');
        if (grandTotalEl) grandTotalEl.textContent = grandTotal.toLocaleString('sv-SE') + ' SEK';
    }
}

async function updateQuantity(cartItemId, change) {
    let cart = getCart();
    
    // cartItemId'den productId ve variantLabel cikar
    const parts = cartItemId.split('_');
    const productId = parts[0];
    const variantLabel = parts.slice(1).join('_').replace(/_/g, ' ');
    
    const item = findCartItem(cart, cartItemId, productId, variantLabel);
    
    if (!item) {
        console.warn('updateQuantity: Urun bulunamadi, cartItemId:', cartItemId, 'Mevcut cartItemIdler:', cart.map(i => i.cartItemId));
        return;
    }

    const currentQty = item.quantity || 1;
    const newQty = currentQty + change;

    // Azaltma işlemi ise (stok kontrolü gerekmez, 0'ın altına düşmesini engelle)
    if (change < 0) {
        if (newQty <= 0) {
            cart = filterCartItem(cart, cartItemId, productId, variantLabel);
            saveCart(cart);
            updateMiniCartUI();
            return;
        }
        item.quantity = newQty;
        saveCart(cart);
        updateMiniCartUI();
        return;
    }

    // Artırma işlemi - STOK KONTROLÜ
    // Önce butonu disabled yap (çift tıklamayı engelle)
    const btn = document.querySelector(`.quantity-btn.plus[data-cart-item-id="${cartItemId}"]`);
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
    }

    try {
        // M2 veya Gardin ürünleri için item.size kullan, yoksa variants kullan
        const stockVariantLabel = (item.isM2 || item.isGardin) && item.size 
            ? item.size 
            : (item.variants || variantLabel || 'Standard');

        const stockInfo = await fetchProductStock(productId, stockVariantLabel, item);
        const maxStock = stockInfo.stock;

        // Stok bilgisi sepet öğesine kaydet (cache)
        item.maxStock = maxStock;

        if (newQty > maxStock) {
            showStockWarning(`Endast ${maxStock} st. i lager för "${item.name}"`);
            // Butonu tekrar aktif et
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
            return;
        }

        item.quantity = newQty;
        saveCart(cart);
        updateMiniCartUI();

    } catch (err) {
        console.error('[Stock] Stok kontrol hatasi:', err);
        // Hata durumunda yine de izin ver ama uyarı ver
        showStockWarning('Kunde inte kontrollera lagerstatus. Försök igen.');
    } finally {
        // Butonu tekrar aktif et
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    }
}

function removeFromCart(cartItemId) {
    console.log('[Cart] removeFromCart cagrildi, cartItemId:', cartItemId);
    
    // cartItemId'den productId ve variantLabel cikar
    const parts = cartItemId.split('_');
    const productId = parts[0];
    const variantLabel = parts.slice(1).join('_').replace(/_/g, ' ');
    
    let cart = getCart();
    cart = filterCartItem(cart, cartItemId, productId, variantLabel);
    saveCart(cart);
    updateMiniCartUI();
}

function addProductToCart(productData) {
    let cart = getCart();
    const variantLabel = productData.variants || 'Standard';
    const cartItemId = generateCartItemId(productData.id, variantLabel);
    
    // Eğer original_price yoksa, price'i kullan
    if (!productData.original_price) {
        productData.original_price = productData.price;
    }
    
    const existing = cart.find(i => i.cartItemId === cartItemId);
    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        const newItem = { 
            ...productData, 
            cartItemId: cartItemId, 
            quantity: 1 
        };
        cart.push(newItem);
    }
    saveCart(cart);
    updateMiniCartUI();
    openMiniCart();
}

async function addSupabaseProductToCart(productId, variantSize) {
    try {
        const product = await supabaseGetOne('products', { id: 'eq.' + productId });
        if (!product) throw new Error('Urun bulunamadi');
        const variants = await supabaseGet('product_variants', { product_id: 'eq.' + productId });
        let displayPrice = product.discount_price || product.base_price || 0;
        let originalPrice = product.base_price || product.price || displayPrice;
        
        if (variantSize && variants.length > 0) {
            const variant = variants.find(v => v.size === variantSize);
            if (variant) {
                displayPrice = variant.discount_price || variant.price || displayPrice;
                originalPrice = variant.price || product.base_price || displayPrice;
            }
        }
        
        const variantLabel = variantSize || 'Standard';
        const cartItemId = generateCartItemId(product.id, variantLabel);
        
        const cartItem = {
            id: product.id,
            cartItemId: cartItemId,
            name: product.name,
            price: displayPrice,
            original_price: originalPrice,
            image: product.images && product.images[0] ? product.images[0] : '',
            variants: variantLabel,
            delivery: product.delivery_time || '3-7 arbetsdagar',
            quantity: 1
        };
        
        let cart = getCart();
        const existing = cart.find(i => i.cartItemId === cartItemId);
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
// ARAMA FONKSIYONLARI
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
        // Search input yoksa bu sayfada search yok demektir, sessizce cik
        return;
    }
    
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
        if (allProductsCache.length === 0 && !isFetchingProducts) {
            
            if (searchResultsElement) {
                searchResultsElement.innerHTML = '<div class="no-results-found">Laddar produkter...</div>';
                searchResultsElement.style.display = 'block';
            }
            fetchAllProductsForSearch().then(() => { performSearch(query); });
            return;
        }
        if (isFetchingProducts) {
            
            if (searchResultsElement) {
                searchResultsElement.innerHTML = '<div class="no-results-found">Laddar produkter...</div>';
                searchResultsElement.style.display = 'block';
            }
            return;
        }
        searchDebounceTimer = setTimeout(() => { performSearch(query); }, 300);
    });
    searchInputElement.addEventListener('focus', () => {
        if (allProductsCache.length === 0 && !isFetchingProducts) {
            
            fetchAllProductsForSearch();
        }
    });
    
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
        console.error('[Search] Supabase config eksik!');
        return;
    }
    if (isFetchingProducts) {
        
        return;
    }
    isFetchingProducts = true;
    console.log("[Search] Urunler Supabase'den cekiliyor...");
    try {
        const data = await supabaseGet('products', { select: '*', active: 'eq.true' });
        
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
            url: '/produkt/' + (product.slug || product.id)
        }));
        
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
    
    if (allProductsCache.length === 0) {
        resultsDisplay.innerHTML = '<div class="no-results-found">Inga produkter tillgangliga. Forsok igen om en stund.</div>';
        resultsDisplay.style.display = 'block';
        if (!isFetchingProducts) fetchAllProductsForSearch();
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==========================================
// MOBIL MENU FONKSIYONLARI
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
// HEADER SCROLL EFEKTI
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
// EVENT LISTENERS - DUZELTILMIS v9.0
// ==========================================

function initEventListeners() {
    
    if (window.__commonListenersInitialized) {
        
        return;
    }
    window.__commonListenersInitialized = true;
    
    initHeaderScroll();

    document.addEventListener('click', (e) => {
        if (e.target.closest('#open-mini-cart-btn, .cart-icon-wrapper, .fa-shopping-bag, .cart-trigger, [data-action="open-cart"], .header-cart-icon')) {
            e.preventDefault();
            openMiniCart();
            return;
        }
        if (e.target.closest('#close-mini-cart')) {
            closeMiniCart();
            return;
        }
        if (e.target.closest('#open-mobile-menu-btn, .mobile-menu-trigger, [data-action="open-menu"], .hamburger-btn')) {
            e.preventDefault();
            openMobileMenu();
            return;
        }
        if (e.target.closest('#close-mobile-menu')) {
            closeMobileMenu();
            return;
        }
        if (e.target.closest('#search-open-btn, .search-trigger, [data-action="open-search"], .header-search-icon, .fa-magnifying-glass, .fa-search')) {
            e.preventDefault();
            openSearchPopup();
            return;
        }
        if (e.target.closest('#close-search-popup')) {
            e.preventDefault();
            e.stopPropagation();
            closeSearchPopup();
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
        if (e.target.id === 'search-popup-overlay') {
            closeSearchPopup();
            return;
        }
    });

    // ==========================================
    // MINI SEPET ICINDEKI BUTONLAR - DUZELTILMIS
    // ==========================================
    document.addEventListener('click', (e) => {
        const filledState = document.getElementById('cart-filled-state');
        if (!filledState || !filledState.contains(e.target)) return;

        const removeBtn = e.target.closest('.remove-item-btn');
        const qtyBtn = e.target.closest('.quantity-btn');

        if (removeBtn) {
            const cartItemId = removeBtn.getAttribute('data-cart-item-id') || removeBtn.getAttribute('data-id');
            if (cartItemId) {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Cart] Remove tiklandi, cartItemId:', cartItemId);
                removeFromCart(cartItemId);
            } else {
                console.warn('[Cart] Remove butonunda ID bulunamadi!');
            }
        } else if (qtyBtn) {
            const cartItemId = qtyBtn.getAttribute('data-cart-item-id') || qtyBtn.getAttribute('data-id');
            const action = qtyBtn.getAttribute('data-action');
            if (cartItemId && action) {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Cart] Quantity tiklandi, cartItemId:', cartItemId, 'action:', action);
                updateQuantity(cartItemId, action === 'increase' ? 1 : -1);
            } else {
                console.warn('[Cart] Quantity butonunda ID veya action bulunamadi!');
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMiniCart();
            closeMobileMenu();
            closeSearchPopup();
        }
    });

    initSearch();
    
}

// ==========================================
// BREADCRUMB
// ==========================================

function initBreadcrumb() {
    if (window.innerWidth <= 768) return;

    const nav = document.getElementById('breadcrumb-nav');
    if (!nav) {
        
        return;
    }

    if (nav.innerHTML.trim() !== '' && nav.querySelector('ol')) {
        
        return;
    }

    const path = window.location.pathname;
    const crumbs = [{ name: 'Hem', url: '/' }];

    const isCategoryPage = document.getElementById('category-main-title') !== null ||
                           path === '/mattor/' ||
                           path === '/metervara/' ||
                           path === '/gangmattor/' ||
                           path === '/badrumsmattor/' ||
                           path === '/gardiner/' ||
                           path === '/rea/' ||
                           path.includes('kategori');

    if (isCategoryPage) {
        let catName = 'Produkter';
        let catUrl = path;

        if (path === '/mattor/') catName = 'Mattor';
        else if (path === '/metervara/') catName = 'Metervara';
        else if (path === '/gangmattor/') catName = 'Gangmattor';
        else if (path === '/badrumsmattor/') catName = 'Badrumsmattor';
        else if (path === '/gardiner/') catName = 'Gardiner';
        else if (path === '/rea/') catName = 'REA';
        else if (document.getElementById('category-main-title')) {
            catName = document.getElementById('category-main-title').textContent.trim();
        } else {
            const pathParts = path.split('/').filter(p => p);
            if (pathParts.length > 0) {
                catName = pathParts[pathParts.length - 1]
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
            }
        }

        crumbs.push({ name: catName, url: '#' });
    } else if (path.startsWith('/produkt/')) {
        crumbs.push({ name: 'Alla Mattor', url: '/mattor/' });
        const productName = document.getElementById('product-main-name-desktop')?.textContent?.trim();
        crumbs.push({
            name: (productName && productName !== '---') ? productName : 'Produkt',
            url: '#'
        });
    } else if (path.includes('wishlist') || path.includes('favoriter')) {
        crumbs.push({ name: 'Mina Favoriter', url: '#' });
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
    
}

// ==========================================
// OTOMATIK BASLATMA
// ==========================================

window.__dkInitAllDone = false;

function initAll() {
    if (window.__dkInitAllDone) {
        
        return;
    }
    window.__dkInitAllDone = true;
    
    initEventListeners();
    initBadgesWithRetry();
    observeBadgeElements();
    initBreadcrumb();
    
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
} else {
    initAll();
}

window.addEventListener('load', () => {
    const input = document.getElementById('live-search-input');
    if (input && !input._searchInitialized) {
        initSearch();
    }
    const nav = document.getElementById('breadcrumb-nav');
    if (nav && nav.innerHTML.trim() === '') {
        initBreadcrumb();
    }
});




// ===== FOOTER MOBİL AKORDEON =====
document.addEventListener('DOMContentLoaded', function() {
    
    const accCol = document.querySelector('.acc-col');
    const accTrigger = document.querySelector('.acc-trigger');
    
    if (!accCol || !accTrigger) return;
    
    // Başlangıçta kapalı (mobilde)
    accCol.classList.remove('active');
    
    accTrigger.addEventListener('click', function() {
        // Sadece mobilde çalışsın
        if (window.innerWidth <= 768) {
            accCol.classList.toggle('active');
        }
    });
});


// ==========================================
// HEADER HIDE/SHOW ON SCROLL
// Sayfa asagi inerken header gizlenir, yukari cikarken gorunur
// ==========================================

(function() {
    let lastScrollY = window.scrollY;
    let ticking = false;
    
    const header = document.querySelector('.main-header');
    const topBar = document.querySelector('.top-bar');
    
    if (!header) {
        
        return;
    }
    
    function updateHeader() {
        const currentScrollY = window.scrollY;
        const topBarHeight = topBar ? topBar.offsetHeight : 0;
        
        // Top bar'in altindan gecince basla
        if (currentScrollY > topBarHeight + 10) {
            // Asagi scroll → header gizle
            if (currentScrollY > lastScrollY && currentScrollY > 50) {
                header.classList.add('hidden');
                header.classList.remove('visible');
            } 
            // Yukari scroll → header goster
            else {
                header.classList.remove('hidden');
                header.classList.add('visible');
            }
        } else {
            // En ustteyken her zaman goster
            header.classList.remove('hidden');
            header.classList.add('visible');
        }
        
        lastScrollY = currentScrollY;
        ticking = false;
    }
    
    window.addEventListener('scroll', function() {
        if (!ticking) {
            window.requestAnimationFrame(updateHeader);
            ticking = true;
        }
    }, { passive: true });
    
    
})();