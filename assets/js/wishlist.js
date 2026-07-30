// ==========================================
// WISHLIST.JS - SUPABASE UYUMLU (v3.0 - CARD.JS INTEGRATION)
// FIX: createProductCard kullanımı ile kategori sayfasıyla birebir aynı kart yapısı
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('wishlist-grid');
    const emptyState = document.getElementById('wishlist-empty');
    const countText = document.getElementById('wishlist-count-text');

    // SUPABASE CONFIG
    const SUPABASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE) ? CONFIG.SUPABASE.URL : '';
    const SUPABASE_KEY = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE) ? CONFIG.SUPABASE.ANON_KEY : '';

    // SKELETON GOSTER - Sayfa acilir acilmaz
    showSkeleton();

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
        hideSkeleton();
        showEmptyState();
        return;
    }

    // Supabase'den urunleri cek
    try {
        // Tum aktif urunleri cek
        const products = await supabaseGet('products', {
            select: '*',
            active: 'eq.true'
        });

        // Wishlist'teki ID'lere gore filtrele (int8/string uyumlu)
        const filteredProducts = products.filter(p => wishlistIds.includes(String(p.id)));

        if (filteredProducts.length === 0) {
            hideSkeleton();
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
        base_price: product.base_price || 0,
        discount_price: product.discount_price || null,
        image: product.images && product.images[0] ? product.images[0] : '',
        slug: product.slug || '',
        colors: product.colors || [],
        variants: productVariants.length > 0 ? productVariants : (product.variants || []),
        measurements: product.measurements || [],
        m2_available_widths: product.m2_available_widths || [],
        m2_calculator_active: product.m2_calculator_active || false,
        gardin_measurements: product.gardin_measurements || [],
        gardin_calculator_active: product.gardin_calculator_active || false,
        // ⬇️ BUNLARI EKLE
        card_badge: product.card_badge || '',
        card_badge_secondary: product.card_badge_secondary || ''
    };
});

        hideSkeleton();
        renderProducts(mappedProducts);
        countText.textContent = `Du har ${mappedProducts.length} sparade produkter.`;

    } catch (error) {
        console.error('Wishlist yukleme hatasi:', error);
        hideSkeleton();
        grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:60px;">
                <p style="color:#666; margin-bottom:20px;">Kunde inte ladda favoriter.</p>
                <button onclick="location.reload()" class="btn-explore">Forsok igen</button>
            </div>
        `;
    }

    function showSkeleton() {
        // card.js'deki skeleton yapisiyla uyumlu
        const skeletonHTML = Array(6).fill(`
            <div class="product-card skeleton-card">
                <div class="skeleton-image"></div>
                <div class="skeleton-body">
                    <div class="skeleton-line title"></div>
                    <div class="skeleton-line price"></div>
                    <div class="skeleton-line meta"></div>
                </div>
            </div>
        `).join('');
        
        grid.innerHTML = skeletonHTML;
        grid.classList.add('skeleton-active');
        if (countText) countText.textContent = 'Laddar favoriter...';
    }

    function hideSkeleton() {
        grid.classList.remove('skeleton-active');
    }

    function showEmptyState() {
        grid.innerHTML = '';
        if (countText) countText.textContent = '';
        emptyState.style.display = 'block';
    }

    function renderProducts(products) {
    grid.innerHTML = products.map(product => {
        const cardProduct = {
            id: product.id,
            name: product.name,
            base_price: product.base_price || 0,
            discount_price: product.discount_price || null,
            image: product.image,
            slug: product.slug || '',
            colors: product.colors || [],
            variants: (product.variants || []).map(v => ({
                size: v.size || '',
                color: v.color || null,
                price: v.price || 0,
                discount_price: v.discount_price || null,
                stock: v.stock || 0
            })),
            measurements: product.measurements || [],
            m2_available_widths: product.m2_available_widths || [],
            m2_calculator_active: product.m2_calculator_active || false,
            gardin_measurements: product.gardin_measurements || [],
            gardin_calculator_active: product.gardin_calculator_active || false,
            // ⬇️ BUNLARI EKLE
            card_badge: product.card_badge || '',
            card_badge_secondary: product.card_badge_secondary || ''
        };

        return createProductCard(cardProduct, true);
    }).join('');

    initLazyImages();
        
        // Wishlist butonlarını override et: favorilerden kaldır
        grid.querySelectorAll('.wishlist-btn').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                removeFromWishlist(newBtn.dataset.productId);
            });
        });

        // Başlıklara link ekle (createProductCard düz başlık üretiyor)
        grid.querySelectorAll('.product-card').forEach((card, index) => {
            const product = products[index];
            if (!product || !product.slug) return;
            
            const titleEl = card.querySelector('.product-title');
            if (titleEl) {
                const link = document.createElement('a');
                link.href = `/produkt/${product.slug}`;
                link.style.cssText = 'text-decoration:none; color:inherit; display:block;';
                link.innerHTML = titleEl.innerHTML;
                titleEl.innerHTML = '';
                titleEl.appendChild(link);
            }
        });

        countText.textContent = `Du har ${products.length} sparade produkter.`;
    }
});

// Global fonksiyon - HTML onclick'ten erisim icin
function removeFromWishlist(productId) {
    console.log('removeFromWishlist cagrildi, ID:', productId, 'tip:', typeof productId);

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
            const remaining = document.querySelectorAll('.product-card');
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