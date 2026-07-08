// ==========================================
// CATEGORY.JS - v6.0 (TEMİZ)
// ==========================================

if (window.__categoryJsInitialized) {
    console.log('category.js zaten yuklendi.');
} else {
    window.__categoryJsInitialized = true;

    let allProducts = [];
    let filteredProducts = [];
    let currentPage = 0;
    const ITEMS_PER_PAGE = 12;

    const SUPABASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE) ? CONFIG.SUPABASE.URL : '';
    const SUPABASE_KEY = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE) ? CONFIG.SUPABASE.ANON_KEY : '';

    async function supabaseGet(endpoint, params) {
        const url = new URL(SUPABASE_URL + '/rest/v1/' + endpoint);
        if (params) Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        const res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY,
                'Content-Type': 'application/json'
            }
        });
        if (!res.ok) throw new Error('Supabase hatasi: ' + res.status);
        return res.json();
    }

    function getCurrentCategory() {
        const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
        return path.split('/')[0] || null;
    }

    function getCurrentSubCategory() {
        return new URLSearchParams(window.location.search).get('kategori');
    }

    function isReaPage() {
        return window.location.pathname.includes('/rea/');
    }

    // ==========================================
    // RENK EŞLEŞTİRME
    // ==========================================
    const COLOR_MAP = {
        'rod': '#D32F2F', 'röd': '#D32F2F', 'red': '#D32F2F',
        'bla': '#1976D2', 'blå': '#1976D2', 'blue': '#1976D2',
        'gron': '#388E3C', 'grön': '#388E3C', 'green': '#388E3C',
        'gul': '#FBC02D', 'yellow': '#FBC02D',
        'svart': '#212121', 'black': '#212121',
        'vit': '#FAFAFA', 'white': '#FAFAFA',
        'grå': '#9E9E9E', 'gra': '#9E9E9E', 'grey': '#9E9E9E',
        'beige': '#D7CCC8',
        'flerfargad': 'linear-gradient(135deg, #FF6B6B, #4ECDC4)',
        'flerfärgad': 'linear-gradient(135deg, #FF6B6B, #4ECDC4)',
        'multicolor': 'linear-gradient(135deg, #FF6B6B, #4ECDC4)',
    };

    function getColorStyle(colorName) {
        if (!colorName) return '#ccc';
        const normalized = colorName.toLowerCase().trim();
        return COLOR_MAP[normalized] || '#ccc';
    }

    // ==========================================
    // ÜRÜN ÇEKME
    // ==========================================
    async function fetchProducts() {
        const grid = document.getElementById('product-grid');
        if (!grid) return;

        try {
            const currentCategory = getCurrentCategory();
            const subCategory = getCurrentSubCategory();

            const queryParams = {
                select: '*',
                active: 'eq.true'
            };

            if (isReaPage()) {
                queryParams.discount_price = 'not.is.null';
            } else if (currentCategory) {
                queryParams.categories = 'cs.{"' + currentCategory + '"}';
            }

            if (subCategory) {
                queryParams.sub_category = 'eq.' + subCategory;
            }

            const products = await supabaseGet('products', queryParams);
            const variants = await supabaseGet('product_variants', { select: '*' });

            allProducts = products.map(p => ({
                id: String(p.id),
                name: p.name || 'Urun',
                price: p.discount_price || p.base_price || 0,
                base_price: p.base_price || 0,
                discount_price: p.discount_price || null,
                image: p.images && p.images[0] ? p.images[0] : '',
                slug: p.slug || '',
                description: p.description || '',
                colors: p.colors || [],
                sizes: variants.filter(v => v.product_id === p.id).map(v => v.size),
                variants: variants.filter(v => v.product_id === p.id)
            }));

            filteredProducts = [...allProducts];
            renderProducts();
            generateFilters();
            updateProgress();

        } catch (error) {
            console.error('Urun cekme hatasi:', error);
            grid.innerHTML = '<div style="text-align:center;padding:80px;"><p>Kunde inte ladda produkter.</p></div>';
        }
    }

    // ==========================================
    // ÜRÜN KARTI OLUŞTURMA - BURASI KRİTİK
    // ==========================================
    function createProductCard(product, isWishlisted) {
        const hasDiscount = product.discount_price && product.discount_price < product.base_price;
        
        // FİYAT GÖSTERİMİ
        let priceHTML;
        if (hasDiscount) {
            priceHTML = `<span style="text-decoration:line-through;color:#999;font-size:14px;margin-right:8px;">${product.base_price.toLocaleString('sv-SE')} SEK</span>
                        <span style="color:#e54d42;font-weight:600;">${product.price.toLocaleString('sv-SE')} SEK</span>`;
        } else {
            priceHTML = `<span style="font-weight:600;">${product.price.toLocaleString('sv-SE')} SEK</span>`;
        }

        // VARYANT METNİ
        const variantText = product.variants.length > 0 
            ? (product.variants[0].size || 'Standard') + (product.variants.length > 1 ? ' (+ ' + (product.variants.length - 1) + ' storlekar)' : '')
            : 'Standard';

        // 🔥 KRİTİK: URL OLUŞTURMA - SADECE SLUG KULLAN
        // Eğer slug yoksa ID ile oluştur ama URL'de "slug" kelimesi olmasın
        const productUrl = product.slug 
            ? '/produkt/' + encodeURIComponent(product.slug)
            : '/produkt/?id=' + product.id;

        return `
            <article class="product-card" data-id="${product.id}">
                <div class="image-box">
                    <a href="${productUrl}" class="product-link">
                        <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.style.display='none'">
                    </a>
                    ${hasDiscount ? '<span class="discount-badge">REA</span>' : ''}
                    <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" data-id="${product.id}" type="button">
                        <i class="${isWishlisted ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                    </button>
                </div>
                <div class="product-info">
                    <h3 class="product-title">
                        <a href="${productUrl}" class="product-title-link">${product.name}</a>
                    </h3>
                    <p class="product-variant">${variantText}</p>
                    <div class="product-price">${priceHTML}</div>
                    ${product.colors.length > 0 ? `
                        <div class="product-colors">
                            ${product.colors.slice(0, 5).map(c => `<span class="color-dot" style="background:${getColorStyle(c)}" title="${c}"></span>`).join('')}
                            ${product.colors.length > 5 ? '<span>+' + (product.colors.length - 5) + '</span>' : ''}
                        </div>
                    ` : ''}
                </div>
            </article>
        `;
    }

    // ==========================================
    // ÜRÜN RENDER ETME
    // ==========================================
    function renderProducts(append = false) {
        const grid = document.getElementById('product-grid');
        if (!grid) return;

        if (!append) {
            grid.innerHTML = '';
            currentPage = 0;
        }

        const start = currentPage * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const toShow = filteredProducts.slice(start, end);

        if (toShow.length === 0 && !append) {
            grid.innerHTML = '<div style="text-align:center;padding:60px;"><p>Inga produkter hittades.</p></div>';
            document.getElementById('load-more-container').style.display = 'none';
            return;
        }

        toShow.forEach(product => {
            const isWishlisted = isInWishlist(product.id);
            grid.insertAdjacentHTML('beforeend', createProductCard(product, isWishlisted));
        });

        // Wishlist event'lerini bağla
        attachWishlistEvents();

        const shown = (currentPage + 1) * ITEMS_PER_PAGE;
        document.getElementById('load-more-container').style.display = shown >= filteredProducts.length ? 'none' : 'block';
    }

    // ==========================================
    // WISHLIST - SADECE BUTONA TIKLANINCA ÇALIŞSIN
    // ==========================================
    function isInWishlist(productId) {
        try {
            const wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
            return wishlist.some(item => String(item.id || item) === String(productId));
        } catch (e) { return false; }
    }

    function attachWishlistEvents() {
        const grid = document.getElementById('product-grid');
        if (!grid) return;

        // Önceki listener'ı temizle (varsa)
        grid.removeEventListener('click', handleGridClick);
        // Yeni listener ekle
        grid.addEventListener('click', handleGridClick);
    }

    function handleGridClick(e) {
        // Wishlist butonuna mı tıklandı?
        const wishBtn = e.target.closest('.wishlist-btn');
        
        if (wishBtn) {
            e.preventDefault();
            e.stopPropagation();
            
            const productId = wishBtn.dataset.id;
            const product = allProducts.find(p => p.id === productId);
            if (!product) return;

            let wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
            const index = wishlist.findIndex(item => String(item.id || item) === productId);

            if (index > -1) {
                wishlist.splice(index, 1);
                wishBtn.classList.remove('active');
                wishBtn.querySelector('i').className = 'fa-regular fa-heart';
            } else {
                wishlist.push({ id: product.id, name: product.name, price: product.price, image: product.image });
                wishBtn.classList.add('active');
                wishBtn.querySelector('i').className = 'fa-solid fa-heart';
            }

            localStorage.setItem('wishlistItems', JSON.stringify(wishlist));
            if (typeof updateWishlistBadge === 'function') updateWishlistBadge();
            
            return; // Burada bitir, link tıklamasına izin verme
        }

        // Wishlist butonu değilse -> normal link davranışı (hiçbir şey yapma)
        // <a> tag'i kendi href'ine gidecek
    }

    // ==========================================
    // FİLTRELER (Basitleştirilmiş)
    // ==========================================
    function generateFilters() {
        // ... mevcut filtre kodun ...
    }

    function updateProgress() {
        const current = document.getElementById('current-count');
        const total = document.getElementById('total-count');
        const bar = document.getElementById('progress-bar-fill');
        const shown = Math.min((currentPage + 1) * ITEMS_PER_PAGE, filteredProducts.length);
        if (current) current.textContent = shown;
        if (total) total.textContent = filteredProducts.length;
        if (bar) bar.style.width = filteredProducts.length > 0 ? (shown / filteredProducts.length * 100) + '%' : '0%';
    }

    // ==========================================
    // BAŞLAT
    // ==========================================
    document.addEventListener('DOMContentLoaded', () => {
        fetchProducts();
        
        // Load more
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                currentPage++;
                renderProducts(true);
                updateProgress();
            });
        }
    });
}
