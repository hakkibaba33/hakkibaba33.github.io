// ==========================================
// COMMON.JS - HYBRID AI CHAT + SUPABASE (v8.0)
// Badge'ler her zaman calisacak - MutationObserver + Retry mekanizmasi
// Hybrid AI Chat: Rule-based + AI API + Supabase Entegrasyonu
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
        console.warn('[Badge] .cart-count-badge elementi henuz DOM'da yok, retry...');
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
            console.warn('[Badge] .wishlist-count-badge elementi henuz DOM'da yok, retry...');
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
            // Chat widget close
            const chatWindow = document.getElementById('dk-chat-window');
            if (chatWindow && chatWindow.classList.contains('active')) {
                closeChat();
            }
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
// HYBRID AI CHAT WIDGET v2.0
// Supabase Entegrasyonlu | WhatsApp | Siparis Takibi | Urun Onerisi
// ==========================================

(function() {
    'use strict';

    // ===== KONFIGURATION =====
    const CHAT_CONFIG = {
        lang: 'sv',
        botName: 'Dream Kilim Support',
        // AI API (OpenAI/Claude - opsiyonel)
        aiApiEndpoint: (typeof CONFIG !== 'undefined' && CONFIG.AI_API) ? CONFIG.AI_API.ENDPOINT : '',
        aiApiKey: (typeof CONFIG !== 'undefined' && CONFIG.AI_API) ? CONFIG.AI_API.KEY : '',
        aiModel: (typeof CONFIG !== 'undefined' && CONFIG.AI_API) ? CONFIG.AI_API.MODEL : 'gpt-3.5-turbo',
        // WhatsApp
        whatsappNumber: '+46701234567', // BURAYI KENDI NUMARANLA DEGISTIR
        whatsappMessage: 'Hej! Jag behover hjalp med min bestallning fran Dream Kilim.',
        // Supabase Tables
        tables: {
            orders: 'orders',
            orderItems: 'order_items',
            products: 'products',
            chatHistory: 'chat_history',
            chatTickets: 'chat_tickets'
        },
        maxHistory: 10,
        typingDelay: 600,
        responseDelay: 900,
        enableSupabase: !!(SUPABASE_URL && SUPABASE_KEY)
    };

    const I18N = {
        sv: {
            welcome: "Hej! 👋 Valkommen till Dream Kilim. Jag ar din AI-assistent och kan hjalpa dig med fragor om vara mattor, gardiner, leveranser och bestallningar.",
            placeholder: "Skriv ett meddelande...",
            send: "Skicka",
            close: "Stang",
            online: "Online nu",
            typing: "Skriver...",
            footer: "AI-driven assistent • For bradskande arenden, kontakta oss direkt",
            quickProducts: "Visa produkter",
            quickOrder: "Spåra bestallning",
            quickHuman: "Prata med manniska",
            quickFaq: "Vanliga fragor",
            error: "Ursakta, jag kunde inte bearbeta din forfragan just nu. Forsok igen eller kontakta var kundtjanst.",
            humanTransfer: "Jag forstar att du vill prata med en manniska. Jag kopplar dig vidare till var kundtjanst...",
            orderPrompt: "Ange ditt ordernummer (t.ex. DK-12345) eller e-postadress sa kan jag hjalpa dig att spara din bestallning.",
            productPrompt: "Vad letar du efter? Jag kan hjalpa dig hitta mattor, gardiner eller ge inredningstips! Beskriv garna storlek, farg eller stil.",
            faqPrompt: "Har ar nagra vanliga fragor:\n\n1. Leveranstid: 3-7 arbetsdagar\n2. Fri frakt over 1000 SEK\n3. 30 dagars oppet kop\n4. Betalning: Klarna, Visa, Mastercard\n\nVad undrar du over?",
            orderFound: "Hittade din bestallning!\n\n**Ordernummer:** {orderNumber}\n**Status:** {status}\n**Beraknad leverans:** {deliveryDate}\n**Totalt:** {total} SEK\n\nVill du veta mer om en specifik produkt i bestallningen?",
            orderNotFound: "Jag kunde inte hitta nagon bestallning med den informationen. Kontrollera ordernumret eller e-postadressen och forsok igen.\n\nDu kan aven kontakta oss:\n📧 info@dekorist.se",
            productFound: "Hittade nagra produkter som kan passa dig:\n\n{products}\n\nVill du se fler eller filtrera pa nagot specifikt?",
            noProductsFound: "Jag hittade tyvarr inga produkter som matchar din beskrivning just nu.\n\nBesok var katalog for att se hela utbudet:\nhttps://dekorist.se/category.html",
            whatsappRedirect: "Perfekt! Jag oppnar WhatsApp sa du kan prata direkt med var kundtjanst.\n\nOm WhatsApp inte oppnas automatiskt, kan du na oss pa:\n📞 {number}",
            ticketCreated: "Tack! Ditt arende har registrerats.\n\n**Arendenummer:** #{ticketId}\n\nVar kundtjanst kommer att kontakta dig inom 24 timmar. Du kan aven na oss via WhatsApp for snabbare hjalp.",
            sizeHelp: "📏 **Storleksguide:**\n\n• 80x150 cm - Passar vid sangen eller i sma hallar\n• 120x170 cm - Perfekt for vardagsrummet\n• 160x230 cm - Standardstorlek for soffgruppen\n• 200x300 cm - Stort rum eller under matbordet\n• 300x400 cm - Stora vardagsrum\n\nVilken storlek letar du efter?"
        },
        en: {
            welcome: "Hello! 👋 Welcome to Dream Kilim. I'm your AI assistant and can help you with questions about our rugs, curtains, deliveries, and orders.",
            placeholder: "Type a message...",
            send: "Send",
            close: "Close",
            online: "Online now",
            typing: "Typing...",
            footer: "AI-powered assistant • For urgent matters, contact us directly",
            quickProducts: "Browse products",
            quickOrder: "Track order",
            quickHuman: "Talk to human",
            quickFaq: "FAQ",
            error: "Sorry, I couldn't process your request right now. Please try again or contact our customer service.",
            humanTransfer: "I understand you'd like to speak with a human. I'm connecting you to our customer service...",
            orderPrompt: "Please enter your order number (e.g. DK-12345) or email address so I can help you track your order.",
            productPrompt: "What are you looking for? I can help you find rugs, curtains, or give interior design tips! Please describe size, color, or style.",
            faqPrompt: "Here are some common questions:\n\n1. Delivery time: 3-7 business days\n2. Free shipping over 1000 SEK\n3. 30-day return policy\n4. Payment: Klarna, Visa, Mastercard\n\nWhat would you like to know?",
            orderFound: "Found your order!\n\n**Order Number:** {orderNumber}\n**Status:** {status}\n**Estimated delivery:** {deliveryDate}\n**Total:** {total} SEK\n\nWould you like to know more about a specific product in your order?",
            orderNotFound: "I couldn't find any order with that information. Please check the order number or email address and try again.\n\nYou can also contact us:\n📧 info@dekorist.se",
            productFound: "Found some products that might suit you:\n\n{products}\n\nWould you like to see more or filter by something specific?",
            noProductsFound: "Unfortunately, I couldn't find any products matching your description right now.\n\nVisit our catalog to see the full range:\nhttps://dekorist.se/category.html",
            whatsappRedirect: "Perfect! I'm opening WhatsApp so you can talk directly to our customer service.\n\nIf WhatsApp doesn't open automatically, you can reach us at:\n📞 {number}",
            ticketCreated: "Thank you! Your case has been registered.\n\n**Ticket Number:** #{ticketId}\n\nOur customer service will contact you within 24 hours. You can also reach us via WhatsApp for faster help.",
            sizeHelp: "📏 **Size Guide:**\n\n• 80x150 cm - Fits by the bed or in small hallways\n• 120x170 cm - Perfect for the living room\n• 160x230 cm - Standard size for sofa groups\n• 200x300 cm - Large room or under dining table\n• 300x400 cm - Large living rooms\n\nWhat size are you looking for?"
        }
    };

    // ===== STATE =====
    let isOpen = false;
    let messageHistory = [];
    let currentLang = CHAT_CONFIG.lang;
    let chatSessionId = localStorage.getItem('dk_chat_session') || generateSessionId();
    let isAwaitingOrderNumber = false;
    let isAwaitingProductQuery = false;
    let lastContext = null;

    function generateSessionId() {
        const id = 'dk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('dk_chat_session', id);
        return id;
    }

    // ===== DOM ELEMENTS =====
    let trigger, window_, closeBtn, langToggle, messagesContainer, input, sendBtn, typingIndicator, unreadBadge;

    function getElements() {
        trigger = document.getElementById('dk-chat-trigger');
        window_ = document.getElementById('dk-chat-window');
        closeBtn = document.getElementById('dk-chat-close');
        langToggle = document.getElementById('dk-chat-lang-toggle');
        messagesContainer = document.getElementById('dk-chat-messages');
        input = document.getElementById('dk-chat-input');
        sendBtn = document.getElementById('dk-chat-send');
        typingIndicator = document.getElementById('dk-chat-typing');
        unreadBadge = document.getElementById('dk-chat-unread');
    }

    // ===== EVENT LISTENERS =====
    function initChatEvents() {
        if (!trigger) return;

        trigger.addEventListener('click', toggleChat);
        if (closeBtn) closeBtn.addEventListener('click', closeChat);
        if (langToggle) langToggle.addEventListener('click', toggleLanguage);
        if (sendBtn) sendBtn.addEventListener('click', handleSend);
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                }
            });
        }

        // Quick action buttons
        document.querySelectorAll('.dk-quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.closest('.dk-quick-btn').dataset.action;
                handleQuickAction(action);
            });
        });
    }

    // ===== CHAT FUNCTIONS =====
    function toggleChat() {
        isOpen = !isOpen;
        if (isOpen) {
            window_.style.display = 'flex';
            setTimeout(() => window_.classList.add('active'), 10);
            if (unreadBadge) unreadBadge.style.display = 'none';
            if (input) input.focus();
            // Load chat history from Supabase
            if (CHAT_CONFIG.enableSupabase) {
                loadChatHistory();
            }
        } else {
            window_.classList.remove('active');
            setTimeout(() => window_.style.display = 'none', 300);
        }
    }

    function closeChat() {
        isOpen = false;
        if (window_) {
            window_.classList.remove('active');
            setTimeout(() => window_.style.display = 'none', 300);
        }
    }

    function toggleLanguage() {
        currentLang = currentLang === 'sv' ? 'en' : 'sv';
        if (langToggle) langToggle.textContent = currentLang.toUpperCase();

        const t = I18N[currentLang];

        if (input) input.placeholder = t.placeholder;

        const footerP = document.querySelector('#dk-chat-window > div:last-child > p');
        if (footerP) footerP.textContent = t.footer;

        document.querySelectorAll('.dk-quick-btn').forEach(btn => {
            const key = btn.dataset.action;
            const textKey = 'quick' + key.charAt(0).toUpperCase() + key.slice(1);
            if (t[textKey]) btn.textContent = t[textKey];
        });

        const welcomeMsg = messagesContainer.querySelector('.dk-message-bot p');
        if (welcomeMsg) welcomeMsg.textContent = t.welcome;

        // Update online status text
        const statusText = document.querySelector('.chat-header-info span:last-child');
        if (statusText) statusText.innerHTML = `<span class="chat-status-dot"></span> ${t.online}`;
    }

    function handleQuickAction(action) {
        const t = I18N[currentLang];
        let userText = '';
        let botResponse = '';

        switch(action) {
            case 'products':
                userText = t.quickProducts;
                botResponse = t.productPrompt;
                isAwaitingProductQuery = true;
                isAwaitingOrderNumber = false;
                lastContext = 'products';
                break;
            case 'order':
                userText = t.quickOrder;
                botResponse = t.orderPrompt;
                isAwaitingOrderNumber = true;
                isAwaitingProductQuery = false;
                lastContext = 'order';
                break;
            case 'contact':
                userText = t.quickHuman;
                botResponse = t.humanTransfer;
                // Open WhatsApp after delay
                setTimeout(() => {
                    openWhatsApp();
                }, 1500);
                break;
            case 'faq':
                userText = t.quickFaq;
                botResponse = t.faqPrompt;
                break;
        }

        if (userText) {
            addMessage('user', userText);
            showTyping();
            setTimeout(() => {
                hideTyping();
                addMessage('bot', botResponse);
            }, CHAT_CONFIG.responseDelay);
        }
    }

    async function handleSend() {
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        addMessage('user', text);
        input.value = '';
        showTyping();

        // Save to Supabase
        if (CHAT_CONFIG.enableSupabase) {
            await saveChatMessage('user', text);
        }

        try {
            const response = await processMessage(text);
            hideTyping();
            addMessage('bot', response);

            if (CHAT_CONFIG.enableSupabase) {
                await saveChatMessage('bot', response);
            }
        } catch (err) {
            hideTyping();
            const errorMsg = I18N[currentLang].error;
            addMessage('bot', errorMsg);
        }
    }

    async function processMessage(text) {
        const lowerText = text.toLowerCase();
        const t = I18N[currentLang];

        // CONTEXT-AWARE RESPONSES

        // If awaiting order number
        if (isAwaitingOrderNumber) {
            isAwaitingOrderNumber = false;
            return await trackOrder(text);
        }

        // If awaiting product query
        if (isAwaitingProductQuery) {
            isAwaitingProductQuery = false;
            return await recommendProducts(text);
        }

        // 1. RULE-BASED RESPONSES

        // Human transfer
        if (lowerText.includes('manniska') || lowerText.includes('human') || lowerText.includes('agent') || 
            lowerText.includes('person') || lowerText.includes('kundtjanst') || lowerText.includes('support')) {
            setTimeout(() => openWhatsApp(), 2000);
            return t.humanTransfer + "\n\n📧 info@dekorist.se\n📞 " + CHAT_CONFIG.whatsappNumber;
        }

        // Order tracking
        if (lowerText.includes('order') || lowerText.includes('bestallning') || lowerText.includes('spara') ||
            lowerText.includes('leverans') || lowerText.match(/dk-\d+/i)) {
            if (text.match(/dk-\d+/i) || text.includes('@')) {
                return await trackOrder(text);
            }
            isAwaitingOrderNumber = true;
            return t.orderPrompt;
        }

        // Delivery/Shipping
        if (lowerText.includes('leverans') || lowerText.includes('delivery') || lowerText.includes('frakt') || 
            lowerText.includes('shipping') || lowerText.includes('leveranstid')) {
            return "🚚 **Leveransinformation:**\n\n• Standardleverans: 3-7 arbetsdagar\n• Expressleverans: 1-3 arbetsdagar (extra kostnad)\n• Fri frakt pa bestallningar over 1000 SEK\n• Vi levererar med PostNord, DHL och UPS\n\nVill du spara en specifik bestallning? Ange ditt ordernummer!";
        }

        // Returns
        if (lowerText.includes('retur') || lowerText.includes('return') || lowerText.includes('aterbetalning') || 
            lowerText.includes('refund') || lowerText.includes('oppet kop')) {
            return "🔄 **Returpolicy:**\n\n• 30 dagars oppet kop\n• Produkten maste vara i originalskick\n• Kontakta oss for returfraktsedel\n• Aterbetalning inom 5-10 arbetsdagar efter mottagen retur\n\nLäs mer: https://dekorist.se/returratt/";
        }

        // Payment
        if (lowerText.includes('betalning') || lowerText.includes('payment') || lowerText.includes('klarna') || 
            lowerText.includes('pris') || lowerText.includes('price') || lowerText.includes('faktura')) {
            return "💳 **Betalningsalternativ:**\n\n• Klarna - Betala nu, dela upp eller betala senare\n• Visa / Mastercard\n• Alla transaktioner ar krypterade och sakra\n\nHar du fragor om en specifik faktura?";
        }

        // Products - Rugs/Curtains
        if (lowerText.includes('matta') || lowerText.includes('rug') || lowerText.includes('gardin') || 
            lowerText.includes('curtain') || lowerText.includes('produkt') || lowerText.includes('sortiment')) {
            isAwaitingProductQuery = true;
            return t.productPrompt;
        }

        // Size help
        if (lowerText.includes('storlek') || lowerText.includes('size') || lowerText.includes('dimension') ||
            lowerText.includes('cm') || lowerText.includes('meter')) {
            return t.sizeHelp;
        }

        // Contact/Hours
        if (lowerText.includes('oppettid') || lowerText.includes('hour') || lowerText.includes('kontakt') || 
            lowerText.includes('contact') || lowerText.includes('telefon') || lowerText.includes('email')) {
            return "📞 **Kontaktuppgifter:**\n\n• E-post: info@dekorist.se\n• Telefon: " + CHAT_CONFIG.whatsappNumber + "\n• Oppettider: Man-Fre 09:00-17:00\n• Adress: Stockholm, Sverige\n\nDu kan aven na oss via WhatsApp for snabbast hjalp!";
        }

        // WhatsApp specific
        if (lowerText.includes('whatsapp') || lowerText.includes('chat') || lowerText.includes('meddelande')) {
            setTimeout(() => openWhatsApp(), 1000);
            return t.whatsappRedirect.replace('{number}', CHAT_CONFIG.whatsappNumber);
        }

        // FAQ
        if (lowerText.includes('faq') || lowerText.includes('fragor') || lowerText.includes('hjalp') ||
            lowerText.includes('help')) {
            return t.faqPrompt;
        }

        // 2. AI API FALLBACK (for complex questions)
        if (CHAT_CONFIG.aiApiKey && CHAT_CONFIG.aiApiEndpoint) {
            try {
                return await callAIAPI(text);
            } catch (e) {
                console.error('AI API error:', e);
            }
        }

        // 3. PRODUCT RECOMMENDATION FALLBACK
        if (CHAT_CONFIG.enableSupabase) {
            try {
                return await recommendProducts(text);
            } catch (e) {
                console.error('Product recommendation error:', e);
            }
        }

        // 4. DEFAULT FALLBACK - Create ticket
        if (CHAT_CONFIG.enableSupabase) {
            try {
                const ticket = await createTicket(text);
                return t.ticketCreated.replace('{ticketId}', ticket.id);
            } catch (e) {
                console.error('Ticket creation error:', e);
            }
        }

        return "Tack for din fraga! 😊\n\nJag ar inte helt saker pa svaret just nu. Lat mig koppla dig till var kundtjanst som kan hjalpa dig battre.\n\n📧 info@dekorist.se\n📞 " + CHAT_CONFIG.whatsappNumber + "\n\nEller besok var FAQ: https://dekorist.se/returratt/";
    }

    // ===== SUPABASE INTEGRATIONS =====

    async function trackOrder(query) {
        if (!CHAT_CONFIG.enableSupabase) {
            return "📦 For att spara din bestallning, kontakta oss:\n📧 info@dekorist.se\n📞 " + CHAT_CONFIG.whatsappNumber;
        }

        try {
            let order = null;

            // Try by order number
            if (query.match(/dk-\d+/i)) {
                const orders = await supabaseGet(CHAT_CONFIG.tables.orders, {
                    order_number: 'eq.' + query.toUpperCase(),
                    select: '*'
                });
                order = orders[0];
            }

            // Try by email
            if (!order && query.includes('@')) {
                const orders = await supabaseGet(CHAT_CONFIG.tables.orders, {
                    email: 'eq.' + query,
                    select: '*',
                    order: 'created_at.desc',
                    limit: '1'
                });
                order = orders[0];
            }

            if (order) {
                const t = I18N[currentLang];
                const statusMap = {
                    'pending': 'Vantar pa betalning',
                    'paid': 'Betalning mottagen',
                    'processing': 'Behandlas',
                    'shipped': 'Skickad',
                    'delivered': 'Levererad',
                    'cancelled': 'Avbruten'
                };

                return t.orderFound
                    .replace('{orderNumber}', order.order_number)
                    .replace('{status}', statusMap[order.status] || order.status)
                    .replace('{deliveryDate}', order.estimated_delivery || '3-7 arbetsdagar')
                    .replace('{total}', order.total_amount);
            } else {
                return I18N[currentLang].orderNotFound;
            }
        } catch (error) {
            console.error('Order tracking error:', error);
            return I18N[currentLang].error;
        }
    }

    async function recommendProducts(query) {
        if (!CHAT_CONFIG.enableSupabase) {
            return "🛍️ Besok var katalog for att se hela utbudet:\nhttps://dekorist.se/category.html";
        }

        try {
            const lowerQuery = query.toLowerCase();
            let filters = { active: 'eq.true', limit: '5' };

            // Parse query for filters
            if (lowerQuery.includes('matta') || lowerQuery.includes('rug')) {
                filters.category = 'ilike.*matta*';
            } else if (lowerQuery.includes('gardin') || lowerQuery.includes('curtain')) {
                filters.category = 'ilike.*gardin*';
            }

            // Size filter
            const sizeMatch = query.match(/(\d+)\s*x\s*(\d+)/);
            if (sizeMatch) {
                filters.size = 'ilike.*' + sizeMatch[1] + '*';
            }

            // Color filter
            const colors = ['rod', 'rod', 'blue', 'blå', 'green', 'gron', 'svart', 'black', 'vit', 'white', 'grå', 'gray', 'beige', 'brun', 'brown'];
            const foundColor = colors.find(c => lowerQuery.includes(c));
            if (foundColor) {
                filters.color = 'ilike.*' + foundColor + '*';
            }

            const products = await supabaseGet(CHAT_CONFIG.tables.products, filters);

            if (products && products.length > 0) {
                const productList = products.map(p => {
                    const price = p.discount_price || p.base_price || 0;
                    return `• **${p.name}** - ${price.toLocaleString('sv-SE')} SEK\n  [Se produkt](https://dekorist.se/matta/${p.slug || p.id})`;
                }).join('\n\n');

                return I18N[currentLang].productFound.replace('{products}', productList);
            } else {
                return I18N[currentLang].noProductsFound;
            }
        } catch (error) {
            console.error('Product recommendation error:', error);
            return I18N[currentLang].noProductsFound;
        }
    }

    async function createTicket(message) {
        if (!CHAT_CONFIG.enableSupabase) return { id: 'N/A' };

        try {
            const ticket = await supabasePost(CHAT_CONFIG.tables.chatTickets, {
                session_id: chatSessionId,
                message: message,
                status: 'open',
                language: currentLang,
                created_at: new Date().toISOString()
            });
            return ticket[0] || { id: Math.floor(Math.random() * 10000) };
        } catch (error) {
            console.error('Ticket creation error:', error);
            return { id: Math.floor(Math.random() * 10000) };
        }
    }

    async function saveChatMessage(role, content) {
        if (!CHAT_CONFIG.enableSupabase) return;

        try {
            await supabasePost(CHAT_CONFIG.tables.chatHistory, {
                session_id: chatSessionId,
                role: role,
                content: content,
                language: currentLang,
                created_at: new Date().toISOString()
            });
        } catch (error) {
            console.error('Chat history save error:', error);
        }
    }

    async function loadChatHistory() {
        if (!CHAT_CONFIG.enableSupabase) return;

        try {
            const history = await supabaseGet(CHAT_CONFIG.tables.chatHistory, {
                session_id: 'eq.' + chatSessionId,
                order: 'created_at.asc',
                limit: '20'
            });

            if (history && history.length > 0) {
                // Clear current messages except welcome
                const welcomeMsg = messagesContainer.querySelector('.dk-message-bot');
                const quickActions = messagesContainer.querySelector('#dk-quick-actions');
                messagesContainer.innerHTML = '';
                if (welcomeMsg) messagesContainer.appendChild(welcomeMsg);
                if (quickActions) messagesContainer.appendChild(quickActions);

                // Load history
                history.forEach(msg => {
                    if (msg.role === 'user' || msg.role === 'bot') {
                        addMessage(msg.role, msg.content, false);
                    }
                });
            }
        } catch (error) {
            console.error('Chat history load error:', error);
        }
    }

    async function callAIAPI(text) {
        const response = await fetch(CHAT_CONFIG.aiApiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + CHAT_CONFIG.aiApiKey
            },
            body: JSON.stringify({
                model: CHAT_CONFIG.aiModel,
                messages: [
                    { 
                        role: 'system', 
                        content: 'You are a helpful customer service assistant for Dream Kilim (DKRug & Gardiner), a Swedish rug and curtain store. Answer in ' + (currentLang === 'sv' ? 'Swedish' : 'English') + '. Be concise, friendly, and helpful. If you cannot help with a specific order issue, suggest contacting info@dekorist.se or WhatsApp ' + CHAT_CONFIG.whatsappNumber + '. Keep responses under 150 words.' 
                    },
                    ...messageHistory.slice(-CHAT_CONFIG.maxHistory),
                    { role: 'user', content: text }
                ],
                max_tokens: 250,
                temperature: 0.7
            })
        });
        const data = await response.json();
        return data.choices[0].message.content;
    }

    // ===== WHATSAPP INTEGRATION =====
    function openWhatsApp() {
        const message = encodeURIComponent(CHAT_CONFIG.whatsappMessage);
        const url = 'https://wa.me/' + CHAT_CONFIG.whatsappNumber.replace(/[^0-9]/g, '') + '?text=' + message;

        // Try to open WhatsApp
        const newWindow = window.open(url, '_blank');

        // If popup blocked, show fallback
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            addMessage('bot', "📱 **WhatsApp:**\n\nKlicka pa lanken for att oppna WhatsApp:\nhttps://wa.me/" + CHAT_CONFIG.whatsappNumber.replace(/[^0-9]/g, '') + "\n\nEller skicka ett meddelande till: " + CHAT_CONFIG.whatsappNumber);
        }
    }

    // ===== UI FUNCTIONS =====
    function addMessage(sender, text, save = true) {
        if (!messagesContainer) return;

        const div = document.createElement('div');
        div.className = 'dk-message dk-message-' + sender;
        div.style.cssText = sender === 'user' 
            ? 'display: flex; gap: 10px; max-width: 85%; align-self: flex-end; flex-direction: row-reverse; animation: dk-fadeIn 0.3s ease;'
            : 'display: flex; gap: 10px; max-width: 85%; align-self: flex-start; animation: dk-fadeIn 0.3s ease;';

        const avatar = sender === 'bot' 
            ? '<div style="width: 32px; height: 32px; background: linear-gradient(135deg, #1a1a2e, #16213e); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 4px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>'
            : '<div style="width: 32px; height: 32px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 4px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>';

        const bubbleStyle = sender === 'user'
            ? 'background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 14px 18px; border-radius: 18px 18px 4px 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);'
            : 'background: white; padding: 14px 18px; border-radius: 18px 18px 18px 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid rgba(0,0,0,0.06);';

        const textColor = sender === 'user' ? 'color: white;' : 'color: #1a1a2e;';

        div.innerHTML = avatar + '<div style="' + bubbleStyle + '"><p style="margin: 0; font-size: 14px; line-height: 1.6; ' + textColor + '">' + formatText(text) + '</p></div>';

        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        if (save) {
            messageHistory.push({ role: sender === 'user' ? 'user' : 'assistant', content: text });
            if (messageHistory.length > CHAT_CONFIG.maxHistory) {
                messageHistory = messageHistory.slice(-CHAT_CONFIG.maxHistory);
            }
        }
    }

    function formatText(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 600;">$1</strong>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color: inherit; text-decoration: underline;">$1</a>')
            .replace(/\n/g, '<br>');
    }

    function showTyping() {
        if (typingIndicator) typingIndicator.style.display = 'block';
        if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function hideTyping() {
        if (typingIndicator) typingIndicator.style.display = 'none';
    }

    // ===== INIT =====
    function init() {
        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initChat);
        } else {
            initChat();
        }
    }

    function initChat() {
        getElements();
        if (!trigger) {
            console.warn('[DK Chat] Trigger element not found, retrying...');
            setTimeout(initChat, 500);
            return;
        }
        initChatEvents();
        console.log('[DK Chat] Hybrid AI Chat v2.0 initialized | Supabase: ' + (CHAT_CONFIG.enableSupabase ? 'AKTIF' : 'PASIF') + ' | Lang: ' + currentLang);

        // Show unread badge after 5 seconds
        setTimeout(() => {
            if (!isOpen && unreadBadge) {
                unreadBadge.style.display = 'flex';
            }
        }, 5000);
    }

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes dk-fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);

    init();
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

    // 4. Hybrid AI Chat (otomatik init icinde kendi init fonksiyonu var)
    // Chat widget IIFE olarak calisir, kendi init'ini kendisi yapar

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
});

console.log('common.js v8.0 yuklendi - Hybrid AI Chat + Supabase Entegrasyonu aktif');
