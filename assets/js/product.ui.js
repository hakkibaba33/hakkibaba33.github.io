// ==========================================
// PRODUCT.UI.JS - SUPABASE UYUMLU (v3.1 - ID FIX)
// Eski Airtable yapısını koru, sadece API Supabase'e çevrildi
// ==========================================

if (window.__productPageInitialized) {
    console.log("product.ui.js zaten calistirilmis, atlaniyor.");
} else {
    window.__productPageInitialized = true;

    let currentProduct = null;
    let currentImages = [];
    let currentVariants = [];
    let selectedVariant = null;
    let selectedImageIndex = 0;
    let isZoomed = false;
    let isMobile = window.innerWidth <= 768;

    // Mobilde swipe için
    let touchStartX = 0;
    let touchCurrentX = 0;
    let isDragging = false;

    // SUPABASE CLIENT
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

    function getDisplayPrice(product, variant) {
        if (variant && variant.discount_price) return variant.discount_price;
        if (variant && variant.price) return variant.price;
        if (product.discount_price) return product.discount_price;
        return product.base_price || 0;
    }

    function getOriginalPrice(product, variant) {
        if (variant && variant.price) return variant.price;
        return product.base_price || 0;
    }

    // DUZELTME: Eski yapıdaki gibi basit slug kontrolü
    // ESKI KOD: "product.html" kontrolu YOK
    async function initProductPage() {
        console.log("Urun sayfasi init basliyor...");

        let slug = new URLSearchParams(window.location.search).get('slug');
        if (!slug) {
            const parts = window.location.pathname.split('/').filter(p => p);
            slug = parts[parts.length - 1];
        }

        // DUZELTME: Eski kodda bu kontrol YOKTU
        // Ama eger slug hala yoksa veya bos ise, hata ver
        if (!slug) {
            console.error("Slug bulunamadi!");
            return;
        }

        console.log("Slug:", slug);

        try {
            // Duz cekme (embed olmadan)
            const products = await supabaseGet('products', {
                slug: 'eq.' + slug,
                select: '*'
            });

            if (products.length === 0) {
                console.error("Urun bulunamadi! Slug:", slug);
                return;
            }

            const variants = await supabaseGet('product_variants', {
                product_id: 'eq.' + products[0].id,
                select: '*'
            });

            const data = [{
                ...products[0],
                product_variants: variants
            }];

            if (!data || data.length === 0) {
                console.error("Urun bulunamadi!");
                return;
            }

            currentProduct = data[0];
            const p = currentProduct;
            const f = {
                Name: p.name,
                Price: p.base_price,
                Description: p.description,
                Delivery_time: p.delivery_time || '3-7 arbetsdagar',
                Variants: p.product_variants || []
            };

            // Temel bilgiler - element kontrolu ile
            setText('page-title-product-name', f.Name);
            setText('breadcrumb-product-name', f.Name);
            setText('product-main-name-desktop', f.Name);

            // Fiyat gosterimi
            const hasDiscount = p.discount_price && p.discount_price < p.base_price;
            const priceEl = document.getElementById('product-price');
            if (priceEl) {
                if (hasDiscount) {
                    priceEl.innerHTML = '<span style="text-decoration:line-through;color:#999;font-size:18px;margin-right:8px;">' + p.base_price + ' SEK</span>' +
                                         '<span style="color:#e54d42;font-size:24px;font-weight:bold;">' + p.discount_price + ' SEK</span>';
                } else {
                    priceEl.textContent = (f.Price || 0) + " SEK";
                }
            }

            setHTML('product-description', f.Description || '');
            setText('delivery-time-display', f.Delivery_time);

            // Gorseller
            currentImages = p.images || [];
            console.log(currentImages.length + ' gorsel');

            if (currentImages.length > 0) {
                if (isMobile) renderMobileGallery();
                else renderDesktopGallery();
            }

            // Varyasyonlar
            currentVariants = f.Variants;
            if (currentVariants.length > 0) {
                setupVariantAccordion();
                renderVariantDrawer();
            } else {
                const el = document.getElementById('variant-accordion-wrapper');
                if (el) el.style.display = 'none';
            }

            // Lightbox (sadece masaustu)
            if (!isMobile) setupLightbox();

            // Akordiyonlar
            setupAccordions();

            // Sepete ekle
            setupAddToCart(f);
            setupWishlistButton(f);

            console.log("Urun sayfasi yuklendi:", f.Name);

        } catch (e) { 
            console.error("Hata:", e); 
        }
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.innerText = text || '---';
    }

    function setHTML(id, html) {
        const el = document.getElementById(id);
        if (el) { el.innerHTML = ''; el.innerHTML = html || ''; }
    }

    // ==========================================
    // WISHLIST / FAVORI - ID FIX
    // ==========================================

    function setupWishlistButton(fields) {
        const btn = document.querySelector('.ana-urun-favori-buton');
        if (!btn) return;

        const productId = currentProduct.id;

        // Baslangic durumunu kontrol et
        updateWishlistButtonState(btn, productId);

        // Click event
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            let wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
            const index = wishlist.findIndex(item => (typeof item === 'string' ? item : String(item.id)) === String(productId));

            if (index > -1) {
                // Kaldir
                wishlist.splice(index, 1);
                console.log('Favorilerden kaldirildi:', fields.Name);
            } else {
                // Ekle
                wishlist.push({
                    id: currentProduct.id,
                    name: fields.Name,
                    price: getDisplayPrice(currentProduct, selectedVariant),
                    image: currentImages.length > 0 ? currentImages[0] : ''
                });
                console.log('Favorilere eklendi:', fields.Name);
            }

            localStorage.setItem('wishlistItems', JSON.stringify(wishlist));

            // Buton gorunumunu guncelle
            updateWishlistButtonState(btn, productId);

            // Header badge'i guncelle
            if (typeof updateWishlistBadge === 'function') {
                updateWishlistBadge();
            }
        });
    }

    function updateWishlistButtonState(btn, productId) {
        const wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
        const isWishlisted = wishlist.some(item => (typeof item === 'string' ? item : String(item.id)) === String(productId));

        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = isWishlisted ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
        }

        if (isWishlisted) {
            btn.classList.add('active');
            btn.style.color = '#D30000';
        } else {
            btn.classList.remove('active');
            btn.style.color = '';
        }
    }

    // ==========================================
    // MASAUSTU GALERI (2 Resim + Thumbnail'lar)
    // ==========================================

    function renderDesktopGallery() {
        const container = document.getElementById('desktop-gallery');
        const thumbContainer = document.getElementById('gallery-thumbnail-list');
        const mobileGallery = document.getElementById('mobile-gallery');

        if (container) container.style.display = 'flex';
        if (thumbContainer) thumbContainer.style.display = 'flex';
        if (mobileGallery) mobileGallery.style.display = 'none';

        if (!container) return;

        // 2 buyuk resim yan yana
        let mainHTML = '';
        const count = Math.min(2, currentImages.length);

        for (let i = 0; i < count; i++) {
            mainHTML += `
                <div class="main-image-column" data-index="${i}">
                    <img src="${currentImages[i]}" 
                         alt="${currentProduct.name} - ${i+1}" 
                         class="main-image"
                         onclick="openLightbox(${i})">
                </div>
            `;
        }
        container.innerHTML = mainHTML;

        // Thumbnail'lar
        if (thumbContainer) {
            let thumbHTML = '';
            currentImages.forEach((img, i) => {
                thumbHTML += `
                    <img src="${img}" alt="thumb-${i+1}" 
                         class="thumbnail-item ${i === 0 ? 'selected' : ''}"
                         data-index="${i}"
                         onclick="selectMainImage(${i})">
                `;
            });
            thumbContainer.innerHTML = thumbHTML;
        }
    }

    window.selectMainImage = function(index) {
        selectedImageIndex = index;
        document.querySelectorAll('.thumbnail-item').forEach((thumb, i) => {
            thumb.classList.toggle('selected', i === index);
        });
        if (currentImages.length > 2) {
            const cols = document.querySelectorAll('.main-image-column');
            cols.forEach((col, i) => {
                const imgIdx = (index + i) % currentImages.length;
                const img = col.querySelector('img');
                if (img) {
                    img.src = currentImages[imgIdx];
                    col.setAttribute('data-index', imgIdx);
                }
            });
        }
    };

    // ==========================================
    // MOBIL GALERI (Swipe + Sayac + Ilerleme Cubugu)
    // ==========================================

    function renderMobileGallery() {
        const container = document.getElementById('desktop-gallery');
        const thumbContainer = document.getElementById('gallery-thumbnail-list');
        const mobileGallery = document.getElementById('mobile-gallery');
        const track = document.getElementById('mobile-gallery-track');

        if (container) container.style.display = 'none';
        if (thumbContainer) thumbContainer.style.display = 'none';
        if (mobileGallery) mobileGallery.style.display = 'block';

        if (!track) return;

        let html = '';
        currentImages.forEach((img, i) => {
            html += `
                <div class="mobile-gallery-slide" data-index="${i}">
                    <img src="${img}" alt="${currentProduct.name} - ${i+1}">
                </div>
            `;
        });
        track.innerHTML = html;

        updateMobileCounter();
        setupMobileSwipe();
    }

    function updateMobileCounter() {
        const counter = document.getElementById('mobile-gallery-counter');
        const thumb = document.getElementById('mobile-scrollbar-thumb');
        const total = currentImages.length;

        if (counter) counter.innerText = `${selectedImageIndex + 1} / ${total}`;

        if (thumb && total > 1) {
            const widthPercent = (1 / total) * 100;
            const leftPercent = (selectedImageIndex / total) * 100;
            thumb.style.width = widthPercent + '%';
            thumb.style.left = leftPercent + '%';
        }
    }

    function setupMobileSwipe() {
        const track = document.getElementById('mobile-gallery-track');
        if (!track) return;

        track.addEventListener('touchstart', handleTouchStart, { passive: true });
        track.addEventListener('touchmove', handleTouchMove, { passive: true });
        track.addEventListener('touchend', handleTouchEnd);
    }

    function handleTouchStart(e) {
        touchStartX = e.touches[0].clientX;
        isDragging = true;
    }

    function handleTouchMove(e) {
        if (!isDragging) return;
        touchCurrentX = e.touches[0].clientX;
        const diff = touchCurrentX - touchStartX;
        const track = document.getElementById('mobile-gallery-track');
        if (track) {
            const offset = -selectedImageIndex * 100 + (diff / window.innerWidth) * 100;
            track.style.transform = `translateX(${offset}%)`;
        }
    }

    function handleTouchEnd(e) {
        if (!isDragging) return;
        isDragging = false;
        const diff = touchCurrentX - touchStartX;
        const threshold = 50;

        const track = document.getElementById('mobile-gallery-track');

        if (diff < -threshold && selectedImageIndex < currentImages.length - 1) {
            selectedImageIndex++;
        } else if (diff > threshold && selectedImageIndex > 0) {
            selectedImageIndex--;
        }

        if (track) {
            track.style.transition = 'transform 0.3s ease-out';
            track.style.transform = `translateX(-${selectedImageIndex * 100}%)`;
            setTimeout(() => { track.style.transition = ''; }, 300);
        }
        updateMobileCounter();
    }

    // ==========================================
    // LIGHTBOX (Sadece Masaustu)
    // ==========================================

    function setupLightbox() {
        const closeBtn = document.getElementById('lightbox-close');
        const prevBtn = document.getElementById('lightbox-prev');
        const nextBtn = document.getElementById('lightbox-next');
        const imgContainer = document.getElementById('lightbox-img-container');
        const imgWrapper = document.getElementById('lightbox-img-wrapper');

        if (closeBtn) closeBtn.onclick = closeLightbox;
        if (prevBtn) prevBtn.onclick = () => navigateLightbox(-1);
        if (nextBtn) nextBtn.onclick = () => navigateLightbox(1);

        // Zoom
        if (imgContainer) {
            imgContainer.addEventListener('dblclick', toggleZoom);
        }

        // Klavye navigasyonu
        document.addEventListener('keydown', (e) => {
            const overlay = document.getElementById('custom-lightbox');
            if (!overlay?.classList.contains('active')) return;
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') navigateLightbox(-1);
            if (e.key === 'ArrowRight') navigateLightbox(1);
        });

        renderLightboxThumbnails();
    }

    window.openLightbox = function(index) {
        if (isMobile) return; // Mobilde lightbox acilmasin
        selectedImageIndex = index;
        updateLightboxImage();
        const overlay = document.getElementById('custom-lightbox');
        if (overlay) {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };

    function closeLightbox() {
        const overlay = document.getElementById('custom-lightbox');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
        isZoomed = false;
        const wrapper = document.getElementById('lightbox-img-wrapper');
        if (wrapper) wrapper.classList.remove('zoomed');
    }

    function navigateLightbox(direction) {
        const newIndex = selectedImageIndex + direction;
        if (newIndex >= 0 && newIndex < currentImages.length) {
            selectedImageIndex = newIndex;
            updateLightboxImage();
        }
    }

    function updateLightboxImage() {
        const img = document.getElementById('lightbox-main-img');
        const counter = document.getElementById('lightbox-counter');
        const prevBtn = document.getElementById('lightbox-prev');
        const nextBtn = document.getElementById('lightbox-next');

        if (img) img.src = currentImages[selectedImageIndex];
        if (counter) counter.innerText = `${selectedImageIndex + 1} / ${currentImages.length}`;
        if (prevBtn) prevBtn.disabled = selectedImageIndex === 0;
        if (nextBtn) nextBtn.disabled = selectedImageIndex === currentImages.length - 1;

        // Zoom'u resetle
        isZoomed = false;
        const wrapper = document.getElementById('lightbox-img-wrapper');
        if (wrapper) wrapper.classList.remove('zoomed');

        // Thumbnail'lari guncelle
        document.querySelectorAll('.lightbox-thumb-item-container').forEach((thumb, i) => {
            thumb.classList.toggle('selected', i === selectedImageIndex);
        });
    }

    function toggleZoom() {
        if (isMobile) return;
        isZoomed = !isZoomed;
        const wrapper = document.getElementById('lightbox-img-wrapper');
        if (wrapper) wrapper.classList.toggle('zoomed', isZoomed);
    }

    function renderLightboxThumbnails() {
        const list = document.getElementById('lightbox-thumb-list');
        if (!list) return;

        let html = '';
        currentImages.forEach((img, i) => {
            html += `
                <div class="lightbox-thumb-item-container ${i === 0 ? 'selected' : ''}" 
                     onclick="lightboxSelectThumb(${i})">
                    <img src="${img}" alt="thumb-${i+1}" class="lightbox-thumbnail-item">
                </div>
            `;
        });
        list.innerHTML = html;
    }

    window.lightboxSelectThumb = function(index) {
        selectedImageIndex = index;
        updateLightboxImage();
    };

    // ==========================================
    // VARYASYON (Ayni kaliyor)
    // ==========================================

    function setupVariantAccordion() {
        const btn = document.getElementById('variant-accordion-btn');
        if (!btn) return;
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openVariantDrawer();
        });
    }

    function openVariantDrawer() {
        const overlay = document.getElementById('variant-drawer-overlay');
        const drawer = document.getElementById('variant-drawer');
        if (overlay && drawer) {
            overlay.classList.add('open');
            drawer.classList.add('open');
            document.body.classList.add('drawer-open');
        }
    }

    window.closeVariantDrawer = function() {
        const overlay = document.getElementById('variant-drawer-overlay');
        const drawer = document.getElementById('variant-drawer');
        if (overlay && drawer) {
            overlay.classList.remove('open');
            drawer.classList.remove('open');
            document.body.classList.remove('drawer-open');
        }
    };

    function renderVariantDrawer() {
        const body = document.getElementById('variant-drawer-body');
        if (!body) return;

        const mainImage = currentImages.length > 0 ? currentImages[0] : '';
        const productName = currentProduct.name;

        let html = '';
        currentVariants.forEach((variant, index) => {
            const isSelected = selectedVariant && selectedVariant.id === variant.id;
            const displayPrice = getDisplayPrice(currentProduct, variant);
            const originalPrice = getOriginalPrice(currentProduct, variant);
            const hasDiscount = variant.discount_price && variant.discount_price < variant.price;

            html += `
                <div class="variant-drawer-item ${isSelected ? 'selected' : ''}" 
                     data-index="${index}" onclick="selectVariant(${index})">
                    <div class="variant-drawer-image">
                        <img src="${mainImage}" alt="${productName} ${variant.size}">
                    </div>
                    <div class="variant-drawer-info">
                        <span class="variant-size">${variant.size}</span>
                        <span class="variant-price">
                            ${hasDiscount ? '<span style="text-decoration:line-through;color:#999;font-size:12px;">' + originalPrice + ' SEK</span> ' : ''}
                            <span style="${hasDiscount ? 'color:#e54d42;' : ''}">${displayPrice} SEK</span>
                        </span>
                        <span class="variant-stock" style="font-size:12px;color:${variant.stock > 0 ? '#22c55e' : '#e54d42'};">
                            ${variant.stock > 0 ? 'I lager (' + variant.stock + ' st)' : 'Slut i lager'}
                        </span>
                    </div>
                    <div class="variant-check">
                        ${isSelected ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-regular fa-circle"></i>'}
                    </div>
                </div>
            `;
        });
        body.innerHTML = html;

        const closeBtn = document.getElementById('close-variant-drawer');
        if (closeBtn) closeBtn.onclick = closeVariantDrawer;

        const overlay = document.getElementById('variant-drawer-overlay');
        if (overlay) overlay.onclick = (e) => { if (e.target === overlay) closeVariantDrawer(); };
    }

    window.selectVariant = function(index) {
        selectedVariant = currentVariants[index];
        document.querySelectorAll('.variant-drawer-item').forEach((item, i) => {
            item.classList.toggle('selected', i === index);
            const icon = item.querySelector('.variant-check i');
            if (icon) icon.className = i === index ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle';
        });

        const display = document.getElementById('selected-variant-display');
        const status = document.getElementById('variant-status');
        const priceDisplay = document.getElementById('product-price');

        if (display) display.innerText = selectedVariant.size;
        if (status) status.style.display = 'inline-flex';

        // Fiyati guncelle
        if (priceDisplay) {
            const displayPrice = getDisplayPrice(currentProduct, selectedVariant);
            const originalPrice = getOriginalPrice(currentProduct, selectedVariant);
            const hasDiscount = selectedVariant.discount_price && selectedVariant.discount_price < selectedVariant.price;

            if (hasDiscount) {
                priceDisplay.innerHTML = '<span style="text-decoration:line-through;color:#999;font-size:18px;margin-right:8px;">' + originalPrice + ' SEK</span>' +
                                          '<span style="color:#e54d42;font-size:24px;font-weight:bold;">' + displayPrice + ' SEK</span>';
            } else {
                priceDisplay.textContent = displayPrice + " SEK";
            }
        }

        setTimeout(closeVariantDrawer, 300);
    };

    // ==========================================
    // AKORDIYONLAR (3 Adet)
    // ==========================================

    function setupAccordions() {
        const items = document.querySelectorAll('.product-accordion-item');

        items.forEach(item => {
            const header = item.querySelector('.product-accordion-header');
            const content = item.querySelector('.product-accordion-content');

            if (!header || !content) return;

            header.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                item.classList.toggle('active', !isActive);
            });
        });
    }

    // ==========================================
    // SEPETE EKLE - ID FIX
    // ==========================================

    function setupAddToCart(fields) {
        const btn = document.getElementById('add-to-cart-btn');
        if (!btn) return;
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', () => {
            const variantInfo = selectedVariant ? selectedVariant.size : (fields.Variants || 'Standard');
            const displayPrice = getDisplayPrice(currentProduct, selectedVariant);

            if (typeof addProductToCart === 'function') {
                addProductToCart({
                    id: currentProduct.id,
                    name: fields.Name,
                    price: displayPrice,
                    image: currentImages.length > 0 ? currentImages[0] : '',
                    variants: variantInfo,
                    delivery: fields.Delivery_time || ''
                });
            } else {
                const cartItem = {
                    id: currentProduct.id, name: fields.Name,
                    price: displayPrice,
                    image: currentImages.length > 0 ? currentImages[0] : '',
                    variants: variantInfo, delivery: fields.Delivery_time || '', quantity: 1
                };
                let cart = JSON.parse(localStorage.getItem('siteCartItems')) || [];
                const existing = cart.find(i => String(i.id) === String(currentProduct.id) && i.variants === variantInfo);
                if (existing) existing.quantity = (existing.quantity || 1) + 1;
                else cart.push(cartItem);
                localStorage.setItem('siteCartItems', JSON.stringify(cart));
                if (typeof updateMiniCartUI === 'function') updateMiniCartUI();
                if (typeof updateCartBadge === 'function') updateCartBadge();
                if (typeof openMiniCart === 'function') openMiniCart();
            }
        });
    }

    // ==========================================
    // RESPONSIVE KONTROL
    // ==========================================

    window.addEventListener('resize', () => {
        const newIsMobile = window.innerWidth <= 768;
        if (newIsMobile !== isMobile && currentImages.length > 0) {
            isMobile = newIsMobile;
            if (isMobile) renderMobileGallery();
            else renderDesktopGallery();
        }
    });

    // ==========================================
    // BASLAT
    // ==========================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProductPage);
    } else {
        initProductPage();
    }
}





