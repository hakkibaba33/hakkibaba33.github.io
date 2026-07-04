// ==========================================
// PRODUCT.UI.JS - SUPABASE UYUMLU (v2.3 - FIXED)
// ==========================================

if (window.__productPageInitialized) {
    console.log("product.ui.js zaten calistirilmis, atlaniyor.");
} else {
    window.__productPageInitialized = true;

    var currentProduct = null;
    var currentVariants = [];
    var selectedVariant = null;
    var currentImages = [];
    var selectedImageIndex = 0;
    var isZoomed = false;
    var isMobile = window.innerWidth <= 768;

    var touchStartX = 0;
    var touchCurrentX = 0;
    var isDragging = false;

    // SUPABASE CLIENT
    var SUPABASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE) ? CONFIG.SUPABASE.URL : '';
    var SUPABASE_KEY = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE) ? CONFIG.SUPABASE.ANON_KEY : '';

    async function supabaseGet(endpoint, params) {
        var url = new URL(SUPABASE_URL + '/rest/v1/' + endpoint);
        if (params) {
            Object.keys(params).forEach(function(key) {
                url.searchParams.append(key, params[key]);
            });
        }

        var res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY,
                'Content-Type': 'application/json'
            }
        });
        if (!res.ok) {
            var errText = await res.text();
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

    // DÜZELTME: Fallback fonksiyonları - common.js yüklenmemişse çalışsın
    function fallbackGetCart() {
        try { return JSON.parse(localStorage.getItem('siteCartItems')) || []; } catch (e) { return []; }
    }
    function fallbackSaveCart(cart) {
        localStorage.setItem('siteCartItems', JSON.stringify(cart));
        if (typeof updateCartBadge === 'function') updateCartBadge();
    }
    function fallbackUpdateCartBadge() {
        var cart = fallbackGetCart();
        var badge = document.querySelector('.cart-count-badge');
        if (badge) {
            badge.textContent = cart.reduce(function(sum, item) { return sum + (item.quantity || 1); }, 0);
            badge.classList.toggle('visible', cart.length > 0);
        }
    }
    function fallbackOpenMiniCart() {
        var overlay = document.getElementById('mini-cart-overlay');
        if (overlay) {
            overlay.classList.add('open');
            document.body.classList.add('cart-open');
        }
    }
    function fallbackUpdateMiniCartUI() {
        // Basit implementasyon
        console.log('Mini cart UI guncellendi (fallback)');
    }
    function fallbackAddProductToCart(productData) {
        var cart = fallbackGetCart();
        var existing = cart.find(function(i) { return i.id === productData.id && i.variants === productData.variants; });
        if (existing) {
            existing.quantity = (existing.quantity || 1) + 1;
        } else {
            var newItem = {};
            Object.keys(productData).forEach(function(key) { newItem[key] = productData[key]; });
            newItem.quantity = 1;
            cart.push(newItem);
        }
        fallbackSaveCart(cart);
        fallbackUpdateMiniCartUI();
        fallbackOpenMiniCart();
    }
    function fallbackUpdateWishlistBadge() {
        try {
            var wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
            var badge = document.querySelector('.wishlist-count-badge');
            if (badge) {
                badge.textContent = wishlist.length;
                badge.classList.toggle('visible', wishlist.length > 0);
            }
        } catch (e) { console.error('Wishlist badge hatasi:', e); }
    }

    async function initProductPage() {
        console.log("Urun sayfasi init basliyor...");

        var slug = new URLSearchParams(window.location.search).get('slug');
        if (!slug) {
            var parts = window.location.pathname.split('/').filter(function(p) { return p; });
            slug = parts[parts.length - 1];
        }
        if (!slug || slug === 'product.html') {
            console.error("Slug bulunamadi!");
            return;
        }

        try {
            // Duz cekme (embed olmadan)
            var products = await supabaseGet('products', {
                slug: 'eq.' + slug,
                select: '*'
            });

            if (products.length === 0) {
                console.error("Urun bulunamadi!");
                return;
            }

            var variants = await supabaseGet('product_variants', {
                product_id: 'eq.' + products[0].id,
                select: '*'
            });

            var data = [{
                ...products[0],
                product_variants: variants
            }];

            if (!data || data.length === 0) {
                console.error("Urun bulunamadi!");
                return;
            }

            currentProduct = data[0];
            var p = currentProduct;
            var f = {
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
            var hasDiscount = p.discount_price && p.discount_price < p.base_price;
            var priceEl = document.getElementById('product-price');
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
                var el = document.getElementById('variant-accordion-wrapper');
                if (el) el.style.display = 'none';
            }

            // Lightbox
            if (!isMobile) setupLightbox();

            // Akordiyonlar
            setupAccordions();

            // Sepete ekle
            setupAddToCart(f, p);
            setupWishlistButton(f, p);

            console.log("Urun sayfasi yuklendi:", f.Name);

        } catch (e) { 
            console.error("Hata:", e); 
        }
    }

    function setText(id, text) {
        var el = document.getElementById(id);
        if (el) el.innerText = text || '---';
    }

    function setHTML(id, html) {
        var el = document.getElementById(id);
        if (el) { el.innerHTML = ''; el.innerHTML = html || ''; }
    }

    // ==========================================
    // WISHLIST / FAVORI
    // ==========================================

    function setupWishlistButton(fields, product) {
        var btn = document.querySelector('.ana-urun-favori-buton');
        if (!btn) return;

        var productId = currentProduct.id;
        updateWishlistButtonState(btn, productId);

        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            var wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
            var index = wishlist.findIndex(function(item) { 
                return (typeof item === 'string' ? item : item.id) === productId; 
            });

            if (index > -1) {
                wishlist.splice(index, 1);
                console.log('Favorilerden kaldirildi:', fields.Name);
            } else {
                wishlist.push({
                    id: productId,
                    name: fields.Name,
                    price: getDisplayPrice(product, selectedVariant),
                    image: currentImages.length > 0 ? currentImages[0] : ''
                });
                console.log('Favorilere eklendi:', fields.Name);
            }

            localStorage.setItem('wishlistItems', JSON.stringify(wishlist));
            updateWishlistButtonState(btn, productId);

            // DÜZELTME: Fallback kullan
            if (typeof updateWishlistBadge === 'function') {
                updateWishlistBadge();
            } else {
                fallbackUpdateWishlistBadge();
            }
        });
    }

    function updateWishlistButtonState(btn, productId) {
        var wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
        var isWishlisted = wishlist.some(function(item) { 
            return (typeof item === 'string' ? item : item.id) === productId; 
        });

        var icon = btn.querySelector('i');
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
    // MASAUSTU GALERI
    // ==========================================

    function renderDesktopGallery() {
        var container = document.getElementById('desktop-gallery');
        var thumbContainer = document.getElementById('gallery-thumbnail-list');
        var mobileGallery = document.getElementById('mobile-gallery');

        if (container) container.style.display = 'flex';
        if (thumbContainer) thumbContainer.style.display = 'flex';
        if (mobileGallery) mobileGallery.style.display = 'none';

        if (!container) return;

        var mainHTML = '';
        var count = Math.min(2, currentImages.length);

        for (var i = 0; i < count; i++) {
            mainHTML += '<div class="main-image-column" data-index="' + i + '">' +
                '<img src="' + currentImages[i] + '" ' +
                'alt="' + currentProduct.name + ' - ' + (i+1) + '" ' +
                'class="main-image"' +
                'onclick="openLightbox(' + i + ')">' +
                '</div>';
        }
        container.innerHTML = mainHTML;

        if (thumbContainer) {
            var thumbHTML = '';
            currentImages.forEach(function(img, i) {
                thumbHTML += '<img src="' + img + '" alt="thumb-' + (i+1) + '" ' +
                    'class="thumbnail-item ' + (i === 0 ? 'selected' : '') + '"' +
                    'data-index="' + i + '"' +
                    'onclick="selectMainImage(' + i + ')">';
            });
            thumbContainer.innerHTML = thumbHTML;
        }
    }

    window.selectMainImage = function(index) {
        selectedImageIndex = index;
        document.querySelectorAll('.thumbnail-item').forEach(function(thumb, i) {
            thumb.classList.toggle('selected', i === index);
        });
        if (currentImages.length > 2) {
            var cols = document.querySelectorAll('.main-image-column');
            cols.forEach(function(col, i) {
                var imgIdx = (index + i) % currentImages.length;
                var img = col.querySelector('img');
                if (img) {
                    img.src = currentImages[imgIdx];
                    col.setAttribute('data-index', imgIdx);
                }
            });
        }
    };

    // ==========================================
    // MOBIL GALERI
    // ==========================================

    function renderMobileGallery() {
        var container = document.getElementById('desktop-gallery');
        var thumbContainer = document.getElementById('gallery-thumbnail-list');
        var mobileGallery = document.getElementById('mobile-gallery');
        var track = document.getElementById('mobile-gallery-track');

        if (container) container.style.display = 'none';
        if (thumbContainer) thumbContainer.style.display = 'none';
        if (mobileGallery) mobileGallery.style.display = 'block';

        if (!track) return;

        var html = '';
        currentImages.forEach(function(img, i) {
            html += '<div class="mobile-gallery-slide" data-index="' + i + '">' +
                '<img src="' + img + '" alt="' + currentProduct.name + ' - ' + (i+1) + '">' +
                '</div>';
        });
        track.innerHTML = html;

        updateMobileCounter();
        setupMobileSwipe();
    }

    function updateMobileCounter() {
        var counter = document.getElementById('mobile-gallery-counter');
        var thumb = document.getElementById('mobile-scrollbar-thumb');
        var total = currentImages.length;

        if (counter) counter.innerText = (selectedImageIndex + 1) + ' / ' + total;

        if (thumb && total > 1) {
            var widthPercent = (1 / total) * 100;
            var leftPercent = (selectedImageIndex / total) * 100;
            thumb.style.width = widthPercent + '%';
            thumb.style.left = leftPercent + '%';
        }
    }

    function setupMobileSwipe() {
        var track = document.getElementById('mobile-gallery-track');
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
        var diff = touchCurrentX - touchStartX;
        var track = document.getElementById('mobile-gallery-track');
        if (track) {
            var offset = -selectedImageIndex * 100 + (diff / window.innerWidth) * 100;
            track.style.transform = 'translateX(' + offset + '%)';
        }
    }

    function handleTouchEnd(e) {
        if (!isDragging) return;
        isDragging = false;
        var diff = touchCurrentX - touchStartX;
        var threshold = 50;

        var track = document.getElementById('mobile-gallery-track');

        if (diff < -threshold && selectedImageIndex < currentImages.length - 1) {
            selectedImageIndex++;
        } else if (diff > threshold && selectedImageIndex > 0) {
            selectedImageIndex--;
        }

        if (track) {
            track.style.transition = 'transform 0.3s ease-out';
            track.style.transform = 'translateX(-' + (selectedImageIndex * 100) + '%)';
            setTimeout(function() { track.style.transition = ''; }, 300);
        }
        updateMobileCounter();
    }

    // ==========================================
    // LIGHTBOX
    // ==========================================

    function setupLightbox() {
        var closeBtn = document.getElementById('lightbox-close');
        var prevBtn = document.getElementById('lightbox-prev');
        var nextBtn = document.getElementById('lightbox-next');
        var imgContainer = document.getElementById('lightbox-img-container');

        if (closeBtn) closeBtn.onclick = closeLightbox;
        if (prevBtn) prevBtn.onclick = function() { navigateLightbox(-1); };
        if (nextBtn) nextBtn.onclick = function() { navigateLightbox(1); };

        if (imgContainer) {
            imgContainer.addEventListener('dblclick', toggleZoom);
        }

        document.addEventListener('keydown', function(e) {
            var overlay = document.getElementById('custom-lightbox');
            if (!overlay || !overlay.classList.contains('active')) return;
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') navigateLightbox(-1);
            if (e.key === 'ArrowRight') navigateLightbox(1);
        });

        renderLightboxThumbnails();
    }

    window.openLightbox = function(index) {
        if (isMobile) return;
        selectedImageIndex = index;
        updateLightboxImage();
        var overlay = document.getElementById('custom-lightbox');
        if (overlay) {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };

    function closeLightbox() {
        var overlay = document.getElementById('custom-lightbox');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
        isZoomed = false;
        var wrapper = document.getElementById('lightbox-img-wrapper');
        if (wrapper) wrapper.classList.remove('zoomed');
    }

    function navigateLightbox(direction) {
        var newIndex = selectedImageIndex + direction;
        if (newIndex >= 0 && newIndex < currentImages.length) {
            selectedImageIndex = newIndex;
            updateLightboxImage();
        }
    }

    function updateLightboxImage() {
        var img = document.getElementById('lightbox-main-img');
        var counter = document.getElementById('lightbox-counter');
        var prevBtn = document.getElementById('lightbox-prev');
        var nextBtn = document.getElementById('lightbox-next');

        if (img) img.src = currentImages[selectedImageIndex];
        if (counter) counter.innerText = (selectedImageIndex + 1) + ' / ' + currentImages.length;
        if (prevBtn) prevBtn.disabled = selectedImageIndex === 0;
        if (nextBtn) nextBtn.disabled = selectedImageIndex === currentImages.length - 1;

        isZoomed = false;
        var wrapper = document.getElementById('lightbox-img-wrapper');
        if (wrapper) wrapper.classList.remove('zoomed');

        document.querySelectorAll('.lightbox-thumb-item-container').forEach(function(thumb, i) {
            thumb.classList.toggle('selected', i === selectedImageIndex);
        });
    }

    function toggleZoom() {
        if (isMobile) return;
        isZoomed = !isZoomed;
        var wrapper = document.getElementById('lightbox-img-wrapper');
        if (wrapper) wrapper.classList.toggle('zoomed', isZoomed);
    }

    function renderLightboxThumbnails() {
        var list = document.getElementById('lightbox-thumb-list');
        if (!list) return;

        var html = '';
        currentImages.forEach(function(img, i) {
            html += '<div class="lightbox-thumb-item-container ' + (i === 0 ? 'selected' : '') + '" ' +
                'onclick="lightboxSelectThumb(' + i + ')">' +
                '<img src="' + img + '" alt="thumb-' + (i+1) + '" class="lightbox-thumbnail-item">' +
                '</div>';
        });
        list.innerHTML = html;
    }

    window.lightboxSelectThumb = function(index) {
        selectedImageIndex = index;
        updateLightboxImage();
    };

    // ==========================================
    // VARYANT
    // ==========================================

    function setupVariantAccordion() {
        var btn = document.getElementById('variant-accordion-btn');
        if (!btn) return;
        var newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openVariantDrawer();
        });
    }

    function openVariantDrawer() {
        var overlay = document.getElementById('variant-drawer-overlay');
        var drawer = document.getElementById('variant-drawer');
        if (overlay && drawer) {
            overlay.classList.add('open');
            drawer.classList.add('open');
            document.body.classList.add('drawer-open');
        }
    }

    window.closeVariantDrawer = function() {
        var overlay = document.getElementById('variant-drawer-overlay');
        var drawer = document.getElementById('variant-drawer');
        if (overlay && drawer) {
            overlay.classList.remove('open');
            drawer.classList.remove('open');
            document.body.classList.remove('drawer-open');
        }
    };

    function renderVariantDrawer() {
        var body = document.getElementById('variant-drawer-body');
        if (!body) return;

        var mainImage = currentImages.length > 0 ? currentImages[0] : '';
        var productName = currentProduct.name;

        var html = '';
        currentVariants.forEach(function(variant, index) {
            var isSelected = selectedVariant && selectedVariant.id === variant.id;
            var displayPrice = getDisplayPrice(currentProduct, variant);
            var originalPrice = getOriginalPrice(currentProduct, variant);
            var hasDiscount = variant.discount_price && variant.discount_price < variant.price;

            html += '<div class="variant-drawer-item ' + (isSelected ? 'selected' : '') + '" ' +
                'data-index="' + index + '" onclick="selectVariant(' + index + ')">' +
                '<div class="variant-drawer-image">' +
                '<img src="' + mainImage + '" alt="' + productName + ' ' + variant.size + '">' +
                '</div>' +
                '<div class="variant-drawer-info">' +
                '<span class="variant-size">' + variant.size + '</span>' +
                '<span class="variant-price">' +
                (hasDiscount ? '<span style="text-decoration:line-through;color:#999;font-size:12px;">' + originalPrice + ' SEK</span> ' : '') +
                '<span style="' + (hasDiscount ? 'color:#e54d42;' : '') + '">' + displayPrice + ' SEK</span>' +
                '</span>' +
                '<span class="variant-stock" style="font-size:12px;color:' + (variant.stock > 0 ? '#22c55e' : '#e54d42') + ';">' +
                (variant.stock > 0 ? 'I lager (' + variant.stock + ' st)' : 'Slut i lager') +
                '</span>' +
                '</div>' +
                '<div class="variant-check">' +
                (isSelected ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-regular fa-circle"></i>') +
                '</div>' +
                '</div>';
        });
        body.innerHTML = html;

        var closeBtn = document.getElementById('close-variant-drawer');
        if (closeBtn) closeBtn.onclick = closeVariantDrawer;

        var overlay = document.getElementById('variant-drawer-overlay');
        if (overlay) overlay.onclick = function(e) { if (e.target === overlay) closeVariantDrawer(); };
    }

    window.selectVariant = function(index) {
        selectedVariant = currentVariants[index];
        document.querySelectorAll('.variant-drawer-item').forEach(function(item, i) {
            item.classList.toggle('selected', i === index);
            var icon = item.querySelector('.variant-check i');
            if (icon) icon.className = i === index ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle';
        });

        var display = document.getElementById('selected-variant-display');
        var status = document.getElementById('variant-status');
        var priceDisplay = document.getElementById('product-price');

        if (display) display.innerText = selectedVariant.size;
        if (status) status.style.display = 'inline-flex';

        // Fiyatı guncelle
        if (priceDisplay) {
            var displayPrice = getDisplayPrice(currentProduct, selectedVariant);
            var originalPrice = getOriginalPrice(currentProduct, selectedVariant);
            var hasDiscount = selectedVariant.discount_price && selectedVariant.discount_price < selectedVariant.price;

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
    // AKORDIYONLAR
    // ==========================================

    function setupAccordions() {
        var items = document.querySelectorAll('.product-accordion-item');

        items.forEach(function(item) {
            var header = item.querySelector('.product-accordion-header');
            var content = item.querySelector('.product-accordion-content');

            if (!header || !content) return;

            header.addEventListener('click', function() {
                var isActive = item.classList.contains('active');
                item.classList.toggle('active', !isActive);
            });
        });
    }

    // ==========================================
    // SEPETE EKLE
    // ==========================================

    function setupAddToCart(fields, product) {
        var btn = document.getElementById('add-to-cart-btn');
        if (!btn) return;
        var newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', function() {
            var variantInfo = selectedVariant ? selectedVariant.size : 'Standard';
            var displayPrice = getDisplayPrice(product, selectedVariant);

            var cartData = {
                id: currentProduct.id,
                name: fields.Name,
                price: displayPrice,
                image: currentImages.length > 0 ? currentImages[0] : '',
                variants: variantInfo,
                delivery: fields.Delivery_time || ''
            };

            // DÜZELTME: common.js fonksiyonlarını kontrol et, yoksa fallback kullan
            if (typeof addProductToCart === 'function') {
                addProductToCart(cartData);
            } else {
                console.warn('addProductToCart bulunamadi, fallback kullaniliyor');
                fallbackAddProductToCart(cartData);
            }
        });
    }

    // ==========================================
    // RESPONSIVE
    // ==========================================

    window.addEventListener('resize', function() {
        var newIsMobile = window.innerWidth <= 768;
        if (newIsMobile !== isMobile && currentImages.length > 0) {
            isMobile = newIsMobile;
            if (isMobile) renderMobileGallery();
            else renderDesktopGallery();
        }
    });

    // ==========================================
    // BASLAT
    // ==========================================
    // DÜZELTME: async fonksiyonu düzgün çağır
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initProductPage().catch(function(e) {
                console.error("initProductPage hatasi:", e);
            });
        });
    } else {
        initProductPage().catch(function(e) {
            console.error("initProductPage hatasi:", e);
        });
    }
}
