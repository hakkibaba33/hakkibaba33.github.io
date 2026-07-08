// ==========================================
// CATEGORY.JS - SUPABASE UYUMLU (v5.6)
// Renk eslestirme + Modern filtre yapisi
// ==========================================

console.log('category.js yukleniyor...');
console.log('CONFIG durumu:', typeof CONFIG !== 'undefined' ? 'Yuklu' : 'YUKLU DEGIL!');

function getCurrentCategory() {
    const path = window.location.pathname;
    const category = path.replace(/^\/|\/$/g, '');
    console.log('URL path:', path);
    console.log('Kategori:', category);
    return category || null;
}

function getCurrentSubCategory() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('kategori');
}

function isReaPage() {
    return window.location.pathname.includes('/rea/');
}

function updatePageTitle(category, categoryData) {
    let title = 'Produkter';
    if (categoryData && categoryData.name_sv) {
        title = categoryData.name_sv;
    } else {
        const titleMap = {
            'mattor': 'Mattor',
            'gardiner': 'Gardiner',
            'mobler': 'Möbler',
            'belysning': 'Belysning',
            'dekoration': 'Dekoration',
            'rea': 'REA',
            'kontakt': 'Kontakt'
        };
        title = titleMap[category] || 'Produkter';
    }

    document.title = 'Alla ' + title + ' | DKRUG';

    const pageTitle = document.getElementById('category-main-title');
    if (pageTitle) {
        pageTitle.textContent = 'Alla ' + title;
    }

    const breadcrumbCurrent = document.getElementById('breadcrumb-current');
    if (breadcrumbCurrent) {
        breadcrumbCurrent.textContent = title;
    }
}

function updateChipsActiveState() {
    const urlParams = new URLSearchParams(window.location.search);
    const currentKategori = urlParams.get('kategori');

    document.querySelectorAll('.category-chip').forEach(chip => {
        chip.classList.remove('active');
        const chipKategori = chip.dataset.chip;

        if (!currentKategori && chipKategori === 'alla') {
            chip.classList.add('active');
        } else if (currentKategori === chipKategori) {
            chip.classList.add('active');
        }
    });
}

function initChipsRouting() {
    const chipsContainer = document.getElementById('category-chips-list');
    if (!chipsContainer) return;

    chipsContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.category-chip');
        if (!chip) return;

        e.preventDefault();
        e.stopPropagation();

        const href = chip.getAttribute('href');
        if (!href) return;

        window.history.pushState({}, '', href);
        updateChipsActiveState();
        fetchProducts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ==========================================
// RENK ESLESTIRME - Isvecce renk isimleri -> CSS renk kodlari
// ==========================================
const COLOR_MAP = {
    // Temel Renkler
    'rod': '#D32F2F', 'röd': '#D32F2F', 'red': '#D32F2F',
    'bla': '#1976D2', 'blå': '#1976D2', 'blue': '#1976D2',
    'gron': '#388E3C', 'grön': '#388E3C', 'green': '#388E3C',
    'gul': '#FBC02D', 'yellow': '#FBC02D',
    'orange': '#F57C00',
    'rosa': '#E91E63', 'pink': '#E91E63',
    'lila': '#7B1FA2', 'purple': '#7B1FA2',
    'svart': '#212121', 'black': '#212121',
    'vit': '#FAFAFA', 'white': '#FAFAFA',
    'grå': '#9E9E9E', 'gra': '#9E9E9E', 'grey': '#9E9E9E', 'gray': '#9E9E9E',
    'brun': '#5D4037', 'brown': '#5D4037',
    'beige': '#D7CCC8',
    'turkos': '#00BCD4', 'turquoise': '#00BCD4',
    'guld': '#FFD700', 'gold': '#FFD700',
    'silver': '#C0C0C0',
    'bronze': '#CD7F32', 'brons': '#CD7F32',
    'krem': '#FFF8E1', 'cream': '#FFF8E1',
    'oliv': '#556B2F', 'olive': '#556B2F',
    'marin': '#1A237E', 'navy': '#1A237E', 'marinblå': '#1A237E',
    'mint': '#98FF98',
    'korall': '#FF7F50', 'coral': '#FF7F50',
    'vinröd': '#722F37', 'bordo': '#722F37', 'burgundy': '#722F37',
    'taupe': '#483C32',
    'mullvad': '#8B7355',
    'flerfargad': 'linear-gradient(135deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4)', 
    'flerfärgad': 'linear-gradient(135deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4)',
    'multicolor': 'linear-gradient(135deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4)',
    'randig': 'repeating-linear-gradient(90deg, #fff 0px, #fff 10px, #333 10px, #333 20px)',
    'striped': 'repeating-linear-gradient(90deg, #fff 0px, #fff 10px, #333 10px, #333 20px)',
    'prickig': 'radial-gradient(circle, #333 2px, transparent 2px)', 
    'dotted': 'radial-gradient(circle, #333 2px, transparent 2px)',
    'blommig': 'linear-gradient(45deg, #FFB6C1, #FFF0F5)', 
    'floral': 'linear-gradient(45deg, #FFB6C1, #FFF0F5)',
    'transparent': 'rgba(200,200,200,0.3)',
};

function getColorStyle(colorName) {
    if (!colorName) return '#ccc';
    
    const normalized = colorName.toLowerCase().trim();
    
    // Direkt eslesme
    if (COLOR_MAP[normalized]) {
        return COLOR_MAP[normalized];
    }
    
    // Benzerlik kontrolu (fuzzy match)
    for (const [key, value] of Object.entries(COLOR_MAP)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return value;
        }
    }
    
    // Hex kodu mu kontrol et
    if (/^#[0-9A-F]{6}$/i.test(normalized)) {
        return normalized;
    }
    
    // Varsayilan
    return '#ccc';
}

