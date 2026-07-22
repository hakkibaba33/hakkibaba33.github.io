// ==========================================
// INDEX.JS v2.0 - DKRUG Anasayfa
// Supabase'den ürün çekme, zengin kartlar, modern carousel
// ==========================================

if (window.__indexPageInitialized) {
    console.log("[Index] Zaten başlatılmış, atlanıyor.");
} else {
    window.__indexPageInitialized = true;

    // ===== COLOR MAP (category.js ile aynı) =====


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

    // ===== GET VARIANT DISPLAY TEXT (category.js ile aynı) =====

    // ===== GET DISPLAY PRICE =====

    // ===== WISHLIST FUNCTIONS =====



    // ===== CREATE PRODUCT CARD (category.js style) =====

    // ===== FETCH ALL PRODUCTS =====
    async function fetchAllProducts() {
        try {
            console.log('[Index] Ürünler çekiliyor...');

            // Önce varyantları çekelim
            const [products, variants] = await Promise.all([
                supabaseGet('products', {
                    select: '*',
                    active: 'eq.true',
                    order: 'created_at.desc'
                }),
                supabaseGet('product_variants', {
                    select: '*'
                })
            ]);

            if (!products || !Array.isArray(products)) {
                console.error('[Index] Beklenmeyen veri formati');
                return;
            }

            // Ürünleri zenginleştir
            allProducts = products.map(p => {
                const productVariants = variants.filter(v => v.product_id === p.id);

                // Varyant yoksa simple_size kullan
                let finalVariants = productVariants;
                if (productVariants.length === 0 && p.simple_size) {
                    finalVariants = [{
                        size: p.simple_size,
                        color: null,
                        price: p.base_price || 0,
                        discount_price: p.discount_price || null,
                        stock: 999
                    }];
                }

                return {
                    id: p.id,
                    name: p.name || 'Produkt',
                    price: getDisplayPrice(p),
                    base_price: p.base_price || 0,
                    discount_price: p.discount_price || null,
                    image: p.images && p.images[0] ? p.images[0] : '',
                    slug: p.slug || '',
                    description: p.description || '',
                    variants: finalVariants,
                    colors: p.colors || [],
                    sizes: finalVariants.map(v => v.size),
                    measurements: p.measurements || [],
                    m2_available_widths: p.m2_available_widths || [],
                    m2_calculator_active: p.m2_calculator_active || false,
                    gardin_measurements: p.gardin_measurements || [],
                    gardin_calculator_active: p.gardin_calculator_active || false,
                    stock: finalVariants.length > 0 
                        ? (finalVariants.some(v => v.stock > 0) ? 'In Stock' : 'Out of Stock')
                        : 'In Stock',
                    delivery_time: p.delivery_time || '3-7 arbetsdagar',
                    is_bestseller: p.is_bestseller || false,
                    featured: p.featured || false
                };
            });

            // Kategorize et
            saleProducts = allProducts.filter(p => p.discount_price && p.discount_price < p.base_price).slice(0, 10);
            newProducts = allProducts.slice(0, 10);
            bestSellers = allProducts.filter(p => p.is_bestseller || p.featured).slice(0, 8);

            if (bestSellers.length === 0) {
                bestSellers = allProducts.slice(0, 8);
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
        initLazyImages();
    }

    // ===== RENDER SALE CAROUSEL =====
    function renderSaleCarousel() {
        const track = document.getElementById('sale-carousel-track');
        if (!track) return;

        if (saleProducts.length === 0) {
            track.innerHTML = '<div class="no-results-found" style="padding:40px;text-align:center;color:#888;width:100%;">Inga REA-produkter tillgängliga.</div>';
            return;
        }

        track.innerHTML = saleProducts.map(p => `
            <div class="carousel-slide">${createProductCard(p, isInWishlist(p.id))}</div>
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
            <div class="carousel-slide">${createProductCard(p, isInWishlist(p.id))}</div>
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

        grid.innerHTML = bestSellers.map(p => createProductCard(p, isInWishlist(p.id))).join('');

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

        let currentIndex = 0;
        let slideWidth = 0;
        let maxIndex = 0;

        function calculateDimensions() {
            if (slides.length === 0) return;
            slideWidth = slides[0].offsetWidth + 20; // gap included
            const visibleSlides = Math.floor(track.parentElement.offsetWidth / slideWidth);
            maxIndex = Math.max(0, slides.length - visibleSlides);
        }

        calculateDimensions();
        window.addEventListener('resize', calculateDimensions);

        // Dot navigation
        if (dotsContainer && slides.length > 1) {
            const dotCount = Math.min(slides.length, 6);
            dotsContainer.innerHTML = Array.from({length: dotCount}, (_, i) => 
                `<button class="carousel-dot ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Gå till slide ${i + 1}"></button>`
            ).join('');

            dotsContainer.querySelectorAll('.carousel-dot').forEach(dot => {
                dot.addEventListener('click', () => {
                    const index = parseInt(dot.dataset.index);
                    scrollToSlide(track, index, slideWidth);
                    updateDots(dotsContainer, index);
                    currentIndex = index;
                    updateButtons();
                });
            });
        }

        // Prev/Next buttons
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                currentIndex = Math.max(0, currentIndex - 1);
                scrollToSlide(track, currentIndex, slideWidth);
                updateDots(dotsContainer, currentIndex);
                updateButtons();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                currentIndex = Math.min(maxIndex, currentIndex + 1);
                scrollToSlide(track, currentIndex, slideWidth);
                updateDots(dotsContainer, currentIndex);
                updateButtons();
            });
        }

        // Touch/Swipe support
        let touchStartX = 0;
        let touchEndX = 0;

        track.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        track.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });

        function handleSwipe() {
            const swipeThreshold = 50;
            if (touchStartX - touchEndX > swipeThreshold) {
                // Swipe left - next
                currentIndex = Math.min(maxIndex, currentIndex + 1);
            } else if (touchEndX - touchStartX > swipeThreshold) {
                // Swipe right - prev
                currentIndex = Math.max(0, currentIndex - 1);
            }
            scrollToSlide(track, currentIndex, slideWidth);
            updateDots(dotsContainer, currentIndex);
            updateButtons();
        }

        // Auto-play (6 seconds)
        let autoPlayInterval;
        function startAutoPlay() {
            autoPlayInterval = setInterval(() => {
                if (currentIndex >= maxIndex) {
                    currentIndex = 0;
                } else {
                    currentIndex++;
                }
                scrollToSlide(track, currentIndex, slideWidth);
                updateDots(dotsContainer, currentIndex);
                updateButtons();
            }, 6000);
        }

        function stopAutoPlay() {
            clearInterval(autoPlayInterval);
        }

        track.parentElement.addEventListener('mouseenter', stopAutoPlay);
        track.parentElement.addEventListener('mouseleave', startAutoPlay);
        track.parentElement.addEventListener('touchstart', stopAutoPlay, { passive: true });
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

    // ===== INDIRIM SAATI AYARLARI =====
    function initCountdown() {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 3); // 3 gün sonra
        endDate.setHours(14, 42, 18);

        function updateCountdown() {
            const now = new Date().getTime();
            const distance = endDate - now;

            if (distance < 0) {
                endDate.setDate(endDate.getDate() + 7); // Reset
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            const pad = (n) => String(n).padStart(2, '0');

            const daysEl = document.getElementById('cd-days');
            const hoursEl = document.getElementById('cd-hours');
            const minutesEl = document.getElementById('cd-minutes');
            const secondsEl = document.getElementById('cd-seconds');

            if (daysEl) daysEl.textContent = pad(days);
            if (hoursEl) hoursEl.textContent = pad(hours);
            if (minutesEl) minutesEl.textContent = pad(minutes);
            if (secondsEl) secondsEl.textContent = pad(seconds);
        }

        updateCountdown();
        setInterval(updateCountdown, 1000);
    }

    // ===== NEWSLETTER HANDLER =====
    window.handleNewsletterSubmit = function(form) {
        const email = form.querySelector('input[type="email"]').value;
        const btn = form.querySelector('button');
        const originalText = btn.textContent;

        btn.textContent = 'Skickar...';
        btn.disabled = true;

        // Simulate API call
        setTimeout(() => {
            btn.textContent = '✓ Tack!';
            btn.style.background = '#2e8b57';
            form.querySelector('input').value = '';

            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
                btn.style.background = '';
            }, 3000);
        }, 1500);

        return false;
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
                            <div class="image-box skeleton" style="aspect-ratio:3/4;"></div>
                            <div style="padding:16px;">
                                <div class="skeleton" style="height:16px;width:80%;margin-bottom:10px;"></div>
                                <div class="skeleton" style="height:12px;width:40%;margin-bottom:10px;"></div>
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

    // ===== HERO SCROLL =====
    function initHeroScroll() {
        const scrollBtn = document.querySelector('.hero-scroll');
        if (scrollBtn) {
            scrollBtn.addEventListener('click', () => {
                const nextSection = document.querySelector('.trust-bar-section');
                if (nextSection) {
                    nextSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }
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

        // Countdown başlat
        initCountdown();

        // Hero scroll
        initHeroScroll();

        // Wishlist badge güncelle
        updateWishlistBadge();

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