// ==========================================
// CARD.JS v1.0 - DKRUG Ürün Kartı Modülü
// Ortak: category.js + index.js
// ==========================================

// ===== RENK EŞLEŞTİRME - İsveççe -> CSS =====
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

// ===== FİYAT HESAPLAMA =====
function getDisplayPrice(product) {
    return product.discount_price || product.base_price || 0;
}

// ===== VARYANT METNİ =====
function getVariantDisplayText(product) {
    const m2Widths = product.m2_available_widths || [];
    if (product.m2_calculator_active && m2Widths.length > 0) {
        const firstWidth = m2Widths[0];
        const extraCount = m2Widths.length - 1;
        if (m2Widths.length === 1) {
            return `<span class="variant-main">${firstWidth} cm</span>`;
        }
        return `<span class="variant-main">${firstWidth} cm</span><span class="variant-extra-badge">+${extraCount} storlek</span>`;
    }

    const gardinMeasurements = product.gardin_measurements || [];
    if (product.gardin_calculator_active && gardinMeasurements.length > 0) {
        const firstMeasurement = gardinMeasurements[0].replace('x', '×');
        const extraCount = gardinMeasurements.length - 1;
        if (gardinMeasurements.length === 1) {
            return `<span class="variant-main">${firstMeasurement} cm</span>`;
        }
        return `<span class="variant-main">${firstMeasurement} cm</span><span class="variant-extra-badge">+${extraCount} storlek</span>`;
    }

    const measurements = product.measurements || [];
    if (measurements.length > 0) {
        const firstMeasurement = measurements[0];
        const extraCount = measurements.length - 1;
        if (measurements.length === 1) {
            return `<span class="variant-main">${firstMeasurement}</span>`;
        }
        return `<span class="variant-main">${firstMeasurement}</span><span class="variant-extra-badge">+${extraCount} storlekar</span>`;
    }

    const variants = product.variants || [];
    if (variants.length === 0) return '';
    const firstSize = variants[0].size || '';
    const extraCount = variants.length - 1;
    if (variants.length === 1) {
        return `<span class="variant-main">${firstSize}</span>`;
    }
    return `<span class="variant-main">${firstSize}</span><span class="variant-extra-badge">+${extraCount} storlekar</span>`;
}

// ===== HTML ESCAPE =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== WISHLIST FONKSIYONLARI =====
function isInWishlist(productId) {
    try {
        const wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
        return wishlist.some(item => (typeof item === 'string' ? item : String(item.id)) === String(productId));
    } catch (e) {
        return false;
    }
}

function updateWishlistBadge() {
    try {
        const wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
        const badge = document.querySelector('.wishlist-count-badge');
        if (badge) {
            badge.textContent = wishlist.length;
            badge.classList.toggle('visible', wishlist.length > 0);
        }
    } catch (e) {
        console.error('Wishlist badge hatasi:', e);
    }
}

function toggleWishlistItem(productId, name, price, image) {
    let wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
    const index = wishlist.findIndex(item => (typeof item === 'string' ? item : String(item.id)) === String(productId));

    if (index > -1) {
        wishlist.splice(index, 1);
        console.log('Favorilerden kaldirildi:', name);
    } else {
        wishlist.push({ id: productId, name: name, price: price, image: image });
        console.log('Favorilere eklendi:', name);
    }

    localStorage.setItem('wishlistItems', JSON.stringify(wishlist));
    updateWishlistBadge();

    // Tüm butonları güncelle
    document.querySelectorAll(`[data-product-id="${productId}"] .wishlist-btn, .wishlist-btn[data-product-id="${productId}"]`).forEach(btn => {
        const isActive = index === -1;
        btn.classList.toggle('active', isActive);
        const icon = btn.querySelector('.heart-icon');
        if (icon) {
            icon.style.fill = isActive ? 'currentColor' : 'none';
            icon.style.stroke = 'currentColor';
        }
    });
}

