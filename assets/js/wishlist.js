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
                image: product.images && product.images[0] ? product.images[0] : '',
                slug: product.slug || '',
                variants: productVariants.length > 0
                    ? productVariants.length + ' storlekar'
                    : 'Standard'
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
            // 🔥 URL TUTARLILIGI FIX: /produkt/{slug} formati
            // slug bos veya undefined ise fallback olarak id kullan
            const productUrl = product.slug
                ? `/produkt/${product.slug}`
                : `/produkt/${product.id}`;

            return `
            <div class="product-item-wrapper" data-id="${String(product.id)}">
                <div class="product-card">
                    <div class="image-box">
                       <a href="${productUrl}" class="product-image-link">
                            <img src="${product.image}"
                                 alt="${product.name}"
                                 loading="lazy"
                                 onerror="this.style.display='none'"
                                 style="width:100%; height:100%; object-fit:cover;">
                        </a>
                        <button class="wishlist-btn active"
                                data-product-id="${String(product.id)}"
                                onclick="removeFromWishlist('${String(product.id)}')">
                            <i class="fa-solid fa-heart"></i>
                        </button>
                    </div>
                    <div class="product-info">
                        <h3 class="product-title">
                            <a href="${productUrl}" style="text-decoration:none; color:inherit;">${product.name}</a>
                        </h3>
                        <div class="product-meta-row">
                            <span class="product-acf-dimension">${product.variants}</span>
                        </div>
                        <div class="product-price">
                            <span class="current-price">${product.price.toLocaleString('sv-SE')} SEK</span>
                        </div>
                    </div>
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
