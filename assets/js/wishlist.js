// ==========================================
// RENK EŞLEŞTİRME (category.js'den kopyala)
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




// ==========================================
// WISHLIST.JS - SUPABASE UYUMLU (v2.1 - URL FIX)
// Urun linkleri: /produkt/{slug} formatinda
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('wishlist-grid');
    const emptyState = document.getElementById('wishlist-empty');
    const countText = document.getElementById('wishlist-count-text');

    // SUPABASE CONFIG
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

    // Wishlist ID'lerini al (obje dizisi veya string dizisi olabilir)
    function getWishlistItems() {
        try {
            const stored = JSON.parse(localStorage.getItem('wishlistItems')) || [];
            // Eski format: string dizisi | Yeni format: obje dizisi
            return stored.map(item => typeof item === 'string' ? { id: item } : item);
        } catch (e) {
            return [];
        }
    }

    const wishlistItems = getWishlistItems();
    const wishlistIds = wishlistItems.map(item => String(item.id)).filter(Boolean);

    if (wishlistIds.length === 0) {
        showEmptyState();
        return;
    }

    // Supabase'den urunleri cek
    try {
        // Tum aktif urunleri cek (Supabase'de 'in' ile coklu ID sorgusu)
        const products = await supabaseGet('products', {
            select: '*',
            active: 'eq.true'
        });

        // Wishlist'teki ID'lere gore filtrele (int8/string uyumlu)
        const filteredProducts = products.filter(p => wishlistIds.includes(String(p.id)));

        if (filteredProducts.length === 0) {
            showEmptyState();
            return;
        }

        // Varyantlari ayri cek
        const variants = await supabaseGet('product_variants', {
            select: '*'
        });

        // Urunleri map'le
        const mappedProducts = filteredProducts.map(product => {
    const productVariants = variants.filter(v => String(v.product_id) === String(product.id));
    return {
        id: product.id,
        name: product.name || 'Urun',
        price: product.discount_price || product.base_price || 0,
        base_price: product.base_price || 0,           // 🔥 EKLENDİ
        discount_price: product.discount_price || null, // 🔥 EKLENDİ
        image: product.images && product.images[0] ? product.images[0] : '',
        slug: product.slug || '',
        colors: product.colors || [],                    // 🔥 EKLENDİ
        variants: productVariants,                        // 🔥 DİZİ olarak tut
    };
});

        renderProducts(mappedProducts);
        countText.textContent = `Du har ${mappedProducts.length} sparade produkter.`;

    } catch (error) {
        console.error('Wishlist yukleme hatasi:', error);
        grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:60px;">
                <p style="color:#666; margin-bottom:20px;">Kunde inte ladda favoriter.</p>
                <button onclick="location.reload()" class="btn-explore">Forsok igen</button>
            </div>
        `;
    }

    function showEmptyState() {
        grid.innerHTML = '';
        countText.textContent = '';
        emptyState.style.display = 'block';
    }

     function renderProducts(products) {
    grid.innerHTML = products.map(product => {
        const productUrl = product.slug
            ? `/produkt/${product.slug}`
            : `/produkt/${product.id}`;

        // 🔥 İNDİRİM KONTROLÜ (category.js'deki gibi)
        const hasDiscount = product.discount_price && product.discount_price < product.base_price;
        const displayPrice = product.discount_price || product.base_price || 0;
        
        const priceHTML = hasDiscount 
            ? `<span class="current-price price-discount">${displayPrice.toLocaleString('sv-SE')} SEK</span>
               <span class="original-price">${product.base_price.toLocaleString('sv-SE')} SEK</span>`
            : `<span class="current-price">${displayPrice.toLocaleString('sv-SE')} SEK</span>`;

        // 🔥 VARYANT GÖSTERİMİ (category.js'deki gibi)
        const variantText = product.variants && product.variants.length > 0
            ? (product.variants.length === 1 
                ? `<span class="variant-single">${product.variants[0].size || 'Standard'}</span>`
                : `<span class="variant-main">${product.variants[0].size || ''}</span><span class="variant-extra-badge">+${product.variants.length - 1} storlekar</span>`)
            : '';

        // 🔥 RENK SWATCH'LARI (category.js'deki gibi)
        const colorsHTML = product.colors && product.colors.length > 0 
            ? `<div class="product-colors-wrapper">
                <div class="product-colors-swatches">
                    ${product.colors.slice(0, 5).map(color => `
                        <span class="swatch-circle" 
                              style="background: ${getColorStyle(color)};"
                              title="${color}"></span>
                    `).join('')}
                </div>
                ${product.colors.length > 5 ? '<span class="color-count-text">+' + (product.colors.length - 5) + ' farger</span>' : ''}
            </div>` 
            : '';

        return `
        <div class="product-item-wrapper product-card" data-id="${String(product.id)}">
            <div class="image-box">
                <a href="${productUrl}" class="product-image-link">
                    <img src="${product.image}"
                         alt="${product.name}"
                         loading="lazy"
                         onerror="this.style.display='none'">
                </a>
                ${hasDiscount ? '<span class="discount-badge">REA</span>' : ''}
                <button class="wishlist-btn active"
                        data-product-id="${String(product.id)}"
                        onclick="removeFromWishlist('${String(product.id)}')"
                        aria-label="Ta bort från favoriter">
                    <svg class="heart-icon" viewBox="0 0 24 24" fill="#D30000" stroke="#D30000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                </button>
            </div>
            <div class="product-info">
                <h3 class="product-title">
                    <a href="${productUrl}" style="text-decoration:none; color:inherit;">${product.name}</a>
                </h3>
                <div class="product-variants-row">
                    ${variantText ? `<div class="product-variants">${variantText}</div>` : ''}
                </div>
                <div class="product-price">
                    ${priceHTML}
                </div>
                ${colorsHTML}
            </div>
        </div>
        `;
    }).join('');
}
});

// Global fonksiyon - HTML onclick'ten erisim icin
// ID FIX: String karsilastirma kullan
function removeFromWishlist(productId) {
    console.log('removeFromWishlist cagrildi, ID:', productId, 'tip:', typeof productId);

    // localStorage'dan kaldir
    let wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
    console.log('Wishlist silinmeden once:', wishlist.length, 'item');

    wishlist = wishlist.filter(item => {
        const itemId = typeof item === 'string' ? item : String(item.id);
        const match = itemId !== String(productId);
        if (!match) console.log('Silinecek item bulundu:', itemId);
        return match;
    });

    console.log('Wishlist silindikten sonra:', wishlist.length, 'item');
    localStorage.setItem('wishlistItems', JSON.stringify(wishlist));

    // Karti animasyonlu kaldir
    const card = document.querySelector(`[data-id="${String(productId)}"]`);
    if (card) {
        card.classList.add('product-removed');
        setTimeout(() => {
            card.remove();

            // Tumu silindiyse bos state goster
            const remaining = document.querySelectorAll('.product-item-wrapper');
            if (remaining.length === 0) {
                document.getElementById('wishlist-grid').innerHTML = '';
                document.getElementById('wishlist-count-text').textContent = '';
                document.getElementById('wishlist-empty').style.display = 'block';
            } else {
                document.getElementById('wishlist-count-text').textContent =
                    `Du har ${remaining.length} sparade produkter.`;
            }

            // Header badge'i guncelle
            if (typeof updateWishlistBadge === 'function') updateWishlistBadge();
        }, 400);
    } else {
        console.warn('Kaldirilacak kart bulunamadi, ID:', productId);
    }
}
