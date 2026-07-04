// ==========================================
// PRODUCT.UI.JS - Lightbox + Mobil Swipe + 3 Akordiyon
// ==========================================

if (window.__productPageInitialized) {
    console.log("⚠️ product.ui.js zaten çalıştırılmış, atlanıyor.");
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

    async function initProductPage() {
        console.log("🚀 Ürün sayfası init başlıyor...");

        let slug = new URLSearchParams(window.location.search).get('slug');
        if (!slug) {
            const parts = window.location.pathname.split('/').filter(p => p);
            slug = parts[parts.length - 1];
        }
        if (!slug || slug === 'product.html') {
            console.error("❌ Slug bulunamadı!");
            return;
        }

        const url = `https://api.airtable.com/v0/${CONFIG.AIRTABLE.BASE_ID}/${CONFIG.AIRTABLE.TABLE_NAME}?filterByFormula=Slug='${slug}'`;

        try {
            const res = await fetch(url, { headers: { Authorization: `Bearer ${CONFIG.AIRTABLE.API_KEY}` } });
            const data = await res.json();
            if (!data.records?.length) { console.error("❌ Ürün bulunamadı!"); return; }

            currentProduct = data.records[0];
            const f = currentProduct.fields;

            // Temel bilgiler
            setText('page-title-product-name', f.Name);
            setText('breadcrumb-product-name', f.Name);
            setText('product-main-name-desktop', f.Name);
            setText('product-price', (f.Price || 0) + " SEK");
            setHTML('product-description', f.Description || '');
            setText('delivery-time-display', f.Delivery_time || '3-7 arbetsdagar');

            // Görseller
            currentImages = f.imageURL || [];
            console.log(`📸 ${currentImages.length} görsel`);

            if (currentImages.length > 0) {
                if (isMobile) {
                    renderMobileGallery();
                } else {
                    renderDesktopGallery();
                }
            }

            // Varyasyonlar
            currentVariants = parseVariants(f.Variants);
            if (currentVariants.length > 0) {
                setupVariantAccordion();
                renderVariantDrawer();
            } else {
                const el = document.getElementById('variant-accordion-wrapper');
                if (el) el.style.display = 'none';
            }

            // Lightbox (sadece masaüstü)
            if (!isMobile) setupLightbox();

            // Akordiyonlar
            setupAccordions();

            // Sepete ekle
            setupAddToCart(f);
            setupWishlistButton(f);

            console.log("✅ Ürün sayfası yüklendi:", f.Name);

        } catch (e) { console.error("❌ Hata:", e); }
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
// WISHLIST / FAVORI
// ==========================================

function setupWishlistButton(fields) {
    const btn = document.querySelector('.ana-urun-favori-buton');
    if (!btn) return;

    // Ürün ID'si
    const productId = currentProduct.id;
    
    // Başlangıç durumunu kontrol et
    updateWishlistButtonState(btn, productId);

    // Click event
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        let wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
        const index = wishlist.findIndex(item => (typeof item === 'string' ? item : item.id) === productId);

        if (index > -1) {
            // Kaldır
            wishlist.splice(index, 1);
            console.log('Favorilerden kaldirildi:', fields.Name);
        } else {
            // Ekle
            wishlist.push({
                id: productId,
                name: fields.Name,
                price: parseFloat(fields.Price) || 0,
                image: currentImages.length > 0 ? currentImages[0].url : ''
            });
            console.log('Favorilere eklendi:', fields.Name);
        }

        localStorage.setItem('wishlistItems', JSON.stringify(wishlist));
        
        // Buton görünümünü güncelle
        updateWishlistButtonState(btn, productId);
        
        // Header badge'i güncelle
        if (typeof updateWishlistBadge === 'function') {
            updateWishlistBadge();
        }
    });
}