// ===== ÜRÜN KARTI OLUŞTURMA =====
function createProductCard(product, isWishlisted) {
    const hasDiscount = product.discount_price && product.discount_price < product.base_price;
    const price = getDisplayPrice(product);

    const priceHTML = hasDiscount 
        ? `<span class="current-price price-discount">${price.toLocaleString('sv-SE')} Kr</span>
           <span class="original-price">${(product.base_price || 0).toLocaleString('sv-SE')} Kr</span>`
        : `<span class="current-price">${price.toLocaleString('sv-SE')} Kr</span>`;

    const variantText = getVariantDisplayText(product);

    const productUrl = product.slug
        ? '/produkt/' + encodeURIComponent(String(product.slug).trim())
        : '/produkt/index.html?id=' + encodeURIComponent(String(product.id));

    const colors = product.colors || [];
    const colorsHTML = colors.length > 0 ? `
        <div class="product-colors-wrapper">
            <div class="product-colors-swatches">
                ${colors.slice(0, 5).map(color => `
                    <span class="swatch-circle" 
                          style="background: ${getColorStyle(color)};"
                          title="${escapeHtml(color)}"></span>
                `).join('')}
            </div>
            ${colors.length > 5 ? `<span class="color-count-text">+${colors.length - 5} färger</span>` : ''}
        </div>
    ` : '';

    return `<div class="product-card" data-product-id="${String(product.id)}" data-id="${String(product.id)}">
        <div class="image-box">
            <a href="${productUrl}">
                <img 
                    data-src="${product.image}" 
                    alt="${escapeHtml(product.name || '')}"
                    class="product-img"
                    loading="lazy"
                    onerror="this.style.display='none'"
                >
            </a>
            ${hasDiscount ? '<span class="discount-badge">REA</span>' : ''}
            <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" 
                    data-product-id="${String(product.id)}"
                    aria-label="${isWishlisted ? 'Ta bort från favoriter' : 'Lägg till favoriter'}"
                    onclick="event.preventDefault(); event.stopPropagation(); toggleWishlistItem('${String(product.id)}', '${escapeHtml(product.name || '')}', ${price}, '${escapeHtml(product.image || '')}')">
                <svg class="heart-icon" viewBox="0 0 24 24" fill="${isWishlisted ? '#D30000' : 'none'}" stroke="${isWishlisted ? '#D30000' : '#111'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
            </button>
        </div>
        <div class="product-info">
            <h3 class="product-title">${escapeHtml(product.name || 'Produkt')}</h3>
            <div class="product-variants-row">
                ${variantText ? `<div class="product-variants">${variantText}</div>` : ''}
            </div>
            <div class="product-price">
                ${priceHTML}
            </div>
            ${colorsHTML}
        </div>
    </div>`;
}

// ===== LAZY LOADING (Profesyonel Resim Yükleme) =====
let imageObserver = null;

function initLazyImages() {
    if (imageObserver) {
        imageObserver.disconnect();
    }

    imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const src = img.getAttribute('data-src');

                if (src) {
                    img.onload = function() {
                        img.classList.add('loaded');
                        const imageBox = img.closest('.image-box');
                        if (imageBox) {
                            imageBox.classList.add('img-loaded');
                        }
                    };

                    img.onerror = function() {
                        img.classList.add('error');
                        const imageBox = img.closest('.image-box');
                        if (imageBox) {
                            imageBox.classList.add('error-state');
                        }
                    };

                    img.src = src;
                }

                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: '200px 0px',
        threshold: 0
    });

    document.querySelectorAll('img[data-src]:not(.loaded)').forEach(img => {
        imageObserver.observe(img);
    });
}

// ===== WISHLIST EVENT ATTACHMENT (Delegation) =====
function attachWishlistEvents(containerSelector) {
    const container = document.querySelector(containerSelector || '#product-grid');
    if (!container) return;

    // Önceki listener'ı kaldır (varsa)
    container.removeEventListener('click', handleWishlistClick);
    container.addEventListener('click', handleWishlistClick);
}

function handleWishlistClick(e) {
    const btn = e.target.closest('.wishlist-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const productId = btn.dataset.productId;
    if (!productId) return;

    // Ürün bilgilerini karttan al
    const card = btn.closest('.product-card');
    const nameEl = card?.querySelector('.product-title');
    const priceEl = card?.querySelector('.current-price');
    const imgEl = card?.querySelector('img');

    const name = nameEl ? nameEl.textContent : '';
    const priceText = priceEl ? priceEl.textContent : '0';
    const price = parseFloat(priceText.replace(/[^0-9]/g, '')) || 0;
    const image = imgEl ? imgEl.getAttribute('data-src') || imgEl.src : '';

    toggleWishlistItem(productId, name, price, image);
}

// ===== GLOBAL EXPORTS =====
window.CardModule = {
    COLOR_MAP,
    getColorStyle,
    getDisplayPrice,
    getVariantDisplayText,
    escapeHtml,
    isInWishlist,
    updateWishlistBadge,
    toggleWishlistItem,
    createProductCard,
    initLazyImages,
    attachWishlistEvents,
    handleWishlistClick
};