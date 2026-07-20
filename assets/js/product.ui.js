// ==========================================
// PRODUCT.UI.JS - SUPABASE UYUMLU (v5.1)
// FIX: Inline CSS'ler temizlendi
// FIX: Fiyat sıralaması: indirimli önce, orijinal sonra
// NEW: Skeleton loader desteği eklendi
// NEW: M2 / Basit ürünler için fiyat ve subtitle fix
// ==========================================

if (window.__productPageInitialized) {
    console.log("product.ui.js zaten calistirilmis, atlaniyor.");
} else {
    window.__productPageInitialized = true;

    let currentProduct = null;
    let currentImages = [];
    let currentVariants = [];
    let currentFilteredVariants = [];
    let selectedVariant = null;
    let selectedColor = null;
    let selectedImageIndex = 0;
    let isZoomed = false;
    let isMobile = window.innerWidth <= 768;

    let touchStartX = 0;
    let touchCurrentX = 0;
    let isDragging = false;

    const SUPABASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE) ? CONFIG.SUPABASE.URL : '';
    const SUPABASE_KEY = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE) ? CONFIG.SUPABASE.ANON_KEY : '';

    async function supabaseGet(endpoint, params, options) {
        const url = new URL(SUPABASE_URL + '/rest/v1/' + endpoint);
        if (params) {
            Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        }

        const headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json'
        };

        if (options && options.limit) {
            headers['Range'] = '0-' + (options.limit - 1);
            headers['Prefer'] = 'count=exact';
        }

        const res = await fetch(url, { headers });
        if (!res.ok) {
            const errText = await res.text();
            console.error('Supabase hata detayi:', errText);
            throw new Error('Supabase GET hatasi: ' + res.status);
        }
        return res.json();
    }

    const COLOR_MAP = {
        'rod': '#D32F2F', 'roed': '#D32F2F', 'röd': '#D32F2F', 'red': '#D32F2F',
        'bla': '#1976D2', 'blaa': '#1976D2', 'blå': '#1976D2', 'blue': '#1976D2',
        'gron': '#388E3C', 'groen': '#388E3C', 'grön': '#388E3C', 'green': '#388E3C',
        'gul': '#FBC02D', 'yellow': '#FBC02D',
        'orange': '#F57C00',
        'rosa': '#E91E63', 'pink': '#E91E63',
        'lila': '#7B1FA2', 'purple': '#7B1FA2',
        'svart': '#212121', 'black': '#212121',
        'vit': '#FAFAFA', 'white': '#FAFAFA',
        'graa': '#9E9E9E', 'grå': '#9E9E9E', 'gra': '#9E9E9E', 'grey': '#9E9E9E', 'gray': '#9E9E9E',
        'brun': '#5D4037', 'brown': '#5D4037',
        'beige': '#D7CCC8',
        'turkos': '#00BCD4', 'turquoise': '#00BCD4',
        'guld': '#FFD700', 'gold': '#FFD700',
        'silver': '#C0C0C0',
        'bronze': '#CD7F32', 'brons': '#CD7F32',
        'krem': '#FFF8E1', 'cream': '#FFF8E1',
        'oliv': '#556B2F', 'olive': '#556B2F',
        'marin': '#1A237E', 'navy': '#1A237E', 'marinblaa': '#1A237E', 'marinblå': '#1A237E',
        'mint': '#98FF98',
        'korall': '#FF7F50', 'coral': '#FF7F50',
        'vinrod': '#722F37', 'vinröd': '#722F37', 'bordo': '#722F37', 'burgundy': '#722F37',
        'taupe': '#483C32',
        'mullvad': '#8B7355',
        'flerfargad': 'linear-gradient(135deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4)', 
        'flerfaergad': 'linear-gradient(135deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4)',
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

    function renderColorSwatches(variants) {
        const container = document.getElementById('color-selector');
        const swatchesContainer = document.getElementById('color-swatches');
        if (!container || !swatchesContainer) return;

        const colorMap = new Map();
        variants.forEach(v => {
            if (v.color && !colorMap.has(v.color)) {
                colorMap.set(v.color, {
                    color: v.color,
                    hex: v.color_hex || getColorStyle(v.color),
                    image: v.variant_image || (currentImages.length > 0 ? currentImages[0] : '')
                });
            }
        });

        const colors = Array.from(colorMap.values());
        if (colors.length === 0) {
            container.style.display = 'none';
            return;
        }

        const colorNameEl = document.getElementById('selected-color-name');
        if (colorNameEl) colorNameEl.textContent = colors[0].color;

        swatchesContainer.innerHTML = colors.map((c, i) => `
            <button type="button" 
                    class="color-swatch-btn ${i === 0 ? 'active' : ''}" 
                    data-color="${c.color}"
                    data-hex="${c.hex}"
                    data-image="${c.image}">
                <div class="color-swatch-inner" data-bg="${c.hex}"></div>
            </button>
        `).join('');

        container.classList.add('active');

        swatchesContainer.querySelectorAll('.color-swatch-btn').forEach(btn => {
            const inner = btn.querySelector('.color-swatch-inner');
            if (inner) inner.style.background = btn.dataset.hex;

            btn.addEventListener('click', () => {
                swatchesContainer.querySelectorAll('.color-swatch-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const color = btn.dataset.color;
                if (colorNameEl) colorNameEl.textContent = color;
                const preview = document.getElementById('dropdown-color-preview');
                if (preview) {
                    preview.style.background = btn.dataset.hex;
                    preview.classList.add('visible');
                }
                filterVariantsByColor(color);
            });
        });

        if (colors.length > 0) {
            selectedColor = colors[0].color;
            filterVariantsByColor(colors[0].color, true);
        }
    }

    function filterVariantsByColor(color, autoSelect = false) {
        selectedColor = color;
        if (!currentVariants) return;
        const colorVariants = currentVariants.filter(v => v.color === color);
        currentFilteredVariants = colorVariants;
        renderVariantDrawerFiltered(colorVariants);
        if (colorVariants.length > 0) {
            selectVariantFromFiltered(0, false);
        } else {
            selectedVariant = null;
            updateAccordionDisplay();
            const stockInfo = document.getElementById('stock-info');
            if (stockInfo) stockInfo.classList.remove('active');
        }
    }

    async function redirectFromIdToSlug(productId) {
        try {
            const products = await supabaseGet('products', {
                id: 'eq.' + productId,
                select: 'slug'
            });
            if (products.length > 0 && products[0].slug) {
                window.location.replace('/produkt/' + products[0].slug);
            } else {
                window.location.href = '/404.html';
            }
        } catch (e) {
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
    // SKELETON HELPER FUNCTIONS
    // ==========================================
    function hideAllSkeletons() {
        document.querySelectorAll('.skeleton, .skeleton-gallery-grid, .skeleton-slide, .skeleton-card-wrapper, .skeleton-swatches-row').forEach(el => {
            el.style.display = 'none';
        });
    }

    async function initProductPage() {
        let slug = null;
        const path = window.location.pathname;
        const parts = path.split('/').filter(p => p);
        const urlParams = new URLSearchParams(window.location.search);

        if (parts.length >= 2 && parts[0] === 'produkt') {
            slug = parts[1];
            if (slug === 'index.html') slug = null;
        }

        if (!slug) {
            const slugParam = urlParams.get('slug');
            if (slugParam) slug = slugParam;
        }

        if (!slug) {
            const idParam = urlParams.get('id');
            if (idParam) {
                await redirectFromIdToSlug(idParam);
                return;
            }
        }

        if (!slug) {
            hideAllSkeletons();
            document.querySelector('.product-page').innerHTML = 
                '<p style="text-align:center;padding:60px;">Produkt hittades inte. <a href="/">Tillbaka till startsidan</a></p>';
            return;
        }

        try {
            const products = await supabaseGet('products', {
                slug: 'eq.' + slug,
                select: '*'
            });

            if (products.length === 0) {
                hideAllSkeletons();
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

            setText('page-title-product-name', f.Name);
            setText('breadcrumb-product-name', f.Name);
            setText('product-main-name-desktop', f.Name);

            const sizeDisplayEl = document.getElementById('selected-size-display-desktop');
            const sizeValueEl = document.getElementById('selected-size-value');
            if (sizeDisplayEl) sizeDisplayEl.style.display = 'none';
            if (sizeValueEl) sizeValueEl.textContent = '---';

            setHTML('product-description', f.Description || '');
            setText('delivery-time-display', f.Delivery_time);
            setText('delivery-time-text', 'Leveranstid: ' + f.Delivery_time);

            setHTML('product-specs', f.Product_info ? '<div class="specs-content-placeholder">' + f.Product_info.split('\n').join('<br>') + '</div>' : '<div class="specs-content-placeholder"><p>Material, skötselråd och övrig produktinformation visas här.</p></div>');

            setHTML('product-delivery', f.Delivery_return ? '<div class="delivery-content-placeholder">' + f.Delivery_return.split('\n').join('<br>') + '</div>' : '<div class="delivery-content-placeholder"><p><strong>Leveranstid:</strong> <span id="delivery-time-display">' + f.Delivery_time + '</span></p><p><strong>Frakt:</strong> Fri frakt vid köp över 500 Kr</p><p><strong>Retur:</strong> 30 dagars öppet köp</p></div>');

            if (typeof setupSizeDrawer === 'function') setupSizeDrawer(f.Size_tooltip, f.Variants);

            currentImages = p.images || [];

            if (currentImages.length > 0) {
                if (isMobile) renderMobileGallery();
                else renderDesktopGallery();
            }

            currentVariants = f.Variants;
            if (currentVariants.length > 0) {
                currentVariants.sort(function(a, b) {
                    var priceA = a.discount_price || a.price || 999999;
                    var priceB = b.discount_price || b.price || 999999;
                    return priceA - priceB;
                });
                renderColorSwatches(currentVariants);
                setupVariantAccordion();
               
            } else {
                const colorEl = document.getElementById('color-selector');
                if (colorEl) colorEl.style.display = 'none';
                const accordionEl = document.getElementById('variant-accordion-wrapper');
                if (accordionEl) accordionEl.style.display = 'none';
            }

            if (!isMobile && typeof setupLightbox === 'function') setupLightbox();

            // ==========================================
            // ✅ M2 / BASIT / GARDIN URUNLER ICIN FIYAT VE SUBTITLE FIX
            // ==========================================
            const isM2Product = currentProduct.product_type === 'm2_calculator' || currentProduct.m2_calculator_active === true;
            const isGardinProduct = currentProduct.gardin_calculator_active === true;

            if (currentVariants.length === 0) {
                const priceEl = document.getElementById('product-price');
                const hasDiscount = p.discount_price && p.discount_price < p.base_price;
                const displayPrice = p.discount_price || p.base_price || 0;
                const basePrice = p.base_price || 0;

                if (priceEl) {
                    if (hasDiscount) {
                     priceEl.innerHTML = 
                    '<span class="discount-price">' + displayPrice.toLocaleString('sv-SE') + ' Kr</span>' +
                    '<span class="original-price">' + basePrice.toLocaleString('sv-SE') + ' Kr</span>';
                  } else {
                  priceEl.innerHTML = '<span class="normal-price">' + displayPrice.toLocaleString('sv-SE') + ' Kr</span>';
                  }
                }

                const subtitleEl = document.getElementById('dynamic-product-subtitle');
                if (subtitleEl) {
                    const sizeDisplay = subtitleEl.querySelector('.selected-size-display');
                    if (sizeDisplay) {
                        if (isM2Product && p.m2_available_widths && p.m2_available_widths.length > 0) {
                            sizeDisplay.className = 'selected-size-display size-m2';
                            const minWidth = Math.min(...p.m2_available_widths.map(w => parseFloat(w) || 999));
                            sizeDisplay.textContent = 'bredd: ' + minWidth + ' cm';
                        } else if (isGardinProduct && p.gardin_min_width) {
                            sizeDisplay.textContent = ' Min. bredd: ' + p.gardin_min_width + ' cm';
                            sizeDisplay.style.color = '#666';
                        } else {
                            sizeDisplay.textContent = displayPrice > 0 ? displayPrice.toLocaleString('sv-SE') + ' Kr' : '';
                            sizeDisplay.style.color = '#333';
                        }
                    }
                }

                const stockInfo = document.getElementById('stock-info');
                const stockText = stockInfo?.querySelector('.stock-text');
                const stockDot = stockInfo?.querySelector('.stock-dot');
                if (stockInfo && stockText && stockDot) {
                    stockInfo.classList.add('active');
                    stockText.textContent = 'I lager - Klar för leverans';
                    stockText.className = 'stock-text in-stock';
                    stockDot.className = 'stock-dot in-stock';
                }

                const addBtn = document.getElementById('add-to-cart-btn');
                if (addBtn && !isM2Product && !isGardinProduct) {
                    addBtn.disabled = false;
                    addBtn.textContent = 'Lägg i Varukorg';
                    addBtn.style.opacity = '1';
                    addBtn.style.pointerEvents = 'auto';
                }
            }

            // ✅ HESAPLAYICI INIT - Admin panel veri yapısına uygun
            console.log('[ProductUI] Hesaplayıcı kontrolü başlıyor...');
            console.log('[ProductUI] product_type:', currentProduct.product_type);
            console.log('[ProductUI] m2_calculator_active:', currentProduct.m2_calculator_active);
            console.log('[ProductUI] gardin_calculator_active:', currentProduct.gardin_calculator_active);

            if (isM2Product || isGardinProduct) {
                console.log('[ProductUI] Hesaplayıcı ürün tespit edildi!');

                // Varyasyon accordion ve renk seçiciyi gizle
                const variantAccordion = document.getElementById('variant-accordion-wrapper');
                const colorSelector = document.getElementById('color-selector');

                if (variantAccordion) {
                    variantAccordion.style.display = 'none';
                    variantAccordion.classList.add('hidden-by-calculator');
                }
                if (colorSelector) {
                    colorSelector.style.display = 'none';
                    colorSelector.classList.add('hidden-by-calculator');
                }

                // Hesaplayıcıyı göster ve init et
                const calcContainer = document.getElementById('calculator-insertion-point');
                if (calcContainer && typeof ProductCalculator !== 'undefined') {
                    calcContainer.style.display = 'block';

                    // Ürün verisini hesaplayıcıya hazırla (admin panel veri yapısı)
                    const calcProduct = {
                        ...currentProduct,
                        images: currentImages,
                        delivery_time: f.Delivery_time
                    };

                    ProductCalculator.init(calcProduct);
                } else {
                    console.error('[ProductUI] Hesaplayıcı container veya ProductCalculator bulunamadı!');
                }
            } else {
                console.log('[ProductUI] Normal ürün - hesaplayıcı gösterilmiyor');
                const calcContainer = document.getElementById('calculator-insertion-point');
                if (calcContainer) calcContainer.style.display = 'none';
            }

            if (typeof setupAccordions === 'function') setupAccordions();
            if (typeof setupAddToCart === 'function') setupAddToCart(f);
            setupWishlistButton(f);

            // ✅ Tüm skeleton'ları gizle - veri yüklendi
            hideAllSkeletons();

            setTimeout(() => {
                loadRelatedSlider();
            }, 500);

            if (typeof updateProductMetaTags === 'function' && currentProduct) {
            updateProductMetaTags(currentProduct);
          }

        } catch (e) { 
            console.error("Hata:", e);
            hideAllSkeletons();
            document.querySelector('.product-page').innerHTML = 
                '<p style="text-align:center;padding:60px;">Kunde inte ladda produkten. <a href="/">Tillbaka till startsidan</a></p>';
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
// ILGILI URUNLER - KATEGORI KARTI BIREBIR + VARYASYON/RENK (v5.0)
// FIX: Inline CSS'ler temizlendi
// FIX: Fiyat sirasi: indirimli once, orijinal sonra
// FIX: Event listener cakismasi giderildi
// NEW: Skeleton loader desteği
// ==========================================

function getRelatedVariantText(product) {
    const variants = product.product_variants || [];
    if (!variants || variants.length === 0) return '';

    const firstSize = variants[0].size || '';
    const extraCount = variants.length - 1;

    if (variants.length === 1) {
        return `<span class="variant-single">${firstSize}</span>`;
    }
    return `<span class="variant-main">${firstSize}</span><span class="variant-extra-badge">+${extraCount} storlekar</span>`;
}

function getRelatedColorSwatches(product) {
    const variants = product.product_variants || [];
    if (!variants || variants.length === 0) return '';

    const colorSet = new Set();
    variants.forEach(v => {
        if (v.color) colorSet.add(v.color);
    });

    const colors = Array.from(colorSet);
    if (colors.length === 0) return '';

    const swatchesHTML = colors.slice(0, 5).map(color => `
        <span class="swatch-circle" 
              style="background: ${getColorStyle(color)};"
              title="${color}"></span>
    `).join('');

    const extraText = colors.length > 5 
        ? `<span class="color-count-text">+${colors.length - 5} farger</span>` 
        : '';

    return `
        <div class="product-colors-wrapper">
            <div class="product-colors-swatches">
                ${swatchesHTML}
            </div>
            ${extraText}
        </div>
    `;
}

async function loadRelatedSlider() {
    console.log('[Related] Slider yukleniyor...');

    if (!currentProduct || !currentProduct.id) {
        setTimeout(loadRelatedSlider, 1000);
        return;
    }

    // ✅ Skeleton'ları göster - ilgili ürünler yükleniyor
    const section = document.getElementById('related-products-section');
    if (section) {
        section.style.display = '';
        section.classList.add('active');
    }

    try {
        let firstCategory = 'mattor';
        const cats = currentProduct.categories;

        if (cats) {
            if (Array.isArray(cats) && cats.length > 0) {
                firstCategory = cats[0];
            } else if (typeof cats === 'string') {
                try {
                    const parsed = JSON.parse(cats);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        firstCategory = parsed[0];
                    }
                } catch (e) {
                    firstCategory = cats;
                }
            }
        }

        console.log('[Related] Kategori:', firstCategory, 'Urun ID:', currentProduct.id);

        let relatedProducts = await supabaseGet('products', {
            categories: 'cs.{"' + firstCategory + '"}',
            id: 'neq.' + currentProduct.id,
            active: 'eq.true',
            select: '*'
        }, { limit: 8 });

        if (!relatedProducts || relatedProducts.length === 0) {
            console.log('[Related] Ayni kategoriden urun bulunamadi, rastgele cekiliyor...');
            relatedProducts = await supabaseGet('products', {
                id: 'neq.' + currentProduct.id,
                active: 'eq.true',
                select: '*'
            }, { limit: 8 });
        }

        if (!relatedProducts || relatedProducts.length === 0) {
            console.log('[Related] Hic urun bulunamadi');
            if (section) section.style.display = 'none';
            return;
        }

        const productIds = relatedProducts.map(p => p.id);
        let relatedVariants = [];

        if (productIds.length > 0) {
            try {
                const idList = productIds.join(',');
                relatedVariants = await supabaseGet('product_variants', {
                    product_id: 'in.(' + idList + ')',
                    select: '*'
                });
            } catch (e) {
                console.error('[Related] Variants cekme hatasi:', e);
            }
        }

        const enrichedProducts = relatedProducts.map(product => {
            const productVariants = relatedVariants.filter(v => v.product_id === product.id);
            return { ...product, product_variants: productVariants };
        });

        renderRelatedProducts(enrichedProducts);

    } catch (e) {
        console.error('[Related] HATA:', e);
        if (section) section.style.display = 'none';
        const track = document.getElementById('related-slider-track');
        if (track) track.innerHTML = '';
    }
}

function renderRelatedProducts(products) {
    console.log('[Related] Render basliyor, urun sayisi:', products.length);

    const track = document.getElementById('related-slider-track');
    const section = document.getElementById('related-products-section');

    if (!track || !section) {
        console.error('[Related] Elementler bulunamadi!');
        return;
    }

    track.innerHTML = products.map(product => {
        const hasDiscount = product.discount_price && product.discount_price < product.base_price;
        const displayPrice = product.discount_price || product.base_price || 0;
        const basePrice = product.base_price || 0;

        // FIX: Indirimli fiyat ONCE, orijinal fiyat SONRA
        const priceHTML = hasDiscount 
            ? `<span class="current-price price-discount">${displayPrice.toLocaleString('sv-SE')} Kr</span>
               <span class="original-price">${basePrice.toLocaleString('sv-SE')} Kr</span>`
            : `<span class="current-price">${displayPrice.toLocaleString('sv-SE')} Kr</span>`;

        const productUrl = product.slug
            ? '/produkt/' + encodeURIComponent(String(product.slug).trim())
            : '/produkt/index.html?id=' + encodeURIComponent(String(product.id));

        let isWishlisted = false;
        try {
            const wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
            isWishlisted = wishlist.some(item => 
                (typeof item === 'string' ? item : String(item.id)) === String(product.id)
            );
        } catch (e) {}

        const variantText = getRelatedVariantText(product);
        const colorSwatches = getRelatedColorSwatches(product);

        return `
            <div class="product-card" data-id="${String(product.id)}">
                <div class="image-box">
                    <a href="${productUrl}">
                        <img src="${product.images && product.images[0] ? product.images[0] : ''}" 
                             alt="${product.name || 'Urun'}" 
                             loading="lazy"
                             onerror="this.style.display='none'">
                    </a>
                    ${hasDiscount ? '<span class="discount-badge">REA</span>' : ''}
                    <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" 
                            data-product-id="${String(product.id)}"
                            aria-label="Lagg till favoriter">
                        <i class="${isWishlisted ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                    </button>
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.name || 'Urun'}</h3>
                    ${variantText ? `<div class="product-variants-row"><div class="product-variants">${variantText}</div></div>` : ''}
                    <div class="product-price">${priceHTML}</div>
                    ${colorSwatches}
                </div>
            </div>
        `;
    }).join('');

    attachRelatedWishlistEvents();

    section.style.display = '';
    section.classList.add('active');

    setupSliderNavigation();
}

function attachRelatedWishlistEvents() {
    const track = document.getElementById('related-slider-track');
    if (!track) return;

    track.querySelectorAll('.wishlist-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const productId = newBtn.dataset.productId;
            if (!productId) return;

            let wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
            const index = wishlist.findIndex(item => 
                (typeof item === 'string' ? item : String(item.id)) === String(productId)
            );

            if (index > -1) {
                wishlist.splice(index, 1);
                newBtn.classList.remove('active');
                newBtn.querySelector('i').className = 'fa-regular fa-heart';
            } else {
                const card = newBtn.closest('.product-card');
                const name = card.querySelector('.product-title')?.textContent || 'Urun';
                const priceText = card.querySelector('.current-price')?.textContent || '0';
                const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
                const image = card.querySelector('img')?.src || '';

                wishlist.push({ id: productId, name, price, image });
                newBtn.classList.add('active');
                newBtn.querySelector('i').className = 'fa-solid fa-heart';
            }

            localStorage.setItem('wishlistItems', JSON.stringify(wishlist));
            if (typeof updateWishlistBadge === 'function') updateWishlistBadge();
        });
    });
}

let sliderNavInitialized = false;

function setupSliderNavigation() {
    const track = document.getElementById('related-slider-track');
    const prevBtn = document.getElementById('related-prev');
    const nextBtn = document.getElementById('related-next');

    if (!track || !prevBtn || !nextBtn) return;

    if (sliderNavInitialized) {
        updateSliderButtons();
        return;
    }

    sliderNavInitialized = true;

    const getScrollAmount = () => {
        const card = track.querySelector('.product-card');
        if (!card) return 280;
        return card.offsetWidth + 20;
    };

    const updateButtons = () => {
        requestAnimationFrame(() => {
            const scrollLeft = Math.round(track.scrollLeft);
            const maxScroll = Math.round(track.scrollWidth - track.clientWidth);

            prevBtn.disabled = scrollLeft <= 2;
            nextBtn.disabled = scrollLeft >= maxScroll - 2;

            prevBtn.style.opacity = prevBtn.disabled ? '0.35' : '1';
            nextBtn.style.opacity = nextBtn.disabled ? '0.35' : '1';
        });
    };

    prevBtn.onclick = () => {
        track.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' });
    };

    nextBtn.onclick = () => {
        track.scrollBy({ left: getScrollAmount(), behavior: 'smooth' });
    };

    track.removeEventListener('scroll', updateButtons);
    track.addEventListener('scroll', updateButtons, { passive: true });

    window.removeEventListener('resize', updateButtons);
    window.addEventListener('resize', updateButtons);

    setTimeout(updateButtons, 100);
    setTimeout(updateButtons, 500);
}

function updateSliderButtons() {
    const track = document.getElementById('related-slider-track');
    const prevBtn = document.getElementById('related-prev');
    const nextBtn = document.getElementById('related-next');

    if (!track || !prevBtn || !nextBtn) return;

    const scrollLeft = Math.round(track.scrollLeft);
    const maxScroll = Math.round(track.scrollWidth - track.clientWidth);

    prevBtn.disabled = scrollLeft <= 2;
    nextBtn.disabled = scrollLeft >= maxScroll - 2;

    prevBtn.style.opacity = prevBtn.disabled ? '0.35' : '1';
    nextBtn.style.opacity = nextBtn.disabled ? '0.35' : '1';
}

    function setupWishlistButton(fields) {
        const btn = document.querySelector('.ana-urun-favori-buton');
        if (!btn) return;

        const productId = currentProduct.id;
        updateWishlistButtonState(btn, productId);

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            let wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
            const index = wishlist.findIndex(item => (typeof item === 'string' ? item : String(item.id)) === String(productId));

            if (index > -1) {
                wishlist.splice(index, 1);
            } else {
                wishlist.push({
                    id: currentProduct.id,
                    name: fields.Name,
                    price: getDisplayPrice(currentProduct, selectedVariant),
                    image: currentImages.length > 0 ? currentImages[0] : ''
                });
            }

            localStorage.setItem('wishlistItems', JSON.stringify(wishlist));
            updateWishlistButtonState(btn, productId);
            if (typeof updateWishlistBadge === 'function') updateWishlistBadge();
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

    function setupSizeDrawer(sizeTooltipHtml, variants) {
        const drawerBody = document.getElementById('drawer-body');
        const toggle = document.getElementById('drawer-toggle');
        const overlay = document.getElementById('drawer-overlay');
        const panel = document.getElementById('drawer-panel');
        const closeBtn = document.getElementById('drawer-close');
        const doneBtn = document.getElementById('drawer-done');

        if (!drawerBody || !toggle || !overlay || !panel) return;

        // İçeriği doldur
        if (sizeTooltipHtml && sizeTooltipHtml.trim()) {
            drawerBody.innerHTML = sizeTooltipHtml;
        } else if (variants && variants.length > 0) {
            let html = '<table class="size-table">';
            html += '<thead><tr><th>Storlek</th><th>Pris</th></tr></thead><tbody>';
            variants.forEach(v => {
                const price = v.discount_price || v.price || 0;
                const original = v.discount_price ? `<s style="color:#999;font-size:12px;margin-right:6px;">${v.price} Kr</s>` : '';
                html += `<tr><td class="size-cell">${v.size || '-'}</td><td class="price-cell">${original}${price} Kr</td></tr>`;
            });
            html += '</tbody></table>';
            drawerBody.innerHTML = html;
        } else {
            drawerBody.innerHTML = '<p>Ingen storleksinformation tillgänglig.</p>';
        }

        // 🔥 AÇMA FONKSİYONU
        function openDrawer() {
            overlay.classList.add('active');
            panel.classList.add('active');
            document.body.classList.add('drawer-open');
        }

        // 🔥 KAPATMA FONKSİYONU - setTimeout ile yumuşak kapanış
        function closeDrawer() {
            overlay.classList.remove('active');
            panel.classList.remove('active');

            // Transition bitince body scroll'u aç
            setTimeout(() => {
                if (!panel.classList.contains('active')) {
                    document.body.classList.remove('drawer-open');
                }
            }, 500);
        }

        // Event listener'lar
        toggle.addEventListener('click', openDrawer);
        toggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openDrawer();
            }
        });

        overlay.addEventListener('click', closeDrawer);
        closeBtn.addEventListener('click', closeDrawer);
        doneBtn.addEventListener('click', closeDrawer);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && panel.classList.contains('active')) {
                closeDrawer();
            }
        });

        // Swipe down kapatma (mobile)
        let startY = 0;
        panel.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        }, { passive: true });

        panel.addEventListener('touchend', (e) => {
            const endY = e.changedTouches[0].clientY;
            if (endY - startY > 80 && window.innerWidth <= 768) {
                closeDrawer();
            }
        }, { passive: true });
    }

    function setupAccordions() {
        document.querySelectorAll('.product-accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                const item = header.parentElement;
                const content = item.querySelector('.product-accordion-content');
                const icon = header.querySelector('.fa-chevron-down');

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

        document.querySelectorAll('.product-accordion-content').forEach(content => {
            content.style.display = 'none';
        });
    }

    function updateProductSubtitle(variant) {
        const subtitleEl = document.getElementById('dynamic-product-subtitle');
        if (!subtitleEl || !variant) return;

        const sizeDisplay = subtitleEl.querySelector('.selected-size-display');
        if (sizeDisplay) {
            sizeDisplay.textContent = variant.size || 'Välj storlek';
            sizeDisplay.style.color = '#333';
        }
    }

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
                         data-lightbox-index="${i}">
                </div>
            `;
        }
        container.innerHTML = mainHTML;

        // Lightbox event listener'lari ekle
        container.querySelectorAll('.main-image').forEach((img, i) => {
            img.addEventListener('click', () => openLightbox(i));
        });

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
                     data-thumb-index="${i}">
                    <img src="${img}" alt="thumb-${i+1}" class="lightbox-thumbnail-item">
                </div>
            `;
        });
        list.innerHTML = html;

        // Thumb click event listener'lari ekle
        list.querySelectorAll('.lightbox-thumb-item-container').forEach((thumb, i) => {
            thumb.addEventListener('click', () => lightboxSelectThumb(i));
        });
    }

    window.lightboxSelectThumb = function(index) {
        selectedImageIndex = index;
        updateLightboxImage();
    };

    function setupVariantAccordion() {
        const btn = document.getElementById('variant-accordion-btn');
        if (!btn) return;

        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!currentFilteredVariants || currentFilteredVariants.length === 0) {
                if (currentVariants && currentVariants.length > 0) {
                    currentFilteredVariants = currentVariants;
                    renderVariantDrawerFiltered(currentVariants);
                } else {
                    alert('Inga storlekar tillgängliga');
                    return;
                }
            }
            openVariantDrawer();
        });
    }

    function openVariantDrawer() {
        const overlay = document.getElementById('variant-drawer-overlay');
        const drawer = document.getElementById('variant-drawer');

        if (!overlay || !drawer) return;

        overlay.style.display = 'block';
        overlay.style.opacity = '0';
        drawer.style.display = 'block';
        drawer.style.transform = 'translateX(100%)';

        void overlay.offsetWidth;
        void drawer.offsetWidth;

        requestAnimationFrame(() => {
            overlay.classList.add('open', 'active');
            overlay.style.opacity = '1';
            drawer.classList.add('open', 'active');
            drawer.style.transform = 'translateX(0)';
        });

        document.body.classList.add('drawer-open');
        document.body.style.overflow = 'hidden';
    }

    window.closeVariantDrawer = function() {
        const overlay = document.getElementById('variant-drawer-overlay');
        const drawer = document.getElementById('variant-drawer');

        if (!overlay || !drawer) return;

        overlay.style.opacity = '0';
        drawer.style.transform = 'translateX(100%)';

        overlay.classList.remove('open', 'active');
        drawer.classList.remove('open', 'active');

        // 🔥 Transition bitince temizle
        setTimeout(() => {
            if (!drawer.classList.contains('active')) {
                overlay.style.display = '';
                drawer.style.display = '';
                document.body.classList.remove('drawer-open');
                document.body.style.overflow = '';
            }
        }, 500); // CSS transition süresi

        document.body.classList.remove('drawer-open');
        document.body.style.overflow = '';
    };

    function renderVariantDrawerFiltered(variants) {
        const body = document.getElementById('variant-drawer-body');
        if (!body) return;

        if (!variants || variants.length === 0) {
            body.innerHTML = '<div class="variant-drawer-empty">Inga storlekar tillgängliga</div>';
            return;
        }

        const productName = currentProduct?.name || 'Produkt';

        let html = '';
        variants.forEach((variant, index) => {
            const isSelected = selectedVariant && selectedVariant.id === variant.id;
            const displayPrice = getDisplayPrice(currentProduct, variant);
            const originalPrice = getOriginalPrice(currentProduct, variant);
            const hasDiscount = variant.discount_price && variant.discount_price < variant.price;

            html += `
                <div class="variant-drawer-item ${isSelected ? 'selected' : ''} ${variant.stock <= 0 ? 'out-of-stock' : ''}" 
                     data-index="${index}" 
                     onclick="selectVariantFromFiltered(${index})">
                    <div class="variant-drawer-image">
                        <img src="${variant.variant_image || (currentImages.length > 0 ? currentImages[0] : '')}" 
                             alt="${productName} ${variant.size}"
                             onerror="this.style.display='none'">
                    </div>
                    <div class="variant-drawer-info">
                        <span class="variant-size">${variant.size || '-'}</span>
                        <span class="variant-price">
                            ${hasDiscount 
                                ? '<span class="current-price price-discount">' + displayPrice + ' Kr</span> <span class="original-price">' + originalPrice + ' Kr</span>' 
                                : '<span class="current-price">' + displayPrice + ' Kr</span>'}
                        </span>
                        <span class="variant-stock ${variant.stock > 0 ? (variant.stock <= 3 ? 'low' : 'in-stock') : 'out'}">
                            ${variant.stock > 0 ? (variant.stock <= 3 ? 'Endast ' + variant.stock + ' tillgängliga' : 'I lager (' + variant.stock + ' st)') : 'Slutsåld'}
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
        if (closeBtn) {
            closeBtn.onclick = closeVariantDrawer;
        }

        const overlay = document.getElementById('variant-drawer-overlay');
        if (overlay) {
            overlay.onclick = (e) => {
                if (e.target === overlay) closeVariantDrawer();
            };
        }
    }

    function updateAccordionDisplay() {
        const accordionSubtitle = document.getElementById('selected-variant-display');
        const accordionStatus = document.getElementById('variant-status');

        if (!accordionSubtitle) return;

        if (selectedVariant && selectedColor) {
            accordionSubtitle.textContent = selectedColor + ' / ' + selectedVariant.size;
            accordionSubtitle.style.color = '#333';
            accordionSubtitle.style.fontWeight = '500';
        } else if (selectedVariant) {
            accordionSubtitle.textContent = selectedVariant.size;
            accordionSubtitle.style.color = '#333';
            accordionSubtitle.style.fontWeight = '500';
        } else if (selectedColor) {
            accordionSubtitle.textContent = selectedColor + ' - Välj storlek';
            accordionSubtitle.style.color = '#666';
        } else {
            accordionSubtitle.textContent = 'Välj storlek';
            accordionSubtitle.style.color = '#999';
        }

        if (accordionStatus) {
            if (selectedVariant) {
                accordionStatus.style.display = 'inline';
                accordionStatus.textContent = '';
            } else {
                accordionStatus.style.display = 'none';
            }
        }
    }

    window.selectVariantFromFiltered = function(index, closeDrawer = true) {
        selectedVariant = currentFilteredVariants[index];

        document.querySelectorAll('.variant-drawer-item').forEach((item, i) => {
            item.classList.toggle('selected', i === index);
            const icon = item.querySelector('.variant-check i');
            if (icon) icon.className = i === index ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle';
        });

        updateAccordionDisplay();

        const priceEl = document.getElementById('product-price');
        if (priceEl) {
            const hasDiscount = selectedVariant.discount_price && selectedVariant.discount_price < selectedVariant.price;
            if (hasDiscount) {
                // FIX: Indirimli fiyat ONCE, orijinal fiyat SONRA
                priceEl.innerHTML = 
                    '<span class="discount-price">' + selectedVariant.discount_price + ' Kr</span>' +
                    '<span class="original-price">' + selectedVariant.price + ' Kr</span>';
            } else {
                priceEl.innerHTML = '<span class="normal-price">' + selectedVariant.price + ' Kr</span>';
            }
        }

        const stockInfo = document.getElementById('stock-info');
        const stockText = stockInfo?.querySelector('.stock-text');
        const stockDot = stockInfo?.querySelector('.stock-dot');

        if (stockInfo && stockText && stockDot) {
            stockInfo.classList.add('active');

            if (selectedVariant.stock <= 0) {
                stockText.textContent = 'Slutsåld';
                stockText.className = 'stock-text out';
                stockDot.className = 'stock-dot out';
            } else if (selectedVariant.stock <= 3) {
                stockText.textContent = 'Endast ' + selectedVariant.stock + ' tillgängliga - Klar för leverans';
                stockText.className = 'stock-text low';
                stockDot.className = 'stock-dot low';
            } else {
                stockText.textContent = 'I lager - Klar för leverans';
                stockText.className = 'stock-text in-stock';
                stockDot.className = 'stock-dot in-stock';
            }
        }

        const addBtn = document.getElementById('add-to-cart-btn');
        if (addBtn) {
            addBtn.disabled = selectedVariant.stock <= 0;
            addBtn.textContent = selectedVariant.stock > 0 ? 'Lägg i Varukorg' : 'Slutsåld';
        }

        const sizeDisplayText = document.getElementById('selected-size-display-text');
        if (sizeDisplayText && selectedVariant) {
            sizeDisplayText.textContent = selectedVariant.size;
        }

        if (closeDrawer) {
            closeVariantDrawer();
        }
    };

    window.selectVariant = function(index) {
        selectedVariant = currentVariants[index];
        document.querySelectorAll('.variant-drawer-item').forEach((item, i) => {
            item.classList.toggle('selected', i === index);
            const icon = item.querySelector('.variant-check i');
            if (icon) icon.className = i === index ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle';
        });

        updateAccordionDisplay();
        closeVariantDrawer();
    };

    function setupAddToCart(fields) {
        const btn = document.getElementById('add-to-cart-btn');
        if (!btn) return;

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 🎯 HESAPLAYICI ÜRÜN KONTROLÜ
            if (typeof ProductCalculator !== 'undefined' && ProductCalculator.isReady && ProductCalculator.isReady()) {
                console.log('[ProductUI] Hesaplayıcı ürün sepete ekleniyor...');
                const calcItem = ProductCalculator.getCartItem();
                if (calcItem) {
                    let cart = JSON.parse(localStorage.getItem('siteCartItems')) || [];

                    // Aynı ürün var mı kontrol et
                    const existing = cart.find(item => item.cartItemId === calcItem.cartItemId);
                    if (existing) {
                        existing.quantity = (existing.quantity || 1) + calcItem.quantity;
                    } else {
                        cart.push(calcItem);
                    }

                    localStorage.setItem('siteCartItems', JSON.stringify(cart));

                    if (typeof updateCartBadge === 'function') updateCartBadge();
                    if (typeof openMiniCart === 'function') openMiniCart();

                    // Başarılı bildirim
                     ProductCalculator.reset();

                   if (typeof window.showToast === 'function') {
                   window.showToast('Produkten har lagts till i varukorgen!', 'success');
                  }
                 return;
                }
            }

            if (!selectedVariant) {
                alert('Välj storlek först');
                return;
            }

            const displayPrice = getDisplayPrice(currentProduct, selectedVariant);
            const originalPrice = getOriginalPrice(currentProduct, selectedVariant);
            const variantLabel = selectedVariant.size;
            const colorName = selectedVariant.color || selectedColor || 'Standard';

            const cartItemId = String(currentProduct.id) + '_' + variantLabel + '_' + colorName;

            const cartItem = {
                id: currentProduct.id,
                cartItemId: cartItemId,
                name: fields.Name,
                price: displayPrice,
                original_price: originalPrice,
                image: currentImages.length > 0 ? currentImages[0] : '',
                variants: variantLabel,
                color: colorName,
                delivery: fields.Delivery_time || '3-7 arbetsdagar',
                quantity: 1
            };

            let cart = JSON.parse(localStorage.getItem('siteCartItems')) || [];
            const existing = cart.find(item => item.cartItemId === cartItemId);

            if (existing) {
                existing.quantity = (existing.quantity || 1) + 1;
            } else {
                cart.push(cartItem);
            }

            localStorage.setItem('siteCartItems', JSON.stringify(cart));

            if (typeof updateCartBadge === 'function') updateCartBadge();
            if (typeof openMiniCart === 'function') openMiniCart();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProductPage);
    } else {
        initProductPage();
    }

// ==========================================
// SEO META TAG'LERİNİ GÜNCELLE
// ==========================================
function updateProductMetaTags(product) {
    if (!product) return;
    
    // 1. <title>
    if (product.seo_title) {
        document.title = product.seo_title;
    } else {
        document.title = `${product.name} | DKRUG`;
    }
    
    // 2. <meta name="description">
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
    }
    if (product.seo_description) {
        metaDesc.setAttribute('content', product.seo_description);
    }
    
    // 3. <meta name="keywords">
    if (product.seo_keywords) {
        let metaKeywords = document.querySelector('meta[name="keywords"]');
        if (!metaKeywords) {
            metaKeywords = document.createElement('meta');
            metaKeywords.setAttribute('name', 'keywords');
            document.head.appendChild(metaKeywords);
        }
        metaKeywords.setAttribute('content', product.seo_keywords);
    }
    
    // 4. <link rel="canonical">
    const canonicalUrl = product.canonical_url || `https://dkrug.se/produkt/${product.slug}`;
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);
    
    // 5. Open Graph
    const ogImage = product.og_image || (product.images && product.images[0] ? product.images[0] : '');
    const ogTitle = product.seo_title || product.name;
    const ogDesc = product.seo_description || product.description?.replace(/<[^>]*>/g, '').substring(0, 160) || '';
    
    // og:title
    let ogTitleTag = document.querySelector('meta[property="og:title"]');
    if (!ogTitleTag) {
        ogTitleTag = document.createElement('meta');
        ogTitleTag.setAttribute('property', 'og:title');
        document.head.appendChild(ogTitleTag);
    }
    ogTitleTag.setAttribute('content', ogTitle);
    
    // og:description
    let ogDescTag = document.querySelector('meta[property="og:description"]');
    if (!ogDescTag) {
        ogDescTag = document.createElement('meta');
        ogDescTag.setAttribute('property', 'og:description');
        document.head.appendChild(ogDescTag);
    }
    ogDescTag.setAttribute('content', ogDesc);
    
    // og:image
    if (ogImage) {
        let ogImageTag = document.querySelector('meta[property="og:image"]');
        if (!ogImageTag) {
            ogImageTag = document.createElement('meta');
            ogImageTag.setAttribute('property', 'og:image');
            document.head.appendChild(ogImageTag);
        }
        ogImageTag.setAttribute('content', ogImage);
        
        // og:image:width & height
        let ogWidth = document.querySelector('meta[property="og:image:width"]');
        if (!ogWidth) {
            ogWidth = document.createElement('meta');
            ogWidth.setAttribute('property', 'og:image:width');
            document.head.appendChild(ogWidth);
        }
        ogWidth.setAttribute('content', '1200');
        
        let ogHeight = document.querySelector('meta[property="og:image:height"]');
        if (!ogHeight) {
            ogHeight = document.createElement('meta');
            ogHeight.setAttribute('property', 'og:image:height');
            document.head.appendChild(ogHeight);
        }
        ogHeight.setAttribute('content', '630');
    }
    
    // og:type
    let ogType = document.querySelector('meta[property="og:type"]');
    if (!ogType) {
        ogType = document.createElement('meta');
        ogType.setAttribute('property', 'og:type');
        document.head.appendChild(ogType);
    }
    ogType.setAttribute('content', 'product');
    
    // og:url
    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (!ogUrl) {
        ogUrl = document.createElement('meta');
        ogUrl.setAttribute('property', 'og:url');
        document.head.appendChild(ogUrl);
    }
    ogUrl.setAttribute('content', canonicalUrl);
    
    // 6. Twitter Cards
    let twitterCard = document.querySelector('meta[name="twitter:card"]');
    if (!twitterCard) {
        twitterCard = document.createElement('meta');
        twitterCard.setAttribute('name', 'twitter:card');
        document.head.appendChild(twitterCard);
    }
    twitterCard.setAttribute('content', 'summary_large_image');
    
    let twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (!twitterTitle) {
        twitterTitle = document.createElement('meta');
        twitterTitle.setAttribute('name', 'twitter:title');
        document.head.appendChild(twitterTitle);
    }
    twitterTitle.setAttribute('content', ogTitle);
    
    let twitterDesc = document.querySelector('meta[name="twitter:description"]');
    if (!twitterDesc) {
        twitterDesc = document.createElement('meta');
        twitterDesc.setAttribute('name', 'twitter:description');
        document.head.appendChild(twitterDesc);
    }
    twitterDesc.setAttribute('content', ogDesc);
    
    if (ogImage) {
        let twitterImage = document.querySelector('meta[name="twitter:image"]');
        if (!twitterImage) {
            twitterImage = document.createElement('meta');
            twitterImage.setAttribute('name', 'twitter:image');
            document.head.appendChild(twitterImage);
        }
        twitterImage.setAttribute('content', ogImage);
    }
    
    // 7. Robots meta (noindex kontrolü)
    if (product.noindex) {
        let robotsMeta = document.querySelector('meta[name="robots"]');
        if (!robotsMeta) {
            robotsMeta = document.createElement('meta');
            robotsMeta.setAttribute('name', 'robots');
            document.head.appendChild(robotsMeta);
        }
        robotsMeta.setAttribute('content', 'noindex, nofollow');
    }
    
    // 8. Schema.org JSON-LD (Product)
    const schemaType = product.schema_type || 'Product';
    const displayPrice = product.discount_price || product.base_price || 0;
    const originalPrice = product.base_price || 0;
    const hasDiscount = product.discount_price && product.discount_price < product.base_price;
    
    // Stok durumunu belirle
    let availability = 'https://schema.org/InStock';
    if (product.product_variants && product.product_variants.length > 0) {
        const totalStock = product.product_variants.reduce((sum, v) => sum + (v.stock || 0), 0);
        if (totalStock <= 0) availability = 'https://schema.org/OutOfStock';
    } else if (product.m2_calculator_active) {
        // M² ürün: stok varsa InStock
        const stocks = product.m2_stock_per_width || {};
        const totalM2Stock = Object.values(stocks).reduce((sum, s) => sum + (parseFloat(s) || 0), 0);
        if (totalM2Stock <= 0) availability = 'https://schema.org/OutOfStock';
    }
    
    const schemaData = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        'name': product.name,
        'image': product.images || [],
        'description': product.seo_description || product.description?.replace(/<[^>]*>/g, '') || '',
        'sku': String(product.id),
        'brand': {
            '@type': 'Brand',
            'name': 'DKRUG'
        },
        'offers': {
            '@type': 'Offer',
            'url': canonicalUrl,
            'priceCurrency': 'SEK',
            'price': String(displayPrice),
            'priceValidUntil': new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
            'availability': availability,
            'seller': {
                '@type': 'Organization',
                'name': 'DKRUG'
            }
        }
    };
    
    // İndirim varsa offer'a ekle
    if (hasDiscount) {
        schemaData.offers.price = String(product.discount_price);
        // Schema 3.0+ için
        schemaData.offers.priceSpecification = {
            '@type': 'PriceSpecification',
            'price': String(product.discount_price),
            'priceCurrency': 'SEK'
        };
    }
    
    // Eski schema'yı kaldır ve yenisini ekle
    let existingSchema = document.querySelector('script[data-product-schema="true"]');
    if (existingSchema) existingSchema.remove();
    
    const schemaScript = document.createElement('script');
    schemaScript.setAttribute('type', 'application/ld+json');
    schemaScript.setAttribute('data-product-schema', 'true');
    schemaScript.textContent = JSON.stringify(schemaData, null, 2);
    document.head.appendChild(schemaScript);
}

// Bu fonksiyonu initProductPage() içinde, veri yüklendikten sonra çağır:
// updateProductMetaTags(currentProduct);




}