// ==========================================
// INDEX.JS - DKRUG Anasayfa
// Supabase'den ürün çekme, carousel, wishlist
// ==========================================

if (window.__indexPageInitialized) {
    console.log("[Index] Zaten başlatılmış, atlanıyor.");
} else {
    window.__indexPageInitialized = true;

    // ===== CONFIG =====
    const SUPABASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE) ? CONFIG.SUPABASE.URL : '';
    const SUPABASE_KEY = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE) ? CONFIG.SUPABASE.ANON_KEY : '';

    // ===== STATE =====
    let allProducts = [];
    let saleProducts = [];
    let newProducts = [];
    let bestSellers = [];

    // ===== SUPABASE FETCH =====
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
            console.error('[Index] Supabase hata:', errText);
            throw new Error('Supabase GET hatasi: ' + res.status);
        }
        return res.json();
    }

    // ===== FETCH ALL PRODUCTS =====
    async function fetchAllProducts() {
        try {
            console.log('[Index] Ürünler çekiliyor...');
            const products = await supabaseGet('products', {
                select: '*',
                active: 'eq.true',
                order: 'created_at.desc'
            });

            if (!products || !Array.isArray(products)) {
                console.error('[Index] Beklenmeyen veri formati');
                return;
            }

            allProducts = products;

            // Kategorize et
            saleProducts = products.filter(p => p.discount_price && p.discount_price < p.base_price).slice(0, 10);
            newProducts = products.slice(0, 10); // created_at desc olduğu için ilk 10 en yeni
            bestSellers = products.filter(p => p.is_bestseller || p.featured).slice(0, 8);

            // Eğer bestseller yoksa rastgele 8 ürün al
            if (bestSellers.length === 0) {
                bestSellers = products.slice(0, 8);
            }

            console.log('[Index] Ürünler yüklendi:', {
                total: allProducts.length,
                sale: saleProducts.length,
                new: newProducts.length,
                bestseller: bestSellers.length
            });

            renderAllSections();
        } catch (e) {
            console.error('[Index] Ürün çekme hatasi:', e);
            showFallbackContent();
        }
    }

    // ===== RENDER ALL SECTIONS =====
    function renderAllSections() {
        renderSaleCarousel();
        renderNewArrivalsCarousel();
        renderBestSellersGrid();
    }

    // ===== PRODUCT CARD HTML =====
    function getProductCardHTML(product, badgeType) {
        const image = product.images && product.images[0] ? product.images[0] : '';
        const name = product.name || 'Produkt';
        const slug = product.slug || product.id;
        const hasDiscount = product.discount_price && product.discount_price < product.base_price;
        const currentPrice = hasDiscount ? product.discount_price : product.base_price;
        const oldPrice = product.base_price || 0;
        const category = product.category || 'Mattor';

        let badgeHTML = '';
        if (badgeType === 'sale') {
            badgeHTML = '<span class="product-badge sale">REA</span>';
        } else if (badgeType === 'new') {
            badgeHTML = '<span class="product-badge new">Ny</span>';
        } else if (badgeType === 'bestseller') {
            badgeHTML = '<span class="product-badge">Bästsäljare</span>';
        }

        const priceHTML = hasDiscount 
            ? `<span class="price-discount">${formatPrice(currentPrice)}</span><span class="price-old">${formatPrice(oldPrice)}</span>`
            : `<span class="price-current">${formatPrice(currentPrice)}</span>`;

        const isWishlisted = isInWishlist(product.id);
        const heartIcon = isWishlisted 
            ? '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

        return `
            <div class="product-card fade-in" data-product-id="${product.id}">
                <div class="product-img-wrap">
                    ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg, #e8e0d8 0%, #d4ccc4 100%)'">` : ''}
                    ${badgeHTML}
                    <div class="product-actions">
                        <button class="product-action-btn ${isWishlisted ? 'active' : ''}" title="Favorit" onclick="toggleWishlistItem('${product.id}', '${escapeHtml(name)}', ${currentPrice}, '${escapeHtml(image)}')">
                            ${heartIcon}
                        </button>
                        <a href="/produkt/${escapeHtml(slug)}" class="product-action-btn" title="Snabbvy">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </a>
                    </div>
                </div>
                <div class="product-info">
                    <div class="product-cat">${escapeHtml(category)}</div>
                    <h4 class="product-name"><a href="/produkt/${escapeHtml(slug)}">${escapeHtml(name)}</a></h4>
                    <div class="product-price">
                        ${priceHTML}
                    </div>
                </div>
            </div>
        `;
    }

    // ===== RENDER SALE CAROUSEL =====
    function renderSaleCarousel() {
        const track = document.getElementById('sale-carousel-track');
        const dots = document.getElementById('sale-carousel-dots');
        if (!track) return;

        if (saleProducts.length === 0) {
            track.innerHTML = '<div class="no-results-found" style="padding:40px;text-align:center;color:#888;width:100%;">Inga REA-produkter tillgängliga.</div>';
            return;
        }

        track.innerHTML = saleProducts.map(p => `
            <div class="carousel-slide">${getProductCardHTML(p, 'sale')}</div>
        `).join('');

        setupCarousel('sale');
    }

    // ===== RENDER NEW ARRIVALS CAROUSEL =====
    function renderNewArrivalsCarousel() {
        const track = document.getElementById('new-carousel-track');
        if (!track) return;

        if (newProducts.length === 0) {
            track.innerHTML = '<div class="no-results-found" style="padding:40px;text-align:center;color:#888;width:100%;">Inga nya produkter tillgängliga.</div>';
            return;
        }

        track.innerHTML = newProducts.map(p => `
            <div class="carousel-slide">${getProductCardHTML(p, 'new')}</div>
        `).join('');

        setupCarousel('new');
    }

    // ===== RENDER BEST SELLERS GRID =====
    function renderBestSellersGrid() {
        const grid = document.getElementById('featured-products');
        if (!grid) return;

        if (bestSellers.length === 0) {
            grid.innerHTML = '<div class="no-results-found" style="padding:40px;text-align:center;color:#888;grid-column:1/-1;">Inga produkter tillgängliga.</div>';
            return;
        }

        grid.innerHTML = bestSellers.map(p => getProductCardHTML(p, 'bestseller')).join('');

        // Re-observe fade-in elements
        document.querySelectorAll('.fade-in').forEach(el => {
            if (!el.classList.contains('visible')) {
                observer.observe(el);
            }
        });
    }

    // ===== CAROUSEL LOGIC =====
    function setupCarousel(type) {
        const track = document.getElementById(`${type}-carousel-track`);
        const prevBtn = document.getElementById(`${type}-carousel-prev`);
        const nextBtn = document.getElementById(`${type}-carousel-next`);
        const dotsContainer = document.getElementById(`${type}-carousel-dots`);

        if (!track) return;

        const slides = track.querySelectorAll('.carousel-slide');
        if (slides.length === 0) return;

        const slideWidth = slides[0].offsetWidth + 20; // gap included
        let currentIndex = 0;
        const maxIndex = Math.max(0, slides.length - Math.floor(track.parentElement.offsetWidth / slideWidth));

        // Dot navigation
        if (dotsContainer && slides.length > 1) {
            const dotCount = Math.min(slides.length, 6);
            dotsContainer.innerHTML = Array.from({length: dotCount}, (_, i) => 
                `<button class="carousel-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></button>`
            ).join('');

            dotsContainer.querySelectorAll('.carousel-dot').forEach(dot => {
                dot.addEventListener('click', () => {
                    const index = parseInt(dot.dataset.index);
                    scrollToSlide(track, index, slideWidth);
                    updateDots(dotsContainer, index);
                    currentIndex = index;
                });
            });
        }

        // Prev/Next buttons
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                currentIndex = Math.max(0, currentIndex - 1);
                scrollToSlide(track, currentIndex, slideWidth);
                updateDots(dotsContainer, currentIndex);
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                currentIndex = Math.min(maxIndex, currentIndex + 1);
                scrollToSlide(track, currentIndex, slideWidth);
                updateDots(dotsContainer, currentIndex);
            });
        }

        // Auto-play (optional - 6 seconds)
        let autoPlayInterval;
        function startAutoPlay() {
            autoPlayInterval = setInterval(() => {
                currentIndex = (currentIndex + 1) % (maxIndex + 1);
                scrollToSlide(track, currentIndex, slideWidth);
                updateDots(dotsContainer, currentIndex);
            }, 6000);
        }

        function stopAutoPlay() {
            clearInterval(autoPlayInterval);
        }

        track.parentElement.addEventListener('mouseenter', stopAutoPlay);
        track.parentElement.addEventListener('mouseleave', startAutoPlay);
        startAutoPlay();

        // Update button states
        function updateButtons() {
            if (prevBtn) prevBtn.disabled = currentIndex === 0;
            if (nextBtn) nextBtn.disabled = currentIndex >= maxIndex;
        }

        track.addEventListener('scroll', () => {
            currentIndex = Math.round(track.scrollLeft / slideWidth);
            updateDots(dotsContainer, currentIndex);
            updateButtons();
        });

        updateButtons();
    }

    function scrollToSlide(track, index, slideWidth) {
        track.scrollTo({ left: index * slideWidth, behavior: 'smooth' });
    }

    function updateDots(container, activeIndex) {
        if (!container) return;
        container.querySelectorAll('.carousel-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === activeIndex);
        });
    }

    // ===== WISHLIST FUNCTIONS =====
    function isInWishlist(productId) {
        try {
            const wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
            return wishlist.some(item => String(item.id || item) === String(productId));
        } catch (e) {
            return false;
        }
    }

    window.toggleWishlistItem = function(productId, name, price, image) {
        let wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
        const index = wishlist.findIndex(item => String(item.id || item) === String(productId));

        if (index > -1) {
            wishlist.splice(index, 1);
            console.log('[Wishlist] Kaldırıldı:', name);
        } else {
            wishlist.push({ id: productId, name: name, price: price, image: image });
            console.log('[Wishlist] Eklendi:', name);
        }

        localStorage.setItem('wishlistItems', JSON.stringify(wishlist));

        // Update UI
        const card = document.querySelector(`[data-product-id="${productId}"]`);
        if (card) {
            const btn = card.querySelector('.product-action-btn');
            if (btn) {
                btn.classList.toggle('active', index === -1); // index -1 ise yeni eklendi
                btn.innerHTML = index === -1 
                    ? '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
                    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
            }
        }

        // Update header badge
        if (typeof updateWishlistBadge === 'function') {
            updateWishlistBadge();
        }
    };

    // ===== UTILITIES =====
    function formatPrice(price) {
        if (!price) return '0 kr';
        return Number(price).toLocaleString('sv-SE') + ' kr';
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===== SKELETON LOADING =====
    function showSkeletons() {
        const sections = ['sale-carousel-track', 'new-carousel-track', 'featured-products'];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = Array.from({length: 4}, () => `
                    <div class="carousel-slide">
                        <div class="product-card">
                            <div class="product-img-wrap skeleton" style="aspect-ratio:3/4;"></div>
                            <div class="product-info">
                                <div class="skeleton" style="height:12px;width:40%;margin-bottom:8px;"></div>
                                <div class="skeleton" style="height:16px;width:80%;margin-bottom:10px;"></div>
                                <div class="skeleton" style="height:14px;width:30%;"></div>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        });
    }

    function showFallbackContent() {
        const sections = ['sale-carousel-track', 'new-carousel-track', 'featured-products'];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = '<div style="padding:40px;text-align:center;color:#888;width:100%;">Kunde inte ladda produkter. Försök igen senare.</div>';
            }
        });
    }

    // ===== FADE-IN OBSERVER =====
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    // ===== INIT =====
    function initIndexPage() {
        console.log('[Index] Sayfa başlatılıyor...');

        // Skeleton göster
        showSkeletons();

        // Ürünleri çek
        fetchAllProducts();

        // Fade-in elemanlarını gözlemle
        document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

        console.log('[Index] Init tamamlandı.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initIndexPage);
    } else {
        initIndexPage();
    }
}
