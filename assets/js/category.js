// ==========================================
// CATEGORY.JS - AIRTABLE UYUMLU
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

    // --- 3. AIRTABLE'DAN URUN CEK ---
    async function fetchProducts() {
        try {
            const url = `https://api.airtable.com/v0/${CONFIG.AIRTABLE.BASE_ID}/${CONFIG.AIRTABLE.TABLE_NAME}?pageSize=100`;

            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${CONFIG.AIRTABLE.API_KEY}` }
            });

            if (!response.ok) throw new Error('API hatasi: ' + response.status);

            const data = await response.json();

            allProducts = data.records.map(record => ({
                id: record.id,
                name: record.fields.Name || 'Urun',
                price: parseFloat(record.fields.Price) || 0,
                image: record.fields.imageURL && record.fields.imageURL[0] ? record.fields.imageURL[0].url : '',
                slug: record.fields.Slug || '',
                description: record.fields.Description || '',
                variants: record.fields.Variants || 'Standard',
                colors: record.fields.Colors ? record.fields.Colors.split(',').map(c => c.trim()) : [],
                sizes: record.fields.Sizes ? record.fields.Sizes.split(',').map(s => s.trim()) : [],
                stock: record.fields.Stock || 'In Stock'
            }));

            filteredProducts = [...allProducts];

            console.log(`${allProducts.length} urun yuklendi`);

            // Ilk render
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

        // Wishlist event listenerlarini ekle
        attachWishlistEvents();

        // Load more butonunu kontrol et
        const shown = (currentPage + 1) * ITEMS_PER_PAGE;
        if (shown >= filteredProducts.length) {
            document.getElementById('load-more-container').style.display = 'none';
        } else {
            document.getElementById('load-more-container').style.display = 'block';
        }
    }

    function createProductCard(product, isWishlisted) {
        return `
            <div class="product-card" data-id="${product.id}">
                <div class="image-box">
                    <a href="="/matta/${product.slug}">
                        <img src="${product.image}" 
                             alt="${product.name}" 
                             loading="lazy"
                             onerror="this.style.display='none'"
                             style="width:100%; height:100%; object-fit:cover;">
                    </a>
                    <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" 
                            data-product-id="${product.id}"
                            aria-label="Lagg till favoriter">
                        <i class="${isWishlisted ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                    </button>
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.name}</h3>
                    <div class="product-meta-row">
                        <span class="product-acf-dimension">${product.variants}</span>
                    </div>
                    <div class="product-price">
                        <span class="current-price">${product.price.toLocaleString('sv-SE')} SEK</span>
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
                            ${product.colors.length > 5 ? `<span class="color-count-text">+${product.colors.length - 5} farger</span>` : ''}
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
            return wishlist.some(item => item.id === productId);
        } catch (e) {
            return false;
        }
    }

    function attachWishlistEvents() {
        document.querySelectorAll('.wishlist-btn').forEach(btn => {
            // Onceki listener'lari temizle (duplicate onlemek icin)
            btn.replaceWith(btn.cloneNode(true));
        });

        // Yeni listener'lari ekle
        document.querySelectorAll('.wishlist-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const productId = this.dataset.productId;
                const productCard = this.closest('.product-card');

                // Urun bilgilerini al
                const product = allProducts.find(p => p.id === productId);
                if (!product) return;

                // Wishlist'i guncelle
                let wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
                const index = wishlist.findIndex(item => item.id === productId);

                if (index > -1) {
                    // Kaldir
                    wishlist.splice(index, 1);
                    this.classList.remove('active');
                    this.querySelector('i').className = 'fa-regular fa-heart';
                } else {
                    // Ekle
                    wishlist.push({
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        image: product.image
                    });
                    this.classList.add('active');
                    this.querySelector('i').className = 'fa-solid fa-heart';
                }

                localStorage.setItem('wishlistItems', JSON.stringify(wishlist));

                // Header badge'i guncelle
                updateWishlistBadge();

                // Mini bildirim (opsiyonel)
                console.log(index > -1 ? 'Favorilerden kaldirildi' : 'Favorilere eklendi');
            });
        });
    }

    function updateWishlistBadge() {
        const wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
        const badge = document.querySelector('.wishlist-count-badge');
        if (badge) {
            badge.textContent = wishlist.length;
            badge.classList.toggle('visible', wishlist.length > 0);
        }
    }

    // --- 6. FILTRELER ---
    function generateFilters() {
        // Renk filtresi
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

        // Boyut filtresi
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

        // Filtre checkbox event'lerini bagla
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
        // Filtre drawer
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

        // Sort drawer
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

    // Global fonksiyon (HTML onclick icin)
    window.closeAll = closeAllDrawers;

    // --- 10. BASLAT ---
    await fetchProducts();
    initSort();
    initDrawers();
    updateWishlistBadge();

    console.log('Category.js baslatildi');
});