function updateWishlistButtonState(btn, productId) {
    const wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
    const isWishlisted = wishlist.some(item => (typeof item === 'string' ? item : item.id) === productId);
    
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
    // MASAÜSTÜ GALERİ (2 Resim + Thumbnail'lar)
    // ==========================================

    function renderDesktopGallery() {
        const container = document.getElementById('desktop-gallery');
        const thumbContainer = document.getElementById('gallery-thumbnail-list');
        const mobileGallery = document.getElementById('mobile-gallery');

        if (container) container.style.display = 'flex';
        if (thumbContainer) thumbContainer.style.display = 'flex';
        if (mobileGallery) mobileGallery.style.display = 'none';

        if (!container) return;

        // 2 büyük resim yan yana
        let mainHTML = '';
        const count = Math.min(2, currentImages.length);

        for (let i = 0; i < count; i++) {
            mainHTML += `
                <div class="main-image-column" data-index="${i}">
                    <img src="${currentImages[i].url}" 
                         alt="${currentProduct.fields.Name} - ${i+1}" 
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
                    <img src="${img.url}" alt="thumb-${i+1}" 
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
                    img.src = currentImages[imgIdx].url;
                    col.setAttribute('data-index', imgIdx);
                }
            });
        }
    };

    // ==========================================
    // MOBİL GALERİ (Swipe + Sayaç + İlerleme Çubuğu)
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
                    <img src="${img.url}" alt="${currentProduct.fields.Name} - ${i+1}">
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
    // LIGHTBOX (Sadece Masaüstü)
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
        if (isMobile) return; // Mobilde lightbox açılmasın
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

        if (img) img.src = currentImages[selectedImageIndex].url;
        if (counter) counter.innerText = `${selectedImageIndex + 1} / ${currentImages.length}`;
        if (prevBtn) prevBtn.disabled = selectedImageIndex === 0;
        if (nextBtn) nextBtn.disabled = selectedImageIndex === currentImages.length - 1;

        // Zoom'u resetle
        isZoomed = false;
        const wrapper = document.getElementById('lightbox-img-wrapper');
        if (wrapper) wrapper.classList.remove('zoomed');

        // Thumbnail'ları güncelle
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
                    <img src="${img.url}" alt="thumb-${i+1}" class="lightbox-thumbnail-item">
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
    // VARYASYON (Aynı kalıyor)
    // ==========================================

    function parseVariants(text) {
        if (!text) return [];
        const t = text.toString().trim();
        const lines = t.split('\n').filter(l => l.trim());
        if (lines.length > 1) {
            return lines.map(line => ({ size: line.trim(), label: line.trim(), price: null }));
        }
        const parts = t.split(',').map(p => p.trim()).filter(p => p);
        if (parts.length > 1) {
            return parts.map(part => ({ size: part, label: part, price: null }));
        }
        return [{ size: t, label: t, price: null }];
    }

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

        const mainImage = currentImages.length > 0 ? currentImages[0].url : '';
        const productName = currentProduct.fields.Name;

        let html = '';
        currentVariants.forEach((variant, index) => {
            const isSelected = selectedVariant && selectedVariant.size === variant.size;
            html += `
                <div class="variant-drawer-item ${isSelected ? 'selected' : ''}" 
                     data-index="${index}" onclick="selectVariant(${index})">
                    <div class="variant-drawer-image">
                        <img src="${mainImage}" alt="${productName} ${variant.label}">
                    </div>
                    <div class="variant-drawer-info">
                        <span class="variant-size">${variant.label}</span>
                        <span class="variant-price">${currentProduct.fields.Price} SEK</span>
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
        if (display) display.innerText = selectedVariant.label;
        if (status) status.style.display = 'inline-flex';
        setTimeout(closeVariantDrawer, 300);
    };

    // ==========================================
    // AKORDİYONLAR (3 Adet)
    // ==========================================

    function setupAccordions() {
        const items = document.querySelectorAll('.product-accordion-item');
        
        items.forEach(item => {
            const header = item.querySelector('.product-accordion-header');
            const content = item.querySelector('.product-accordion-content');
            
            if (!header || !content) return;

            // İlkini açık bırak (opsiyonel - istersen kaldır)
            // if (item === items[0]) item.classList.add('active');

            header.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                
                // Tümünü kapat (tek açık olsun istersen)
                // items.forEach(i => i.classList.remove('active'));
                
                // Toggle
                item.classList.toggle('active', !isActive);
            });
        });
    }

    // ==========================================
    // SEPETE EKLE
    // ==========================================

    function setupAddToCart(fields) {
        const btn = document.getElementById('add-to-cart-btn');
        if (!btn) return;
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', () => {
            const variantInfo = selectedVariant ? selectedVariant.label : (fields.Variants || 'Standard');
            if (typeof addProductToCart === 'function') {
                addProductToCart({
                    id: currentProduct.id,
                    name: fields.Name,
                    price: parseFloat(fields.Price) || 0,
                    image: currentImages.length > 0 ? currentImages[0].url : '',
                    variants: variantInfo,
                    delivery: fields.Delivery_time || ''
                });
            } else {
                const cartItem = {
                    id: currentProduct.id, name: fields.Name,
                    price: parseFloat(fields.Price) || 0,
                    image: currentImages.length > 0 ? currentImages[0].url : '',
                    variants: variantInfo, delivery: fields.Delivery_time || '', quantity: 1
                };
                let cart = JSON.parse(localStorage.getItem('siteCartItems')) || [];
                const existing = cart.find(i => i.id === currentProduct.id);
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
    // BAŞLAT
    // ==========================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProductPage);
    } else {
        initProductPage();
    }
}