// ============================================
// İLGİLİ ÜRÜNLER CAROUSEL - PRODUCT SAYFASI
// ============================================

async function initRelatedProductsCarousel() {
    // currentProduct yüklendikten sonra çalıştır
    if (!currentProduct) {
        console.warn('currentProduct henuz yuklenmedi, ilgili urunler atlaniyor');
        return;
    }

    try {
        const products = await fetchProductsForCarousel({
            limit: 25
        });
        
        // Mevcut ürünü filtrele
        const filtered = products.filter(p => String(p.id) !== String(currentProduct.id));
        
        if (filtered.length === 0) {
            console.warn('Ilgili urun bulunamadi');
            return;
        }

        renderProductCarousel('related-carousel-track', filtered);
        
        new ProductCarousel('related-carousel-wrapper', 'related-carousel-track', {
            showDots: true,
            showArrows: true,
            showScrollHint: true
        });

        console.log('Ilgili urunler carousel yuklendi:', filtered.length);

    } catch (error) {
        console.error('Ilgili urunler hatasi:', error);
    }
}

// ============================================
// BAŞLAT - initProductPage SONUNA EKLE
// ============================================

// Mevcut initProductPage fonksiyonunun SONUNA ekle:
// initRelatedProductsCarousel(); // <- BU SATIRI EKLE
