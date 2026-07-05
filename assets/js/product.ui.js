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
                Product_info: p.product_info || '',
                Delivery_return: p.delivery_return || '',
                Size_tooltip: p.size_tooltip || '',
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

            // Yeni alanlari akordiyonlara ata
            setHTML('product-specs', f.Product_info ? '<div class="specs-content-placeholder">' + f.Product_info.replace(/\n/g, '<br>') + '</div>' : '<div class="specs-content-placeholder"><p>Material, skötselråd och övrig produktinformation visas här.</p></div>');

            setHTML('product-delivery', f.Delivery_return ? '<div class="delivery-content-placeholder">' + f.Delivery_return.replace(/\n/g, '<br>') + '</div>' : '<div class="delivery-content-placeholder"><p><strong>Leveranstid:</strong> <span id="delivery-time-display">' + f.Delivery_time + '</span></p><p><strong>Frakt:</strong> Fri frakt vid köp över 500 SEK</p><p><strong>Retur:</strong> 30 dagars öppet köp</p></div>');

            // Tooltip'i baslat
            setupSizeTooltip(f.Size_tooltip, f.Variants);

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

        // Dinamik olcu gostergesini guncelle (urun isminin alti)
        updateProductSubtitle(selectedVariant);

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
    // OLcu TOOLTIP
    // ==========================================

    function setupSizeTooltip(sizeTooltip, variants) {
        const tooltipContainer = document.getElementById('tooltip-container');
        const tooltipBody = document.getElementById('tooltip-body');

        if (!tooltipContainer || !tooltipBody) return;

        let tooltipContent = '';

        if (sizeTooltip && sizeTooltip.trim()) {
            tooltipContent = sizeTooltip.replace(/
/g, '<br>');
        } else if (variants && variants.length > 0) {
            tooltipContent = '<strong>Tillgängliga storlekar:</strong><br><br>';
            variants.forEach(v => {
                const stockText = v.stock > 0 ? `(${v.stock} st i lager)` : '(Slut i lager)';
                const priceText = v.discount_price && v.discount_price < v.price 
                    ? `<span style="text-decoration:line-through;color:#999;">${v.price} SEK</span> <span style="color:#e54d42;">${v.discount_price} SEK</span>`
                    : `${v.price} SEK`;
                tooltipContent += `• <strong>${v.size}</strong> — ${priceText} ${stockText}<br>`;
            });
        } else {
            tooltipContent = 'Storleksinformation kommer snart.';
        }

        tooltipBody.innerHTML = tooltipContent;
        tooltipContainer.style.display = 'inline-block';

        const toggleSpan = tooltipContainer.querySelector('.tooltip-toggle-span');
        const popup = tooltipContainer.querySelector('.tooltip-popup-box');
        const closeBtn = tooltipContainer.querySelector('.tooltip-close-btn');

        if (toggleSpan && popup) {
            toggleSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                popup.classList.toggle('active');
            });
        }

        if (closeBtn && popup) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                popup.classList.remove('active');
            });
        }

        document.addEventListener('click', (e) => {
            if (popup && !tooltipContainer.contains(e.target)) {
                popup.classList.remove('active');
            }
        });
    }

    // ==========================================
    // DINAMIK URUN ALT BASLIK (Secilen olcu)
    // ==========================================

    function updateProductSubtitle(variant) {
        const subtitleEl = document.getElementById('dynamic-product-subtitle');
        if (!subtitleEl) return;

        if (variant && variant.size) {
            subtitleEl.innerHTML = `<span class="selected-size-display" style="font-size:14px;color:#666;font-weight:500;">${variant.size}</span>`;
            subtitleEl.style.display = 'inline-block';
        } else {
            subtitleEl.innerHTML = '';
            subtitleEl.style.display = 'none';
        }
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
           const variantInfo = selectedVariant 
    ? selectedVariant.size 
    : (Array.isArray(fields.Variants) && fields.Variants.length > 0 
        ? fields.Variants[0].size 
        : 'Standard');
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




const mockRelatedProducts = Array.from({ length: 25 }, (_, i) => ({
    id: 100 + i,
    name: [
        "Persisk Handknuten Matta", "Skandinavisk Ullmatta", "Modern Geometrisk",
        "Vintage Kelim", "Shaggy Hårlig", "Orientalisk Silk", "Boho Bomull",
        "Industriell Jute", "Lyxviskos", "Barnmatta Djur", "Utomhus PP",
        "Löpare Korridor", "Rund Mandala", "3D Effekt", "Anti-Slip",
        "Maskinvävd", "Handtuftad", "Patchwork", "Fårskinn", "Bambu",
        "Återvunnen", "Vattentät", "Värmematta", "Sisal Natur", "Chenille"
    ][i],
    price: `${(Math.random() * 4000 + 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`,
    oldPrice: Math.random() > 0.5 ? `${(Math.random() * 5000 + 2000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr` : null,
    image: `/assets/images/products/related-${(i % 8) + 1}.jpg`,
    badge: Math.random() > 0.7 ? (Math.random() > 0.5 ? 'REA' : 'NYHET') : null
}));

// Render fonksiyonu
function renderCarousel(trackId, products) {
    const track = document.getElementById(trackId);
    if (!track) return;

    track.innerHTML = products.map(p => `
        <div class="product-slide">
            <article class="product-card" data-id="${p.id}">
                <div class="product-card-image">
                    <img src="${p.image}" alt="${p.name}" loading="lazy">
                    ${p.badge ? `<span class="product-card-badge ${p.badge === 'REA' ? 'sale' : 'new'}">${p.badge}</span>` : ''}
                    <button class="product-card-fav" aria-label="Favorit">
                        <i class="fa-regular fa-heart"></i>
                    </button>
                    <button class="product-card-quick-add" data-id="${p.id}">
                        Lägg i varukorg
                    </button>
                </div>
                <div class="product-card-info">
                    <h3 class="product-card-name">${p.name}</h3>
                    <div class="product-card-meta">
                        <div class="product-card-price">
                            <span class="product-card-price-current">${p.price}</span>
                            ${p.oldPrice ? `<span class="product-card-price-old">${p.oldPrice}</span>` : ''}
                        </div>
                    </div>
                </div>
            </article>
        </div>
    `).join('');
}

// Başlat
document.addEventListener('DOMContentLoaded', () => {
    renderCarousel('related-carousel-track', mockRelatedProducts);
    // Son bakılanlar için aynısı...
});







// ============================================
// MODERN SWIPE KARUSEL
// ============================================

class ProductCarousel {
    constructor(wrapperId, trackId, options = {}) {
        this.wrapper = document.getElementById(wrapperId);
        this.track = document.getElementById(trackId);
        if (!this.wrapper || !this.track) return;

        this.options = {
            showDots: true,
            showArrows: true,
            showScrollHint: true,
            ...options
        };

        this.currentIndex = 0;
        this.slides = [];
        this.init();
    }

    init() {
        this.slides = this.track.querySelectorAll('.product-slide');
        if (this.slides.length === 0) return;

        this.createNavigation();
        this.bindEvents();
        this.updateDots();
    }

    createNavigation() {
        // Ok butonları (masaüstü)
        if (this.options.showArrows && window.innerWidth > 768) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'carousel-nav prev';
            prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
            prevBtn.setAttribute('aria-label', 'Föregående');

            const nextBtn = document.createElement('button');
            nextBtn.className = 'carousel-nav next';
            nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            nextBtn.setAttribute('aria-label', 'Nästa');

            this.wrapper.appendChild(prevBtn);
            this.wrapper.appendChild(nextBtn);

            prevBtn.addEventListener('click', () => this.scrollTo('prev'));
            nextBtn.addEventListener('click', () => this.scrollTo('next'));
        }

        // Dot pagination (mobil)
        if (this.options.showDots) {
            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'carousel-dots';

            this.slides.forEach((_, i) => {
                const dot = document.createElement('button');
                dot.className = 'carousel-dot';
                dot.setAttribute('aria-label', `Gå till produkt ${i + 1}`);
                if (i === 0) dot.classList.add('active');
                dot.addEventListener('click', () => this.scrollToIndex(i));
                dotsContainer.appendChild(dot);
            });

            this.wrapper.appendChild(dotsContainer);
            this.dots = dotsContainer.querySelectorAll('.carousel-dot');
        }

        // Scroll hint (mobil)
        if (this.options.showScrollHint && window.innerWidth <= 768) {
            const hint = document.createElement('div');
            hint.className = 'scroll-hint';
            hint.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Svep för att se mer <i class="fa-solid fa-arrow-right"></i>';
            this.wrapper.appendChild(hint);

            // İlk scroll'da gizle
            this.track.addEventListener('scroll', () => {
                hint.style.opacity = '0';
                setTimeout(() => hint.remove(), 500);
            }, { once: true });
        }
    }

    bindEvents() {
        // Scroll event - dot'ları güncelle
        let scrollTimeout;
        this.track.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => this.updateDots(), 50);
        });

        // Touch swipe momentum
        let startX, scrollLeft;
        this.track.addEventListener('touchstart', (e) => {
            startX = e.touches[0].pageX - this.track.offsetLeft;
            scrollLeft = this.track.scrollLeft;
        }, { passive: true });

        this.track.addEventListener('touchmove', (e) => {
            const x = e.touches[0].pageX - this.track.offsetLeft;
            const walk = (x - startX) * 1.5;
            this.track.scrollLeft = scrollLeft - walk;
        }, { passive: true });

        // Favori butonları
        this.track.querySelectorAll('.product-card-fav').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                btn.classList.toggle('active');
                const icon = btn.querySelector('i');
                icon.classList.toggle('fa-regular');
                icon.classList.toggle('fa-solid');
            });
        });

        // Kart tıklama
        this.track.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                if (id) window.location.href = `product.html?id=${id}`;
            });
        });

        // Hızlı ekle butonu
        this.track.querySelectorAll('.product-card-quick-add').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Sepete ekle fonksiyonu
                console.log('Hızlı ekle:', btn.dataset.id);
            });
        });
    }

    scrollTo(direction) {
        const slideWidth = this.slides[0].offsetWidth + 16; // gap
        const scrollAmount = direction === 'next' ? slideWidth : -slideWidth;
        this.track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }

    scrollToIndex(index) {
        const slide = this.slides[index];
        if (slide) {
            slide.scrollIntoView({ behavior: 'smooth', inline: 'start' });
        }
    }

    updateDots() {
        if (!this.dots) return;

        const scrollLeft = this.track.scrollLeft;
        const slideWidth = this.slides[0].offsetWidth + 16;
        const newIndex = Math.round(scrollLeft / slideWidth);

        this.dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === newIndex);
        });
    }
}

// ============================================
// KARUSELLERİ BAŞLAT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // İlgili Ürünler Karuseli
    new ProductCarousel('related-carousel-wrapper', 'related-carousel-track', {
        showDots: true,
        showArrows: true,
        showScrollHint: true
    });

    // Son Bakılanlar Karuseli
    new ProductCarousel('recent-carousel-wrapper', 'recent-carousel-track', {
        showDots: true,
        showArrows: false, // Son bakılanlarda ok yok
        showScrollHint: false
    });
});
