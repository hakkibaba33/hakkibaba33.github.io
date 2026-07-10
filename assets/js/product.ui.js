// ==========================================
// DEBUG FONKSIYONU
// ==========================================
window.debugProduct = function() {
    console.log('=== DEBUG ===');
    console.log('currentProduct:', currentProduct);
    console.log('discount_price:', currentProduct?.discount_price);
    console.log('base_price:', currentProduct?.base_price);
    console.log('colors:', currentProduct?.colors);
    console.log('typeof discount_price:', typeof currentProduct?.discount_price);
    console.log('typeof colors:', typeof currentProduct?.colors);
    console.log('Array.isArray(colors):', Array.isArray(currentProduct?.colors));
};











// ==========================================
// PRODUCT.UI.JS - SUPABASE UYUMLU (v3.4 - FULL FIX)
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
        // Önce variant indirimli fiyatı
        if (variant && variant.discount_price && parseFloat(variant.discount_price) > 0) {
            return parseFloat(variant.discount_price);
        }
        // Sonra variant normal fiyatı
        if (variant && variant.price && parseFloat(variant.price) > 0) {
            return parseFloat(variant.price);
        }
        // Sonra ürün indirimli fiyatı
        if (product && product.discount_price && parseFloat(product.discount_price) > 0) {
            return parseFloat(product.discount_price);
        }
        // Son olarak ürün temel fiyatı
        return parseFloat(product?.base_price) || 0;
    }

    function getOriginalPrice(product, variant) {
        // Orijinal fiyat = indirimsiz fiyat
        if (variant && variant.price && parseFloat(variant.price) > 0) {
            return parseFloat(variant.price);
        }
        return parseFloat(product?.base_price) || 0;
    }

    function hasDiscount(product, variant) {
        const original = getOriginalPrice(product, variant);
        const display = getDisplayPrice(product, variant);
        return original > display && display > 0;
    }

    // ==========================================
    // URUN SAYFASI INIT
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

        // 2) ESKI FORMAT: /produkt/?slug=xxx
        if (!slug) {
            const slugParam = urlParams.get('slug');
            if (slugParam) {
                slug = slugParam;
                console.log("Slug parametreden bulundu:", slug);
            }
        }

        // 3) ESKI FORMAT: ?id=xxx
        if (!slug) {
            const idParam = urlParams.get('id');
            if (idParam) {
                console.log("Eski ?id= formati, yonlendiriliyor:", idParam);
                redirectFromIdToSlug(idParam);
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

            currentProduct = products[0];
            currentProduct.product_variants = variants;

            const p = currentProduct;
            
            // DEBUG: Fiyat bilgilerini logla
            console.log('=== URUN VERILERI ===');
            console.log('base_price:', p.base_price, typeof p.base_price);
            console.log('discount_price:', p.discount_price, typeof p.discount_price);
            console.log('variants:', variants.length);

            // Temel bilgiler
            setText('page-title-product-name', p.name);
            setText('breadcrumb-product-name', p.name);
            setText('product-main-name-desktop', p.name);

            // Fiyat gösterimi - YENI: Daha güvenli kontrol
            const basePrice = parseFloat(p.base_price) || 0;
            const discountPrice = (p.discount_price !== null && p.discount_price !== undefined && p.discount_price !== '') 
                ? parseFloat(p.discount_price) 
                : 0;
            const productHasDiscount = discountPrice > 0 && discountPrice < basePrice;

            console.log('Hesaplanan:', {basePrice, discountPrice, productHasDiscount});

            const priceEl = document.getElementById('product-price');
            if (priceEl) {
                if (productHasDiscount) {
                    priceEl.innerHTML = 
                        '<span style="text-decoration:line-through;color:#999;font-size:18px;margin-right:8px;">' + 
                        basePrice.toLocaleString('sv-SE') + ' SEK</span>' +
                        '<span style="color:#e54d42;font-size:24px;font-weight:bold;">' + 
                        discountPrice.toLocaleString('sv-SE') + ' SEK</span>';
                } else {
                    priceEl.innerHTML = '<span style="font-size:24px;font-weight:bold;">' + 
                        basePrice.toLocaleString('sv-SE') + " SEK</span>";
                }
            }

            // Teslimat süresi
            const deliveryTime = p.delivery_time || '3-7 arbetsdagar';
            setText('delivery-time-display', deliveryTime);
            const deliveryTimeText = document.getElementById('delivery-time-text');
            if (deliveryTimeText) {
                deliveryTimeText.textContent = 'Leveranstid: ' + deliveryTime;
            }

            // Açıklama
            setHTML('product-description', p.description || '');

            // Akordiyon içerikleri
            if (p.product_info && p.product_info.trim()) {
                setHTML('product-specs', '<div class="specs-content-placeholder">' + p.product_info.split('\n').join('<br>') + '</div>');
            } else {
                setHTML('product-specs', '<div class="specs-content-placeholder"><p>Material, skötselråd och övrig produktinformation visas här.</p></div>');
            }

            if (p.delivery_return && p.delivery_return.trim()) {
                setHTML('product-delivery', '<div class="delivery-content-placeholder">' + p.delivery_return.split('\n').join('<br>') + '</div>');
            } else {
                setHTML('product-delivery', 
                    '<div class="delivery-content-placeholder">' +
                    '<p><strong>Leveranstid:</strong> ' + deliveryTime + '</p>' +
                    '<p><strong>Frakt:</strong> Fri frakt vid köp över 500 SEK</p>' +
                    '<p><strong>Retur:</strong> 30 dagars öppet köp</p>' +
                    '</div>'
                );
            }

            // Tooltip
            setupSizeTooltip(p.size_tooltip || '', variants);

            // Görsel galeri
            currentImages = p.images || [];
            console.log(currentImages.length + ' gorsel bulundu');

            if (currentImages.length > 0) {
                if (isMobile) renderMobileGallery();
                else renderDesktopGallery();
            }

            // Varyasyonlar
                         console.log('=== RENK DEBUG ===');
            console.log('p.colors:', p.colors);
            console.log('typeof p.colors:', typeof p.colors);
            console.log('Array.isArray(p.colors):', Array.isArray(p.colors));
            renderColorOptions(p.colors || []);
            currentVariants = variants || [];
            if (currentVariants.length > 0) {
                currentVariants.sort(function(a, b) {
                    const priceA = parseFloat(a.discount_price) > 0 ? parseFloat(a.discount_price) : (parseFloat(a.price) || 999999);
                    const priceB = parseFloat(b.discount_price) > 0 ? parseFloat(b.discount_price) : (parseFloat(b.price) || 999999);
                    return priceA - priceB;
                });
                setupVariantAccordion();
                renderVariantDrawer();
                selectVariant(0);
            } else {
                const el = document.getElementById('variant-accordion-wrapper');
                if (el) el.style.display = 'none';
            }

            // Lightbox
            if (!isMobile) setupLightbox();

            // Akordiyonlar
            setupAccordions();

            // Sepete ekle ve favori
            setupAddToCart(p);
            setupWishlistButton(p);

            console.log("Urun sayfasi yuklendi:", p.name);

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
    // TOOLTIP
    // ==========================================

    function setupSizeTooltip(tooltipText, variants) {
        const container = document.getElementById('tooltip-container');
        const popupBox = container ? container.querySelector('.tooltip-popup-box') : null;
        const body = document.getElementById('tooltip-body');
        
        if (!container || !popupBox || !body) {
            console.warn('Tooltip elementleri bulunamadi:', {container, popupBox, body});
            return;
        }

        // Tooltip içeriğini oluştur
        let html = '';
        
        if (tooltipText && tooltipText.trim()) {
            html = tooltipText.split('\n').map(line => {
                if (line.trim()) {
                    return `<p style="margin-bottom:8px;font-size:13px;color:#333;line-height:1.5;">${line.trim()}</p>`;
                }
                return '';
            }).join('');
        } else if (variants && variants.length > 0) {
            html = '<table style="width:100%;font-size:13px;border-collapse:collapse;">' +
                   '<thead><tr style="border-bottom:2px solid #ddd;">' +
                   '<th style="text-align:left;padding:8px;font-weight:600;">Storlek</th>' +
                   '<th style="text-align:left;padding:8px;font-weight:600;">Pris</th>' +
                   '<th style="text-align:left;padding:8px;font-weight:600;">Lager</th>' +
                   '</tr></thead><tbody>';
            
            variants.forEach(v => {
                const price = v.discount_price && parseFloat(v.discount_price) > 0 
                    ? v.discount_price 
                    : (v.price || 0);
                const stockText = v.stock > 0 ? `${v.stock} st` : 'Slut i lager';
                const stockColor = v.stock > 0 ? '#22c55e' : '#e54d42';
                html += `<tr style="border-bottom:1px solid #eee;">` +
                        `<td style="padding:8px;">${v.size || '-'}</td>` +
                        `<td style="padding:8px;font-weight:600;">${parseFloat(price).toLocaleString('sv-SE')} SEK</td>` +
                        `<td style="padding:8px;color:${stockColor};">${stockText}</td>` +
                        `</tr>`;
            });
            
            html += '</tbody></table>';
        } else {
            html = '<p style="font-size:13px;color:#666;">Ingen måttinformation tillgänglig.</p>';
        }

        body.innerHTML = html;

        // Toggle span'ı bul ve event ekle
        const toggleSpan = container.querySelector('.tooltip-toggle-span');
        
        if (toggleSpan) {
            toggleSpan.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const isActive = popupBox.classList.contains('active');
                
                // Önce tüm tooltip popup'ları kapat
                document.querySelectorAll('.tooltip-popup-box.active').forEach(box => {
                    box.classList.remove('active');
                });
                
                // Bunu aç veya kapat
                if (!isActive) {
                    popupBox.classList.add('active');
                }
                
                console.log('Tooltip popup durum:', !isActive);
            });
        }

        // Kapat butonu
        const closeBtn = container.querySelector('.tooltip-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                popupBox.classList.remove('active');
            });
        }

        // Dışarı tıklayınca kapat
        document.addEventListener('click', function(e) {
            if (popupBox.classList.contains('active') && !container.contains(e.target)) {
                popupBox.classList.remove('active');
            }
        });
    }

        // ==========================================
    // RENK SEÇİMİ
    // ==========================================

    function renderColorOptions(colors) {
        const wrapper = document.getElementById('product-colors-wrapper');
        const list = document.getElementById('product-colors-list');
        
        if (!wrapper || !list) return;
        
        if (!colors || colors.length === 0) {
            wrapper.style.display = 'none';
            return;
        }
        
        let html = '';
        colors.forEach((color, index) => {
            const colorStyle = getColorStyle(color);
            const isFirst = index === 0;
            html += `
                <div class="color-option ${isFirst ? 'selected' : ''}" 
                     data-color="${color}"
                     title="${color}"
                     style="background: ${colorStyle};">
                </div>
            `;
        });
        
         list.innerHTML = html;
           wrapper.style.display = 'block';

          // Click event'leri - TEK SEFERLİK
          list.querySelectorAll('.color-option').forEach(opt => {
          opt.addEventListener('click', function() {
          list.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
          this.classList.add('selected');
          console.log('Renk seçildi:', this.dataset.color);
        
          // Seçilen rengi currentProduct'a kaydet (sepete ekleme için)
          currentProduct.selectedColor = this.dataset.color;
        });
     });
        
        // Click event'leri
        list.querySelectorAll('.color-option').forEach(opt => {
            opt.addEventListener('click', function() {
                list.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
                this.classList.add('selected');
                console.log('Renk seçildi:', this.dataset.color);
            });
        });
    }

    function getColorStyle(colorName) {
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
            'grå': '#9E9E9E', 'gra': '#9E9E9E', 'grey': '#9E9E9E',
            'brun': '#5D4037', 'brown': '#5D4037',
            'beige': '#D7CCC8',
            'turkos': '#00BCD4', 'turquoise': '#00BCD4',
            'guld': '#FFD700', 'gold': '#FFD700',
            'silver': '#C0C0C0',
            'transparent': 'rgba(200,200,200,0.3)'
        };
        
        if (!colorName) return '#ccc';
        const normalized = colorName.toLowerCase().trim();
        if (COLOR_MAP[normalized]) return COLOR_MAP[normalized];
        if (/^#[0-9A-F]{6}$/i.test(normalized)) return normalized;
        return '#ccc';
    }

    

    // ==========================================
    // AKORDIYONLAR
    // ==========================================

    function setupAccordions() {
        const accordionItems = document.querySelectorAll('.product-accordion-item');
        
        if (accordionItems.length === 0) {
            console.warn('Akordiyon elementleri bulunamadi');
            return;
        }
        
        accordionItems.forEach(item => {
            const header = item.querySelector('.product-accordion-header');
            const content = item.querySelector('.product-accordion-content');
            
            if (!header || !content) return;
            
            // Başlangıçta kapalı
            content.style.maxHeight = '0px';
            content.style.overflow = 'hidden';
            content.style.transition = 'max-height 0.35s ease, padding 0.35s ease';
            
            header.addEventListener('click', function() {
                const isOpen = item.classList.contains('open');
                
                // Tümünü kapat (tekli açma)
                accordionItems.forEach(other => {
                    other.classList.remove('open');
                    const otherContent = other.querySelector('.product-accordion-content');
                    if (otherContent) {
                        otherContent.style.maxHeight = '0px';
                        otherContent.style.paddingBottom = '0';
                    }
                    const otherIcon = other.querySelector('.product-accordion-header i');
                    if (otherIcon) otherIcon.style.transform = 'rotate(0deg)';
                });
                
                if (!isOpen) {
                    item.classList.add('open');
                    content.style.maxHeight = content.scrollHeight + 50 + 'px';
                    content.style.paddingBottom = '20px';
                    const icon = header.querySelector('i');
                    if (icon) icon.style.transform = 'rotate(180deg)';
                }
            });
        });
    }

    // ==========================================
    // URUN ALT BASLIK
    // ==========================================

    function updateProductSubtitle(variant) {
        const subtitleEl = document.getElementById('dynamic-product-subtitle');
        if (!subtitleEl || !variant) return;
        
        const sizeText = variant.size || '';
        
        // Sadece ölçü göster, fiyat zaten büyük yazıyor üstte
        if (sizeText) {
            subtitleEl.innerHTML = `
                <span class="selected-size-display" style="font-size:14px;color:#666;font-weight:500;">
                    Vald storlek: ${sizeText}
                </span>
            `;
        } else {
            subtitleEl.innerHTML = `
                <span class="selected-size-display" style="font-size:14px;color:#666;font-weight:500;">
                    Välj storlek
                </span>
            `;
        }
    }

    // ==========================================
    // WISHLIST
    // ==========================================

    function setupWishlistButton(product) {
        const btn = document.querySelector('.ana-urun-favori-buton');
        if (!btn) return;

        const productId = product.id;
        updateWishlistButtonState(btn, productId);

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            let wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
            const index = wishlist.findIndex(item => 
                (typeof item === 'string' ? item : String(item.id)) === String(productId)
            );

            if (index > -1) {
                wishlist.splice(index, 1);
                console.log('Favorilerden kaldirildi:', product.name);
            } else {
                wishlist.push({
                    id: product.id,
                    name: product.name,
                    price: getDisplayPrice(currentProduct, selectedVariant),
                    image: currentImages.length > 0 ? currentImages[0] : ''
                });
                console.log('Favorilere eklendi:', product.name);
            }

            localStorage.setItem('wishlistItems', JSON.stringify(wishlist));
            updateWishlistButtonState(btn, productId);

            if (typeof updateWishlistBadge === 'function') {
                updateWishlistBadge();
            }
        });
    }

    function updateWishlistButtonState(btn, productId) {
        const wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
        const isWishlisted = wishlist.some(item => 
            (typeof item === 'string' ? item : String(item.id)) === String(productId)
        );

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
    // GALERI
    // ==========================================

    function renderDesktopGallery() {
        const container = document.getElementById('desktop-gallery');
        const thumbContainer = document.getElementById('gallery-thumbnail-list');
        const mobileGallery = document.getElementById('mobile-gallery');

        if (container) container.style.display = 'flex';
        if (thumbContainer) thumbContainer.style.display = 'flex';
        if (mobileGallery) mobileGallery.style.display = 'none';

        if (!container) return;

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
    // LIGHTBOX
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
        startPan({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => e.preventDefault() });
    }

    function handleTouchMovePan(e) {
        if (!isPanning || !isZoomed) return;
        const touch = e.touches[0];
        movePan({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => e.preventDefault() });
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
            const variantHasDiscount = hasDiscount(currentProduct, variant);

            html += `
                <div class="variant-drawer-item ${isSelected ? 'selected' : ''}" 
                     data-index="${index}" onclick="selectVariant(${index})">
                    <div class="variant-drawer-image">
                        <img src="${mainImage}" alt="${productName} ${variant.size}">
                    </div>
                    <div class="variant-drawer-info">
                        <span class="variant-size">${variant.size}</span>
                        <span class="variant-price">
                            ${variantHasDiscount ? '<span style="text-decoration:line-through;color:#999;font-size:12px;margin-right:4px;">' + originalPrice.toLocaleString('sv-SE') + ' SEK</span>' : ''}
                            <span style="${variantHasDiscount ? 'color:#e54d42;' : ''}">${displayPrice.toLocaleString('sv-SE')} SEK</span>
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
        
        closeVariantDrawer();
        
        document.querySelectorAll('.variant-drawer-item').forEach((item, i) => {
            item.classList.toggle('selected', i === index);
            const icon = item.querySelector('.variant-check i');
            if (icon) icon.className = i === index ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle';
        });

        const display = document.getElementById('selected-variant-display');
        if (display && selectedVariant) {
            display.textContent = selectedVariant.size;
        }
        
        const status = document.getElementById('variant-status');
        if (status) {
            status.style.display = 'inline';
            status.textContent = 'Vald';
        }
        
        const accordionSubtitle = document.querySelector('.accordion-subtitle');
        if (accordionSubtitle && selectedVariant) {
            accordionSubtitle.textContent = selectedVariant.size;
        }
        
                 // FİYAT GÜNCELLEME - Ürün seviyesi indirimi koru
        const priceEl = document.getElementById('product-price');
        if (priceEl && selectedVariant) {
            const productBasePrice = parseFloat(currentProduct?.base_price) || 0;
            const productDiscountPrice = (currentProduct?.discount_price !== null && currentProduct?.discount_price !== undefined && currentProduct?.discount_price !== '')
                ? parseFloat(currentProduct.discount_price)
                : 0;
            const productHasDiscount = productDiscountPrice > 0 && productDiscountPrice < productBasePrice;
            
            const variantPrice = parseFloat(selectedVariant?.price) || 0;
            const variantDiscountPrice = (selectedVariant?.discount_price !== null && selectedVariant?.discount_price !== undefined && selectedVariant?.discount_price !== '')
                ? parseFloat(selectedVariant.discount_price)
                : 0;
            const variantHasDiscount = variantDiscountPrice > 0 && variantDiscountPrice < variantPrice;
            
            let originalPrice, displayPrice, hasDiscountFlag;
            
            if (variantHasDiscount) {
                // Variant indirimi öncelikli
                originalPrice = variantPrice;
                displayPrice = variantDiscountPrice;
                hasDiscountFlag = true;
            } else if (productHasDiscount) {
                // Ürün indirimi
                originalPrice = productBasePrice;
                displayPrice = productDiscountPrice;
                hasDiscountFlag = true;
            } else {
                // İndirim yok
                originalPrice = variantPrice > 0 ? variantPrice : productBasePrice;
                displayPrice = originalPrice;
                hasDiscountFlag = false;
            }
            
            console.log('Fiyat güncelleme:', {originalPrice, displayPrice, hasDiscountFlag, productHasDiscount, variantHasDiscount});
            
            if (hasDiscountFlag) {
                priceEl.innerHTML = 
                    '<span style="text-decoration:line-through;color:#999;font-size:18px;margin-right:8px;">' + 
                    originalPrice.toLocaleString('sv-SE') + ' SEK</span>' +
                    '<span style="color:#e54d42;font-size:24px;font-weight:bold;">' + 
                    displayPrice.toLocaleString('sv-SE') + ' SEK</span>';
            } else {
                priceEl.innerHTML = '<span style="font-size:24px;font-weight:bold;">' + 
                    displayPrice.toLocaleString('sv-SE') + " SEK</span>";
            }
        }
      
        
        // Ürün alt başlığını güncelle
        updateProductSubtitle(selectedVariant);
        
        console.log('Varyant seçildi:', selectedVariant.size, 'Fiyat:', getDisplayPrice(currentProduct, selectedVariant));
    };

    // ==========================================
    // SEPETE EKLE
    // ==========================================

    function setupAddToCart(product) {
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
              name: product.name,
              price: getDisplayPrice(currentProduct, selectedVariant),
              image: currentImages.length > 0 ? currentImages[0] : '',
              variants: selectedVariant.size,
              color: currentProduct.selectedColor || '',  // <-- BUNU EKLE
              delivery: product.delivery_time || '3-7 arbetsdagar',
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

            if (typeof updateCartBadge === 'function') {
                updateCartBadge();
            }

            if (typeof openMiniCart === 'function') {
                openMiniCart();
            }

            console.log('Sepete eklendi:', product.name, selectedVariant.size);
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
