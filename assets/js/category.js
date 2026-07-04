// ==========================================
// CATEGORY.JS - SUPABASE UYUMLU
// ==========================================

console.log('category.js yukleniyor...');
console.log('CONFIG durumu:', typeof CONFIG !== 'undefined' ? 'Yuklu' : 'YUKLU DEGIL!');

document.addEventListener('DOMContentLoaded', async () => {

    // --- 1. DEGISKENLER ---
    let allProducts = [];
    let filteredProducts = [];
    let currentPage = 0;
    const ITEMS_PER_PAGE = 12;

    // --- 2. ELEMENTLER ---
    const grid = document.getElementById('product-grid');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const currentCountEl = document.getElementById('current-count');
    const totalCountEl = document.getElementById('total-count');
    const progressBar = document.getElementById('progress-bar-fill');

    // --- SUPABASE CLIENT ---
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
        if (!res.ok) {
            const errText = await res.text();
            console.error('Supabase hata detayi:', errText);
            throw new Error('Supabase GET hatasi: ' + res.status + ' - ' + errText);
        }
        return res.json();
    }

    function getDisplayPrice(product) {
        return product.discount_price || product.base_price || 0;
    }

    // --- 3. SUPABASE'DEN URUN CEK ---
    async function fetchProducts() {
        try {
            // ONCELIKLE: products tablosunu tek basina cek (embed olmadan)
            // Eger bu calisirsa RLS veya embed syntax sorunu var demek
            let data;
            try {
                data = await supabaseGet('products', {
                    select: '*,product_variants:id(*)',
                    active: 'eq.true'
                });
            } catch (embedErr) {
                console.warn('Embed cekme basarisiz, duz cekme deneniyor:', embedErr.message);
                // Duz cekme dene
                const products = await supabaseGet('products', {
                    select: '*',
                    active: 'eq.true'
                });

                // Varyantlari ayri cek
                const variants = await supabaseGet('product_variants', {
                    select: '*'
                });

                // Birlestir
                data = products.map(p => ({
                    ...p,
                    product_variants: variants.filter(v => v.product_id === p.id)
                }));
            }

            allProducts = data.map(product => ({
                id: product.id,
                name: product.name || 'Urun',
                price: getDisplayPrice(product),
                base_price: product.base_price || 0,
                discount_price: product.discount_price || null,
                image: product.images && product.images[0] ? product.images[0] : '',
                slug: product.slug || '',
                description: product.description || '',
                variants: product.product_variants || [],
                colors: product.colors || [],
                sizes: product.product_variants ? product.product_variants.map(v => v.size) : [],
                stock: product.product_variants && product.product_variants.length > 0 
                    ? (product.product_variants.some(v => v.stock > 0) ? 'In Stock' : 'Out of Stock')
                    : 'In Stock',
                delivery_time: product.delivery_time || '3-7 arbetsdagar'
            }));

            filteredProducts = [...allProducts];

            console.log(allProducts.length + ' urun yuklendi');

            renderProducts();
            updateProgress();
            generateFilters();

        } catch (error) {
            console.error('Urun cekme hatasi:', error);
            grid.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:80px 20px;">
                    <p style="font-size:18px; color:#666; margin-bottom:20px;">Kunde inte ladda produkter.</p>
                    <p style="color:#999; margin-bottom:30px;">${error.message}</p>
                    <button onclick="location.reload()" class="visa-mer-btn">Forsok igen</button>
                </div>
            `;
        }
    }

    // --- 4. URUN RENDER ---
    function renderProducts(append = false) {
        if (!append) {
            grid.innerHTML = '';
            currentPage = 0;
        }

        const start = currentPage * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const productsToShow = filteredProducts.slice(start, end);

        if (productsToShow.length === 0 && !append) {
            grid.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:60px;">
                    <p style="font-size:18px; color:#666;">Inga produkter hittades.</p>
                </div>
            `;
            document.getElementById('load-more-container').style.display = 'none';
            return;
        }

        productsToShow.forEach(product => {
            const isWishlisted = isInWishlist(product.id);
            const cardHTML = createProductCard(product, isWishlisted);
            grid.insertAdjacentHTML('beforeend', cardHTML);
        });

        attachWishlistEvents();

        const shown = (currentPage + 1) * ITEMS_PER_PAGE;
        if (shown >= filteredProducts.length) {
            document.getElementById('load-more-container').style.display = 'none';
        } else {
            document.getElementById('load-more-container').style.display = 'block';
        }
    }

    function createProductCard(product, isWishlisted) {
        const hasDiscount = product.discount_price && product.discount_price < product.base_price;
        const priceHTML = hasDiscount 
            ? '<span class="original-price" style="text-decoration:line-through;color:#999;font-size:14px;">' + product.base_price.toLocaleString('sv-SE') + ' SEK</span>' +
              '<span class="current-price" style="color:#e54d42;">' + product.price.toLocaleString('sv-SE') + ' SEK</span>'
            : '<span class="current-price">' + product.price.toLocaleString('sv-SE') + ' SEK</span>';

        const variantText = product.variants.length > 1 
            ? product.variants.length + ' storlekar' 
            : (product.variants[0]?.size || 'Standard');

        return `
            <div class="product-card" data-id="${product.id}">
                <div class="image-box">
                    <a href="/matta/${product.slug}">
                        <img src="${product.image}" 
                             alt="${product.name}" 
                             loading="lazy"
                             onerror="this.style.display='none'"
                             style="width:100%; height:100%; object-fit:cover;">
                    </a>
                    ${hasDiscount ? '<span class="discount-badge" style="position:absolute;top:8px;left:8px;background:#e54d42;color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:bold;">REA</span>' : ''}
                    <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" 
                            data-product-id="${product.id}"
                            aria-label="Lagg till favoriter">
                        <i class="${isWishlisted ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                    </button>
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.name}</h3>
                    <div class="product-meta-row">
                        <span class="product-acf-dimension">${variantText}</span>
                    </div>
                    <div class="product-price">
                        ${priceHTML}
                    </div>
                    ${product.colors.length > 0 ? `
                        <div class="product-colors-wrapper">
                            <div class="product-colors-swatches">
                                ${product.colors.slice(0, 5).map(color => `
                                    <span class="swatch-circle" 
                                          style="background-color:${color};"
                                          title="${color}"></span>
                                `).join('')}
                            </div>
                            ${product.colors.length > 5 ? '<span class="color-count-text">+' + (product.colors.length - 5) + ' farger</span>' : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // --- 5. WISHLIST FONKSIYONLARI ---
    function isInWishlist(productId) {
        try {
            const wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
            return wishlist.some(item => (typeof item === 'string' ? item : item.id) === productId);
        } catch (e) {
            return false;
        }
    }

    function attachWishlistEvents() {
        const grid = document.getElementById('product-grid');
        if (!grid) return;
        grid.removeEventListener('click', handleWishlistClick);
        grid.addEventListener('click', handleWishlistClick);
    }

    function handleWishlistClick(e) {
        const btn = e.target.closest('.wishlist-btn');
        if (!btn) return;

        e.preventDefault();
        e.stopPropagation();

        const productId = btn.dataset.productId;
        if (!productId) return;

        const product = allProducts.find(p => p.id === productId);
        if (!product) return;

        let wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
        const index = wishlist.findIndex(item => (typeof item === 'string' ? item : item.id) === productId);

        if (index > -1) {
            wishlist.splice(index, 1);
            btn.classList.remove('active');
            const icon = btn.querySelector('i');
            if (icon) icon.className = 'fa-regular fa-heart';
            console.log('Favorilerden kaldirildi:', product.name);
        } else {
            wishlist.push({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image
            });
            btn.classList.add('active');
            const icon = btn.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-heart';
            console.log('Favorilere eklendi:', product.name);
        }

        localStorage.setItem('wishlistItems', JSON.stringify(wishlist));
        updateWishlistBadge();
    }

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

    // --- 6. FILTRELER ---
    function generateFilters() {
        const allColors = [...new Set(allProducts.flatMap(p => p.colors))].filter(Boolean).sort();
        const colorContainer = document.getElementById('color-filter-list');
        if (colorContainer && allColors.length > 0) {
            colorContainer.innerHTML = allColors.map(color => `
                <div class="filter-row">
                    <input type="checkbox" 
                           class="filter-input" 
                           id="color-${color.replace(/\s/g, '-')}" 
                           value="${color}" 
                           data-type="color">
                    <label class="filter-row-label" for="color-${color.replace(/\s/g, '-')}">
                        <span class="color-circle" style="background-color:${color};"></span>
                        <span>${color}</span>
                        <i class="fa-solid fa-check check-icon"></i>
                    </label>
                </div>
            `).join('');
        }

        const allSizes = [...new Set(allProducts.flatMap(p => p.sizes))].filter(Boolean).sort();
        const sizeContainer = document.getElementById('size-filter-list');
        if (sizeContainer && allSizes.length > 0) {
            sizeContainer.innerHTML = allSizes.map(size => `
                <div class="filter-row">
                    <input type="checkbox" 
                           class="filter-input" 
                           id="size-${size.replace(/\s/g, '-')}" 
                           value="${size}" 
                           data-type="size">
                    <label class="filter-row-label" for="size-${size.replace(/\s/g, '-')}">
                        <span>${size}</span>
                        <i class="fa-solid fa-check check-icon"></i>
                    </label>
                </div>
            `).join('');
        }

        document.querySelectorAll('.filter-input').forEach(input => {
            input.addEventListener('change', applyFilters);
        });
    }

    function applyFilters() {
        const checkedColors = Array.from(document.querySelectorAll('input[data-type="color"]:checked')).map(el => el.value);
        const checkedSizes = Array.from(document.querySelectorAll('input[data-type="size"]:checked')).map(el => el.value);

        filteredProducts = allProducts.filter(product => {
            const colorMatch = checkedColors.length === 0 || product.colors.some(c => checkedColors.includes(c));
            const sizeMatch = checkedSizes.length === 0 || product.sizes.some(s => checkedSizes.includes(s));
            return colorMatch && sizeMatch;
        });

        currentPage = 0;
        renderProducts();
        updateProgress();
        updateFilterBadge(checkedColors.length + checkedSizes.length);
    }

    function updateFilterBadge(count) {
        const badge = document.querySelector('.filter-badge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        }
    }

    // --- 7. SORT (SIRALAMA) ---
    function initSort() {
        document.querySelectorAll('input[name="orderby"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const sortType = e.target.value;

                switch(sortType) {
                    case 'price-asc':
                        filteredProducts.sort((a, b) => a.price - b.price);
                        break;
                    case 'price-desc':
                        filteredProducts.sort((a, b) => b.price - a.price);
                        break;
                    case 'name-asc':
                        filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
                        break;
                    case 'name-desc':
                        filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
                        break;
                    default:
                        filteredProducts.sort((a, b) => a.id.localeCompare(b.id));
                }

                currentPage = 0;
                renderProducts();
                closeAllDrawers();
            });
        });
    }

    // --- 8. LOAD MORE ---
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage++;
            renderProducts(true);
            updateProgress();
        });
    }

    function updateProgress() {
        const shown = Math.min((currentPage + 1) * ITEMS_PER_PAGE, filteredProducts.length);
        const total = filteredProducts.length;

        if (currentCountEl) currentCountEl.textContent = shown;
        if (totalCountEl) totalCountEl.textContent = total;
        if (progressBar) {
            const percentage = total > 0 ? (shown / total) * 100 : 0;
            progressBar.style.width = percentage + '%';
        }
    }

    // --- 9. DRAWER AC/KAPA ---
    function initDrawers() {
        const openFilter = document.getElementById('open-filter-sidebar');
        const closeFilter = document.getElementById('close-filter-sidebar');
        const filterOverlay = document.getElementById('filter-overlay');
        const filterDrawer = document.getElementById('filter-sidebar');

        openFilter?.addEventListener('click', () => {
            filterDrawer?.classList.add('active');
            filterOverlay?.classList.add('active');
            document.body.style.overflow = 'hidden';
        });

        const closeFilterFn = () => {
            filterDrawer?.classList.remove('active');
            filterOverlay?.classList.remove('active');
            document.body.style.overflow = '';
        };

        closeFilter?.addEventListener('click', closeFilterFn);
        filterOverlay?.addEventListener('click', closeFilterFn);

        const openSort = document.getElementById('sort-menu-btn');
        const closeSort = document.getElementById('close-sort-drawer');
        const sortOverlay = document.getElementById('sort-overlay');
        const sortDrawer = document.getElementById('sort-drawer');

        openSort?.addEventListener('click', () => {
            sortDrawer?.classList.add('active');
            sortOverlay?.classList.add('active');
            document.body.style.overflow = 'hidden';
        });

        const closeSortFn = () => {
            sortDrawer?.classList.remove('active');
            sortOverlay?.classList.remove('active');
            document.body.style.overflow = '';
        };

        closeSort?.addEventListener('click', closeSortFn);
        sortOverlay?.addEventListener('click', closeSortFn);
    }

    function closeAllDrawers() {
        document.querySelectorAll('#filter-sidebar, #sort-drawer').forEach(el => el?.classList.remove('active'));
        document.querySelectorAll('#filter-overlay, #sort-overlay').forEach(el => el?.classList.remove('active'));
        document.body.style.overflow = '';
    }

    window.closeAll = closeAllDrawers;

    // --- 10. BASLAT ---
    await fetchProducts();
    initSort();
    initDrawers();
    updateWishlistBadge();

    console.log('Category.js baslatildi');
});