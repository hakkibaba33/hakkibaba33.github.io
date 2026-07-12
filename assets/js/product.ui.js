// ==========================================
// PRODUCT.UI.JS - SUPABASE UYUMLU (v3.3 - FIXED)
// Eski Airtable yapısını koru, sadece API Supabase'e çevrildi
// YENI: Eski URL formatlarını yeni slug-based URL'lere yönlendirme
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


    // ==========================================
    // RENKLER - Ürün Sayfası Renk Kutucukları
    // ==========================================

    const COLOR_MAP = {
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
        if (COLOR_MAP[normalized]) return COLOR_MAP[normalized];
        for (const [key, value] of Object.entries(COLOR_MAP)) {
            if (normalized.includes(key) || key.includes(normalized)) return value;
        }
        if (/^#[0-9A-F]{6}$/i.test(normalized)) return normalized;
        return '#ccc';
    }

    function renderProductColors(colors) {
        const wrapper = document.getElementById('product-colors-wrapper');
        const list = document.getElementById('product-colors-list');
        if (!wrapper || !list) return;

        if (!colors || colors.length === 0) {
            wrapper.style.display = 'none';
            return;
        }

        let html = '';
        colors.forEach((color, index) => {
            const bgStyle = getColorStyle(color);
            html += `<button type="button" class="color-option" data-color="${color}" title="${color}" style="background: ${bgStyle};"></button>`;
        });

        list.innerHTML = html;
        wrapper.style.display = 'block';

        // Renk seçim event'i
        list.querySelectorAll('.color-option').forEach(btn => {
            btn.addEventListener('click', () => {
                list.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                console.log('Renk seçildi:', btn.dataset.color);
            });
        });
    }

    // ==========================================
    // ESKI ID-BASED URL'LERI YENI SLUG-BASED URL'LERE YONLENDIR
    // ==========================================

    async function redirectFromIdToSlug(productId) {
        try {
            const products = await supabaseGet('products', {
                id: 'eq.' + productId,
                select: 'slug'
            });

            if (products.length > 0 && products[0].slug) {
                window.location.replace(`/produkt/${products[0].slug}`);
            } else {
                console.error("ID ile slug bulunamadi:", productId);
                window.location.href = '/404.html';
            }
        } catch (e) {
            console.error("ID'den slug bulunurken hata:", e);
            window.location.href = '/404.html';
        }
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

// ==========================================
// URUN SAYFASI INIT - SLUG ROUTING (DÜZELTİLMİŞ)
// ==========================================

async function initProductPage() {
    console.log("Urun sayfasi init basliyor...");
    console.log("Full URL:", window.location.href);
    console.log("Pathname:", window.location.pathname);

    let slug = null;
    const path = window.location.pathname;
    const parts = path.split('/').filter(p => p);
    const urlParams = new URLSearchParams(window.location.search);

    // 1) YENI FORMAT: /produkt/slug-adi
    if (parts.length >= 2 && parts[0] === 'produkt') {
        slug = parts[1];
        if (slug === 'index.html') slug = null;
        else console.log("Slug pathname'den bulundu:", slug);
    }

    // 2) ESKI FORMAT: /produkt/?slug=xxx (kategori sayfasından gelen)
    if (!slug) {
        const slugParam = urlParams.get('slug');
        if (slugParam) {
            slug = slugParam;
            console.log("Slug parametreden bulundu:", slug);
        }
    }

    // 3) ESKI FORMAT: ?id=xxx
      if (!slug) {
    const slugParam = urlParams.get('slug');
    if (slugParam) {
        console.log("Eski ?slug= formati, yonlendiriliyor:", slugParam);
        window.location.replace('/produkt/' + encodeURIComponent(slugParam));
        return;
    }
}

    if (!slug) {
        console.error("Slug bulunamadi! URL:", window.location.href);
        document.querySelector('.product-page').innerHTML = 
            '<p style="text-align:center;padding:60px;">Produkt hittades inte. <a href="/">Tillbaka till startsidan</a></p>';
        return;
    }

    console.log("Final Slug:", slug);

        try {
            // Duz cekme (embed olmadan)

            const products = await supabaseGet('products', {
                slug: 'eq.' + slug,
                select: '*'
            });

            if (products.length === 0) {
                console.error("Urun bulunamadi! Slug:", slug);
                document.querySelector('.product-page').innerHTML = 
                    '<p style="text-align:center;padding:60px;">Produkt hittades inte. <a href="/">Tillbaka till startsidan</a></p>';
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
            window.__currentProductId = currentProduct.id;  // Global ID
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
            setText('delivery-time-text', 'Leveranstid: ' + f.Delivery_time);

            // Yeni alanlari akordiyonlara ata
            setHTML('product-specs', f.Product_info ? '<div class="specs-content-placeholder">' + f.Product_info.split('\n').join('<br>') + '</div>' : '<div class="specs-content-placeholder"><p>Material, skötselråd och övrig produktinformation visas här.</p></div>');

            setHTML('product-delivery', f.Delivery_return ? '<div class="delivery-content-placeholder">' + f.Delivery_return.split('\n').join('<br>') + '</div>' : '<div class="delivery-content-placeholder"><p><strong>Leveranstid:</strong> <span id="delivery-time-display">' + f.Delivery_time + '</span></p><p><strong>Frakt:</strong> Fri frakt vid köp över 500 SEK</p><p><strong>Retur:</strong> 30 dagars öppet köp</p></div>');

            // Tooltip'i baslat
            if (typeof setupSizeTooltip === 'function') setupSizeTooltip(f.Size_tooltip, f.Variants);

            // Renkler
            if (p.colors && p.colors.length > 0) {
                renderProductColors(p.colors);
            }

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
                // Fiyata gore sirala (en dusuk fiyat once)
                currentVariants.sort(function(a, b) {
                    var priceA = a.discount_price || a.price || 999999;
                    var priceB = b.discount_price || b.price || 999999;
                    return priceA - priceB;
                });
                setupVariantAccordion();
                renderVariantDrawer();
                // Baslangicta en kucuk fiyatli varyanti otomatik sec
                selectVariant(0);
                // Baslangicta en kucuk varyasyonun olcusunu urun isminin altinda goster
                if (typeof updateProductSubtitle === 'function') updateProductSubtitle(currentVariants[0]);
            } else {
                const el = document.getElementById('variant-accordion-wrapper');
                if (el) el.style.display = 'none';
            }

            // Lightbox (sadece masaustu)
            if (!isMobile && typeof setupLightbox === 'function') setupLightbox();

            // Akordiyonlar
            if (typeof setupAccordions === 'function') setupAccordions();

            // Sepete ekle
            if (typeof setupAddToCart === 'function') setupAddToCart(f);
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

    

    // ==========================================
    // TOOLTIP - Boyut Tablosu
    // ==========================================

    function setupSizeTooltip(sizeTooltipHtml, variants) {
        const tooltipBody = document.getElementById('tooltip-body');
        if (!tooltipBody) return;

        if (sizeTooltipHtml && sizeTooltipHtml.trim()) {
            tooltipBody.innerHTML = sizeTooltipHtml;
        } else if (variants && variants.length > 0) {
            // Varyasyonlardan basit bir tablo oluştur
            let html = '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
            html += '<tr style="border-bottom:1px solid #eee;"><th style="text-align:left;padding:6px;">Storlek</th><th style="text-align:right;padding:6px;">Pris</th></tr>';
            variants.forEach(v => {
                const price = v.discount_price || v.price || 0;
                html += `<tr style="border-bottom:1px solid #f5f5f5;"><td style="padding:6px;">${v.size || '-'}</td><td style="text-align:right;padding:6px;">${price} SEK</td></tr>`;
            });
            html += '</table>';
            tooltipBody.innerHTML = html;
        } else {
            tooltipBody.innerHTML = '<p>Ingen storleksinformation tillgänglig.</p>';
        }

        // Tooltip toggle event
        const tooltipContainer = document.getElementById('tooltip-container');
        const closeBtn = tooltipContainer?.querySelector('.tooltip-close-btn');

        const popupBox = tooltipContainer.querySelector('.tooltip-popup-box');

        if (tooltipContainer) {
            const toggle = tooltipContainer.querySelector('.tooltip-toggle-span');
            if (toggle) {
                toggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (popupBox) popupBox.classList.toggle('active');
                });
            }
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (popupBox) popupBox.classList.remove('active');
            });
        }

        // Dışarı tıklayınca kapat
        document.addEventListener('click', (e) => {
            const tooltipContainer = document.getElementById('tooltip-container');
            if (tooltipContainer && !tooltipContainer.contains(e.target)) {
                if (popupBox) popupBox.classList.remove('active');
            }
        });
    }

    // ==========================================
    // AKORDİYONLAR
    // ==========================================

    function setupAccordions() {
        document.querySelectorAll('.product-accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                const item = header.parentElement;
                const content = item.querySelector('.product-accordion-content');
                const icon = header.querySelector('.fa-chevron-down');

                // Diğerlerini kapat (isteğe bağlı - tek açık)
                // document.querySelectorAll('.product-accordion-item').forEach(other => {
                //     if (other !== item) {
                //         other.classList.remove('open');
                //         other.querySelector('.product-accordion-content').style.display = 'none';
                //         other.querySelector('.fa-chevron-down').style.transform = 'rotate(0deg)';
                //     }
                // });

                const isOpen = item.classList.contains('active');

                if (isOpen) {
                    item.classList.remove('active');
                    if (content) content.style.display = 'none';
                    if (icon) icon.style.transform = 'rotate(0deg)';
                } else {
                    item.classList.add('active');
                    if (content) content.style.display = 'block';
                    if (icon) icon.style.transform = 'rotate(180deg)';
                }
            });
        });

        // Başlangıçta tüm akordiyonları kapalı tut
        document.querySelectorAll('.product-accordion-content').forEach(content => {
            content.style.display = 'none';
        });
    }

    // ==========================================
    // URUN ALT BASLIK GUNCELLEME
    // ==========================================

    function updateProductSubtitle(variant) {
        const subtitleEl = document.getElementById('dynamic-product-subtitle');
        if (!subtitleEl || !variant) return;

        const sizeDisplay = subtitleEl.querySelector('.selected-size-display');
        if (sizeDisplay) {
            sizeDisplay.textContent = variant.size || 'Välj storlek';
            sizeDisplay.style.color = '#333';
        }
    }

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

    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let panTranslateX = 0;
    let panTranslateY = 0;

    function setupLightbox() {
        const closeBtn = document.getElementById('lightbox-close');
        const prevBtn = document.getElementById('lightbox-prev');
        const nextBtn = document.getElementById('lightbox-next');
        const imgContainer = document.getElementById('lightbox-img-container');

        if (closeBtn) closeBtn.onclick = closeLightbox;
        if (prevBtn) prevBtn.onclick = () => navigateLightbox(-1);
        if (nextBtn) nextBtn.onclick = () => navigateLightbox(1);

        if (imgContainer) {
            imgContainer.addEventListener('dblclick', toggleZoom);
        }

        setupPanEvents();

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
        if (isMobile) return;
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
        resetPan();
        const wrapper = document.getElementById('lightbox-img-wrapper');
        if (wrapper) {
            wrapper.classList.remove('zoomed');
            wrapper.style.transform = '';
        }
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

        isZoomed = false;
        resetPan();
        const wrapper = document.getElementById('lightbox-img-wrapper');
        if (wrapper) {
            wrapper.classList.remove('zoomed');
            wrapper.style.transform = '';
        }

        document.querySelectorAll('.lightbox-thumb-item-container').forEach((thumb, i) => {
            thumb.classList.toggle('selected', i === selectedImageIndex);
        });
    }

    function toggleZoom() {
        if (isMobile) return;
        isZoomed = !isZoomed;
        const wrapper = document.getElementById('lightbox-img-wrapper');
        if (!wrapper) return;

        wrapper.classList.toggle('zoomed', isZoomed);

        if (isZoomed) {
            wrapper.style.transform = 'scale(2)';
            wrapper.style.cursor = 'grab';
        } else {
            resetPan();
            wrapper.style.transform = '';
            wrapper.style.cursor = 'zoom-in';
        }
    }

    function resetPan() {
        panTranslateX = 0;
        panTranslateY = 0;
    }

    function setupPanEvents() {
        const container = document.getElementById('lightbox-img-container');
        if (!container) return;

        container.addEventListener('mousedown', startPan);
        window.addEventListener('mousemove', movePan);
        window.addEventListener('mouseup', endPan);

        container.addEventListener('touchstart', handleTouchStartPan, { passive: false });
        window.addEventListener('touchmove', handleTouchMovePan, { passive: false });
        window.addEventListener('touchend', endPan);
    }

    function startPan(e) {
        if (!isZoomed) return;

        isPanning = true;
        panStartX = e.clientX - panTranslateX;
        panStartY = e.clientY - panTranslateY;

        const wrapper = document.getElementById('lightbox-img-wrapper');
        if (wrapper) wrapper.style.cursor = 'grabbing';

        e.preventDefault();
    }

    function movePan(e) {
        if (!isPanning || !isZoomed) return;

        panTranslateX = e.clientX - panStartX;
        panTranslateY = e.clientY - panStartY;

        limitPanBounds();
        updatePanTransform();

        e.preventDefault();
    }

    function endPan() {
        isPanning = false;
        const wrapper = document.getElementById('lightbox-img-wrapper');
        if (wrapper) wrapper.style.cursor = isZoomed ? 'grab' : 'zoom-in';
    }

    function handleTouchStartPan(e) {
        if (!isZoomed) return;
        const touch = e.touches[0];
        startPan({ 
            clientX: touch.clientX, 
            clientY: touch.clientY, 
            preventDefault: () => e.preventDefault() 
        });
    }

    function handleTouchMovePan(e) {
        if (!isPanning || !isZoomed) return;
        const touch = e.touches[0];
        movePan({ 
            clientX: touch.clientX, 
            clientY: touch.clientY, 
            preventDefault: () => e.preventDefault() 
        });
    }

    function limitPanBounds() {
        const container = document.getElementById('lightbox-img-container');
        const img = document.getElementById('lightbox-main-img');
        if (!container || !img) return;

        const containerRect = container.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();

        const overflowX = Math.max(0, (imgRect.width - containerRect.width) / 2);
        const overflowY = Math.max(0, (imgRect.height - containerRect.height) / 2);

        panTranslateX = Math.max(-overflowX, Math.min(overflowX, panTranslateX));
        panTranslateY = Math.max(-overflowY, Math.min(overflowY, panTranslateY));
    }

    function updatePanTransform() {
        const wrapper = document.getElementById('lightbox-img-wrapper');
        if (wrapper && isZoomed) {
            wrapper.style.transform = `translate(${panTranslateX}px, ${panTranslateY}px) scale(2)`;
        }
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
    // VARYASYON
    // ==========================================

    function setupVariantAccordion() {
        const btn = document.getElementById('variant-accordion-btn');
        if (!btn) return;
        const newBtn = btn.cloneNode(true);
        if (btn.parentNode) {
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openVariantDrawer();
            });
        }
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
        window.__selectedProductVariant = selectedVariant ? selectedVariant.size : null;
        document.querySelectorAll('.variant-drawer-item').forEach((item, i) => {
            item.classList.toggle('selected', i === index);
            const icon = item.querySelector('.variant-check i');
            if (icon) icon.className = i === index ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle';
        });

        const display = document.getElementById('selected-variant-display');
        if (display && selectedVariant) {
            display.textContent = selectedVariant.size;
        }
    };

        // ==========================================
    // SEPETE EKLE
    // ==========================================

    function setupAddToCart(fields) {
        const btn = document.getElementById('add-to-cart-btn');
        if (!btn) return;

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!selectedVariant) {
                alert('Välj storlek först');
                return;
            }

            const cartItem = {
                id: currentProduct.id,
                name: fields.Name,
                price: getDisplayPrice(currentProduct, selectedVariant),
                image: currentImages.length > 0 ? currentImages[0] : '',
                variants: selectedVariant.size,
                delivery: fields.Delivery_time || '3-7 arbetsdagar',
                quantity: 1
            };

            let cart = JSON.parse(localStorage.getItem('siteCartItems')) || [];
            const existing = cart.find(item => 
                String(item.id) === String(cartItem.id) && item.variants === cartItem.variants
            );

            if (existing) {
                existing.quantity = (existing.quantity || 1) + 1;
            } else {
                cart.push(cartItem);
            }

            localStorage.setItem('siteCartItems', JSON.stringify(cart));

            // Badge güncelle
            if (typeof updateCartBadge === 'function') {
                updateCartBadge();
            }

            // Mini cart aç
            if (typeof openMiniCart === 'function') {
                openMiniCart();
            }

            console.log('Sepete eklendi:', fields.Name, selectedVariant.size);
        });
    }
      
    
    

    // ==========================================
    // BASLAT
    // ==========================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProductPage);
    } else {
        initProductPage();
    }

}