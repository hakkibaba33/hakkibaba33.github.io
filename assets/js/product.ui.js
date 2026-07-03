document.addEventListener('DOMContentLoaded', async () => {
    // 1. URL'den slug degerini al
    // Vercel rewrite: /matta/xxx -> product.html?slug=xxx
    let slug = null;
    
    // Once query string'den dene
    const urlParams = new URLSearchParams(window.location.search);
    slug = urlParams.get('slug');
    
    // Yoksa path'den al: /matta/xxx
    if (!slug) {
        const pathParts = window.location.pathname.split('/').filter(p => p);
        slug = pathParts[pathParts.length - 1];
    }

    if (!slug || slug === 'product.html') {
        console.error("Slug bulunamadi! URL:", window.location.href);
        return;
    }
    
    console.log("Slug bulundu:", slug);

    // 2. Airtable'dan slug ile filtreleyerek veriyi cek
    const url = `https://api.airtable.com/v0/${CONFIG.AIRTABLE.BASE_ID}/${CONFIG.AIRTABLE.TABLE_NAME}?filterByFormula=Slug='${slug}'`;

    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${CONFIG.AIRTABLE.API_KEY}` }
        });
        const result = await response.json();

        if (result.records.length === 0) {
            console.error("Bu slug ile eslesen urun bulunamadi!");
            return;
        }

        const product = result.records[0];
        const f = product.fields;

        // 3. Verileri HTML'e yerlestir
        document.getElementById('page-title-product-name').innerText = f.Name;
        document.getElementById('breadcrumb-product-name').innerText = f.Name;
        document.getElementById('product-main-name-desktop').innerText = f.Name;
        document.getElementById('product-price').innerText = f.Price + " SEK";
        document.getElementById('product-description').innerHTML = f.Description;

        // Gorsel varsa ekle
        if (f.imageURL) {
            document.getElementById('product-images-container').innerHTML = 
                `<img src="${f.imageURL[0].url}" alt="${f.Name}" style="width:100%;">`;
        }

        // 4. Sepete Ekle Butonu
        const addToCartBtn = document.getElementById('add-to-cart-btn');
        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', () => {
                // common.js fonksiyonlari varsa kullan
                if (typeof addProductToCart === 'function') {
                    addProductToCart({
                        id: product.id,
                        name: f.Name,
                        price: parseFloat(f.Price) || 0,
                        image: f.imageURL ? f.imageURL[0].url : '',
                        variants: f.Variants || 'Standard',
                        delivery: f.Delivery_time || ''
                    });
                } else {
                    // Fallback: Manuel ekle
                    const cartItem = {
                        id: product.id,
                        name: f.Name,
                        price: parseFloat(f.Price) || 0,
                        image: f.imageURL ? f.imageURL[0].url : '',
                        variants: f.Variants || 'Standard',
                        delivery: f.Delivery_time || '',
                        quantity: 1
                    };

                    let cart = JSON.parse(localStorage.getItem('siteCartItems')) || [];
                    const existing = cart.find(i => i.id === product.id);
                    if (existing) {
                        existing.quantity = (existing.quantity || 1) + 1;
                    } else {
                        cart.push(cartItem);
                    }
                    localStorage.setItem('siteCartItems', JSON.stringify(cart));

                    if (typeof updateMiniCartUI === 'function') updateMiniCartUI();
                    if (typeof updateCartBadge === 'function') updateCartBadge();
                    if (typeof openMiniCart === 'function') {
                        openMiniCart();
                    } else {
                        const overlay = document.getElementById('mini-cart-overlay');
                        if (overlay) {
                            overlay.classList.add('open');
                            document.body.classList.add('cart-open');
                        }
                    }
                }
            });
        }

    } catch (error) {
        console.error("Airtable'dan veri cekilirken hata olustu:", error);
    }
});