// ==========================================
// RENSA (TEMIZLE) BUTONU - v5.5
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {

    let allProducts = [];
    let filteredProducts = [];
    let currentPage = 0;
    const ITEMS_PER_PAGE = 12;

    const grid = document.getElementById('product-grid');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const currentCountEl = document.getElementById('current-count');
    const totalCountEl = document.getElementById('total-count');
    const progressBar = document.getElementById('progress-bar-fill');

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
            throw new Error('Supabase GET hatasi: ' + res.status);
        }
        return res.json();
    }

    function getDisplayPrice(product) {
        return product.discount_price || product.base_price || 0;
    }

    async function fetchCategories() {
        try {
            const categories = await supabaseGet('categories', {
                select: '*',
                active: 'eq.true',
                order: 'sort_order.asc'
            });
            return categories || [];
        } catch (error) {
            console.error('Kategori cekme hatasi:', error);
            return [];
        }
    }

    async function fetchSubCategories() {
        try {
            const subCategories = await supabaseGet('sub_categories', {
                select: '*',
                active: 'eq.true',
                order: 'sort_order.asc'
            });
            return subCategories || [];
        } catch (error) {
            console.error('Alt kategori cekme hatasi:', error);
            return [];
        }
    }

    function renderChips(categories, subCategories) {
        const chipsContainer = document.getElementById('category-chips-list');
        if (!chipsContainer) return;

        const currentCategory = getCurrentCategory();
        const urlParams = new URLSearchParams(window.location.search);
        const currentSubCategory = urlParams.get('kategori');

        let chipsHTML = '';

        const isAllaActive = !currentSubCategory;
        chipsHTML += `<a href="/${currentCategory}/" class="category-chip ${isAllaActive ? 'active' : ''}" data-chip="alla">Alla</a>`;

        const category = categories.find(c => c.slug === currentCategory);
        if (category) {
            const categorySubs = subCategories.filter(s => s.category_id === category.id);
            categorySubs.forEach(sub => {
                const isActive = currentSubCategory === sub.slug;
                chipsHTML += `<a href="/${currentCategory}/?kategori=${sub.slug}" class="category-chip ${isActive ? 'active' : ''}" data-chip="${sub.slug}">${sub.name}</a>`;
            });
        }

        chipsContainer.innerHTML = chipsHTML;
        initChipsRouting();
    }

    async function fetchProducts() {
        try {
            const currentCategory = getCurrentCategory();
            const subCategory = getCurrentSubCategory();

            const [categories, subCategories] = await Promise.all([
                fetchCategories(),
                fetchSubCategories()
            ]);

            renderChips(categories, subCategories);

            const queryParams = {
                select: '*',
                active: 'eq.true'
            };

            if (isReaPage()) {
                queryParams.discount_price = 'not.is.null';
                console.log('REA sayfasi: Indirimli urunler cekiliyor');
            } else if (currentCategory) {
                queryParams.categories = 'cs.{"' + currentCategory + '"}';
                console.log(currentCategory + ' kategorisi: Urunler cekiliyor');
            }

            if (subCategory) {
                queryParams.sub_category = 'eq.' + subCategory;
                console.log('Alt kategori filtresi:', subCategory);
            }

            const products = await supabaseGet('products', queryParams);

            const variants = await supabaseGet('product_variants', {
                select: '*'
            });

            const data = products.map(p => ({
                ...p,
                product_variants: variants.filter(v => v.product_id === p.id)
            }));

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

    function getVariantDisplayText(product) {
        const variants = product.variants || [];

        if (variants.length === 0) {
            return 'Standard';
        }

        if (variants.length === 1) {
            return variants[0].size || 'Standard';
        }

        const firstSize = variants[0].size || '';
        const extraCount = variants.length - 1;

        if (firstSize.includes('(+') || firstSize.includes('storlekar')) {
            return firstSize;
        }

        return firstSize + ' (+ ' + extraCount + ' storlekar)';
    }

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
            ? `<span class="original-price" style="text-decoration:line-through;color:#999;font-size:14px;">${product.base_price.toLocaleString('sv-SE')} SEK</span>
               <span class="current-price" style="color:#e54d42;">${product.price.toLocaleString('sv-SE')} SEK</span>`
            : `<span class="current-price">${product.price.toLocaleString('sv-SE')} SEK</span>`;

        const variantText = getVariantDisplayText(product);

        const productUrl = product.slug ? '/produkt/?slug=' + product.slug : '/produkt/?id=' + product.id;

        return `
            <div class="product-card" data-id="${String(product.id)}">
                <div class="image-box">
                    <a href="${productUrl}">
                        <img src="${product.image}" 
                             alt="${product.name}" 
                             loading="lazy"
                             onerror="this.style.display='none'"
                             style="width:100%; height:100%; object-fit:cover;">
                    </a>
                    ${hasDiscount ? '<span class="discount-badge" style="position:absolute;top:8px;left:8px;background:#e54d42;color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:bold;">REA</span>' : ''}
                    <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" 
                            data-product-id="${String(product.id)}"
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
                                          style="background: ${getColorStyle(color)};"
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

    function isInWishlist(productId) {
        try {
            const wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
            return wishlist.some(item => (typeof item === 'string' ? item : String(item.id)) === String(productId));
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

        const product = allProducts.find(p => String(p.id) === String(productId));
        if (!product) return;

        let wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
        const index = wishlist.findIndex(item => (typeof item === 'string' ? item : String(item.id)) === String(productId));

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

    // ==========================================
    // MODERN FILTRE GENERATOR - v5.6
    // Renk grid + Storlek grid
    // ==========================================
    function generateFilters() {
        // --- RENK FILTRESI (Modern Grid) ---
        const allColors = [...new Set(allProducts.flatMap(p => p.colors))].filter(Boolean).sort();
        const colorContainer = document.getElementById('color-filter-list');
        
        if (colorContainer && allColors.length > 0) {
            colorContainer.innerHTML = `
                <div class="color-filter-grid">
                    ${allColors.map(color => `
                        <div class="color-item">
                            <input type="checkbox" 
                                   class="filter-input" 
                                   id="color-${color.replace(/\s/g, '-')}" 
                                   value="${color}" 
                                   data-type="color">
                            <label class="color-circle-wrapper" for="color-${color.replace(/\s/g, '-')}">
                                <span class="color-circle" style="background: ${getColorStyle(color)};"></span>
                                <span class="color-name">${color}</span>
                            </label>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // --- STORLEK FILTRESI (Modern Grid Butonlar) ---
        const allSizes = [...new Set(allProducts.flatMap(p => p.sizes))].filter(Boolean).sort((a, b) => {
            const getArea = s => {
                const nums = s.match(/\d+/g);
                return nums ? nums.reduce((acc, n) => acc * parseInt(n), 1) : 0;
            };
            return getArea(a) - getArea(b);
        });
        
        const sizeContainer = document.getElementById('size-filter-list');
        if (sizeContainer && allSizes.length > 0) {
            sizeContainer.innerHTML = `
                <div class="size-filter-grid">
                    ${allSizes.map(size => `
                        <div class="size-item">
                            <input type="checkbox" 
                                   class="filter-input" 
                                   id="size-${size.replace(/\s/g, '-')}" 
                                   value="${size}" 
                                   data-type="size">
                            <label class="size-box" for="size-${size.replace(/\s/g, '-')}">
                                <span class="size-text">${size}</span>
                            </label>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        document.querySelectorAll('.filter-input').forEach(input => {
            input.addEventListener('change', () => {
                applyFilters();
                updateClearButtonVisibility();
            });
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

    // ==========================================
    // RENSA BUTONU
    // ==========================================
    function clearAllFilters() {
        console.log('>>> clearAllFilters CAGIRILDI');

        document.querySelectorAll('.filter-input:checked').forEach(input => {
            input.checked = false;
        });

        document.querySelectorAll('input[name="orderby"]').forEach(radio => {
            radio.checked = radio.value === 'default';
        });

        filteredProducts = [...allProducts];
        currentPage = 0;

        renderProducts();
        updateProgress();
        updateFilterBadge(0);

        const clearBtn = document.getElementById('clear-all-filters');
        if (clearBtn) {
            clearBtn.classList.remove('visible');
            clearBtn.style.display = 'none';
        }

        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);

        console.log('Tum filtreler temizlendi, urun sayisi:', filteredProducts.length);
    }

    function initClearFilters() {
        console.log('>>> initClearFilters CAGIRILDI');

        const mainClearBtn = document.getElementById('clear-all-filters');
        if (mainClearBtn) {
            mainClearBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('>>> RENSA butonuna tiklandi - TUMUNU SIFIRLA');
                clearAllFilters();
            });
        }
    }

    function updateClearButtonVisibility() {
        const checkedFilters = document.querySelectorAll('.filter-input:checked').length;
        let hasSort = false;
        document.querySelectorAll('input[name="orderby"]').forEach(radio => {
            if (radio.checked && radio.value !== 'default') {
                hasSort = true;
            }
        });

        const totalActive = checkedFilters + (hasSort ? 1 : 0);

        const clearBtn = document.getElementById('clear-all-filters');
        if (clearBtn) {
            if (totalActive > 0) {
                clearBtn.classList.add('visible');
                clearBtn.style.display = 'inline-flex';
            } else {
                clearBtn.classList.remove('visible');
                clearBtn.style.display = 'none';
            }
        }

        console.log('Aktif filtre/siralama sayisi:', totalActive);
    }

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
                        filteredProducts.sort((a, b) => String(a.id).localeCompare(String(b.id)));
                }

                currentPage = 0;
                renderProducts();
                closeAllDrawers();
                updateClearButtonVisibility();
            });
        });
    }

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
        const filterDrawer = document.getElementById('filter-sidebar');
        const filterOverlay = document.getElementById('filter-overlay');
        if (filterDrawer) filterDrawer.classList.remove('active');
        if (filterOverlay) filterOverlay.classList.remove('active');

        const sortDrawer = document.getElementById('sort-drawer');
        const sortOverlay = document.getElementById('sort-overlay');
        if (sortDrawer) sortDrawer.classList.remove('active');
        if (sortOverlay) sortOverlay.classList.remove('active');

        document.body.style.overflow = '';
    }

    window.closeAll = closeAllDrawers;

    await fetchProducts();
    initSort();
    initDrawers();
    initChipsRouting();
    initClearFilters();
    updateChipsActiveState();
    updateWishlistBadge();

    console.log('Category.js v5.6 baslatildi');
});
