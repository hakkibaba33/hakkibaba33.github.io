// ==========================================
// PRODUCT.UI.JS - Çoklu Görsel + Varyasyon Drawer
// ==========================================

if (window.__productPageInitialized) {
    console.log("⚠️ product.ui.js zaten çalıştırılmış, atlanıyor.");
} else {
    window.__productPageInitialized = true;

    // Global state
    let currentProduct = null;
    let currentImages = [];
    let currentVariants = [];
    let selectedVariant = null;
    let selectedImageIndex = 0;

    async function initProductPage() {
        console.log("🚀 Ürün sayfası init başlıyor...");

        // Slug al
        let slug = null;
        const urlParams = new URLSearchParams(window.location.search);
        slug = urlParams.get('slug');
        
        if (!slug) {
            const pathParts = window.location.pathname.split('/').filter(p => p);
            slug = pathParts[pathParts.length - 1];
        }

        if (!slug || slug === 'product.html') {
            console.error("❌ Slug bulunamadı!");
            return;
        }
        
        console.log("✅ Slug:", slug);

        // Airtable'dan veri çek
        const url = `https://api.airtable.com/v0/${CONFIG.AIRTABLE.BASE_ID}/${CONFIG.AIRTABLE.TABLE_NAME}?filterByFormula=Slug='${slug}'`;

        try {
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${CONFIG.AIRTABLE.API_KEY}` }
            });
            const result = await response.json();

            if (!result.records || result.records.length === 0) {
                console.error("❌ Ürün bulunamadı!");
                return;
            }

            currentProduct = result.records[0];
            const f = currentProduct.fields;

            // ==========================================
            // 1. TEMEL BİLGİLERİ YERLEŞTİR
            // ==========================================
            setText('page-title-product-name', f.Name);
            setText('breadcrumb-product-name', f.Name);
            setText('product-main-name-desktop', f.Name);
            setText('product-price', (f.Price || 0) + " SEK");
            setHTML('product-description', f.Description || '');

            // ==========================================
            // 2. ÇOKLU GÖRSEL GALERİSİ
            // ==========================================
            currentImages = f.imageURL || [];
            console.log(`📸 ${currentImages.length} görsel bulundu`);

            if (currentImages.length > 0) {
                renderGallery();
            }

            // ==========================================
            // 3. VARYASYONLARI PARSE ET & RENDER ET
            // ==========================================
            currentVariants = parseVariants(f.Variants);
            console.log(`🎨 ${currentVariants.length} varyasyon bulundu:`, currentVariants);

            if (currentVariants.length > 0) {
                setupVariantAccordion();
                renderVariantDrawer();
            } else {
                // Varyasyon yoksa akordiyonu gizle
                const accordion = document.getElementById('variant-accordion-wrapper');
                if (accordion) accordion.style.display = 'none';
            }

            // ==========================================
            // 4. SEPETE EKLE BUTONU
            // ==========================================
            setupAddToCart(f);

            console.log("✅ Ürün sayfası yüklendi:", f.Name);

        } catch (error) {
            console.error("❌ Hata:", error);
        }
    }

    // ==========================================
    // YARDIMCI FONKSİYONLAR
    // ==========================================

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.innerText = text || '---';
    }

    function setHTML(id, html) {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = '';
            el.innerHTML = html || '';
        }
    }

    // ==========================================
    // GALERİ RENDER
    // ==========================================

    function renderGallery() {
        const container = document.getElementById('product-images-container');
        const thumbContainer = document.getElementById('gallery-thumbnail-list');
        
        if (!container) return;

        // 2 büyük resim yan yana (ilk 2 görsel)
        let mainHTML = '';
        const displayCount = Math.min(2, currentImages.length);
        
        for (let i = 0; i < displayCount; i++) {
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

        // Thumbnail'lar (tüm görseller)
        if (thumbContainer) {
            let thumbHTML = '';
            currentImages.forEach((img, i) => {
                thumbHTML += `
                    <img src="${img.url}" 
                         alt="thumb-${i+1}" 
                         class="thumbnail-item ${i === 0 ? 'selected' : ''}"
                         data-index="${i}"
                         onclick="selectMainImage(${i})">
                `;
            });
            thumbContainer.innerHTML = thumbHTML;
        }
    }

    // Thumbnail tıklama — ana görseli değiştir
    window.selectMainImage = function(index) {
        selectedImageIndex = index;
        
        // Thumbnail active state güncelle
        document.querySelectorAll('.thumbnail-item').forEach((thumb, i) => {
            thumb.classList.toggle('selected', i === index);
        });

        // Eğer 2'den fazla görsel varsa, ana display'i güncelle
        if (currentImages.length > 2) {
            const columns = document.querySelectorAll('.main-image-column');
            // İlk 2 sütunu güncelle (döngüsel)
            columns.forEach((col, i) => {
                const imgIndex = (index + i) % currentImages.length;
                const img = col.querySelector('img');
                if (img) {
                    img.src = currentImages[imgIndex].url;
                    img.setAttribute('data-index', imgIndex);
                }
            });
        }
    };

    // Lightbox aç (basit versiyon)
    window.openLightbox = function(index) {
        // Şimdilik basit — istersen sonra özel lightbox ekleriz
        console.log('Lightbox açıldı, görsel:', index);
    };

    // ==========================================
    // VARYASYON PARSE
    // ==========================================

    function parseVariants(variantsText) {
        if (!variantsText) return [];
        
        // Örnek: "150x230.cm ( + 7 storlekar )" veya "80x150, 120x180, 160x230"
        // Farklı formatları destekle
        
        const text = variantsText.toString().trim();
        
        // Format 1: "150x230.cm ( + 7 storlekar )" → tek ölçü, ekstra bilgi
        // Format 2: "80x150, 120x180, 160x230" → virgülle ayrılmış liste
        // Format 3: Her satırda bir ölçü (multilineText)
        
        // Önce satır satır böl
        const lines = text.split('\n').filter(l => l.trim());
        
        if (lines.length > 1) {
            // Her satır bir varyasyon
            return lines.map(line => ({
                size: line.trim(),
                label: line.trim(),
                price: null // Airtable'da ayrı fiyat yok
            }));
        }
        
        // Tek satır — virgülle ayrılmış olabilir
        const parts = text.split(',').map(p => p.trim()).filter(p => p);
        
        if (parts.length > 1) {
            return parts.map(part => ({
                size: part,
                label: part,
                price: null
            }));
        }
        
        // Tek varyasyon
        return [{
            size: text,
            label: text,
            price: null
        }];
    }

    // ==========================================
    // VARYASYON AKORDİYONU
    // ==========================================

    function setupVariantAccordion() {
        const btn = document.getElementById('variant-accordion-btn');
        if (!btn) return;

        // Önceki listener'ları temizle
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openVariantDrawer();
        });
    }

    // ==========================================
    // VARYASYON DRAWER (Sağdan Açılan)
    // ==========================================

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

        // Ana ürün görseli (ilk görseli varyasyon kartlarında kullan)
        const mainImage = currentImages.length > 0 ? currentImages[0].url : '';
        const productName = currentProduct.fields.Name;

        let html = '';
        currentVariants.forEach((variant, index) => {
            const isSelected = selectedVariant && selectedVariant.size === variant.size;
            
            html += `
                <div class="variant-drawer-item ${isSelected ? 'selected' : ''}" 
                     data-index="${index}"
                     onclick="selectVariant(${index})">
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

        // Kapatma butonu
        const closeBtn = document.getElementById('close-variant-drawer');
        if (closeBtn) {
            closeBtn.onclick = closeVariantDrawer;
        }

        // Overlay'a tıklayınca kapat
        const overlay = document.getElementById('variant-drawer-overlay');
        if (overlay) {
            overlay.onclick = (e) => {
                if (e.target === overlay) closeVariantDrawer();
            };
        }
    }

    window.selectVariant = function(index) {
        selectedVariant = currentVariants[index];
        
        // UI güncelle
        document.querySelectorAll('.variant-drawer-item').forEach((item, i) => {
            item.classList.toggle('selected', i === index);
            const checkIcon = item.querySelector('.variant-check i');
            if (checkIcon) {
                checkIcon.className = i === index ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle';
            }
        });

        // Akordiyonu güncelle
        const display = document.getElementById('selected-variant-display');
        const status = document.getElementById('variant-status');
        
        if (display) display.innerText = selectedVariant.label;
        if (status) status.style.display = 'inline-flex';

        // Drawer'ı kapat (küçük gecikmeyle, animasyon için)
        setTimeout(closeVariantDrawer, 300);
    };

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
                // Fallback
                const cartItem = {
                    id: currentProduct.id,
                    name: fields.Name,
                    price: parseFloat(fields.Price) || 0,
                    image: currentImages.length > 0 ? currentImages[0].url : '',
                    variants: variantInfo,
                    delivery: fields.Delivery_time || '',
                    quantity: 1
                };

                let cart = JSON.parse(localStorage.getItem('siteCartItems')) || [];
                const existing = cart.find(i => i.id === currentProduct.id);
                if (existing) {
                    existing.quantity = (existing.quantity || 1) + 1;
                } else {
                    cart.push(cartItem);
                }
                localStorage.setItem('siteCartItems', JSON.stringify(cart));

                if (typeof updateMiniCartUI === 'function') updateMiniCartUI();
                if (typeof updateCartBadge === 'function') updateCartBadge();
                if (typeof openMiniCart === 'function') openMiniCart();
            }
        });
    }

    // ==========================================
    // BAŞLAT
    // ==========================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProductPage);
    } else {
        initProductPage();
    }
}