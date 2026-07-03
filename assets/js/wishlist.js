// ==========================================
// WISHLIST.JS - AIRTABLE UYUMLU
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('wishlist-grid');
    const emptyState = document.getElementById('wishlist-empty');
    const countText = document.getElementById('wishlist-count-text');

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
    const wishlistIds = wishlistItems.map(item => item.id).filter(Boolean);

    if (wishlistIds.length === 0) {
        showEmptyState();
        return;
    }

    // Airtable'dan urunleri cek
    try {
        // ID'lere gore filtreleme formulu
        const filterFormula = `OR(${wishlistIds.map(id => `RECORD_ID()='${id}'`).join(',')})`;
        const url = `https://api.airtable.com/v0/${CONFIG.AIRTABLE.BASE_ID}/${CONFIG.AIRTABLE.TABLE_NAME}?filterByFormula=${encodeURIComponent(filterFormula)}`;

        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${CONFIG.AIRTABLE.API_KEY}` }
        });

        if (!response.ok) throw new Error('API hatasi: ' + response.status);

        const data = await response.json();
        const products = data.records.map(r => ({
            id: r.id,
            name: r.fields.Name || 'Urun',
            price: parseFloat(r.fields.Price) || 0,
            image: r.fields.imageURL && r.fields.imageURL[0] ? r.fields.imageURL[0].url : '',
            slug: r.fields.Slug || '',
            variants: r.fields.Variants || 'Standard'
        }));

        if (products.length === 0) {
            showEmptyState();
            return;
        }

        renderProducts(products);
        countText.textContent = `Du har ${products.length} sparade produkter.`;

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
        grid.innerHTML = products.map(product => `
            <div class="product-item-wrapper" data-id="${product.id}">
                <div class="product-card">
                    <div class="image-box">
                        <a href="/matta/${slug}">
                            <img src="${product.image}" 
                                 alt="${product.name}" 
                                 loading="lazy"
                                 onerror="this.style.display='none'"
                                 style="width:100%; height:100%; object-fit:cover;">
                        </a>
                        <button class="wishlist-btn active" 
                                data-product-id="${product.id}"
                                onclick="removeFromWishlist('${product.id}')">
                            <i class="fa-solid fa-heart"></i>
                        </button>
                    </div>
                    <div class="product-info">
                        <h3 class="product-title">${product.name}</h3>
                        <div class="product-meta-row">
                            <span class="product-acf-dimension">${product.variants}</span>
                        </div>
                        <div class="product-price">
                            <span class="current-price">${product.price.toLocaleString('sv-SE')} SEK</span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }
});

// Global fonksiyon - HTML onclick'ten erisim icin
function removeFromWishlist(productId) {
    // localStorage'dan kaldir
    let wishlist = JSON.parse(localStorage.getItem('wishlistItems')) || [];
    wishlist = wishlist.filter(item => {
        const id = typeof item === 'string' ? item : item.id;
        return id !== productId;
    });
    localStorage.setItem('wishlistItems', JSON.stringify(wishlist));

    // Karti animasyonlu kaldir
    const card = document.querySelector(`[data-id="${productId}"]`);
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
    }
}