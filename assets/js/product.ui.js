// ==========================================
// PRODUCT.UI.JS - Tekrar çalışmayı engelleyen flag
// ==========================================

// GLOBAL FLAG: Bu sayfa zaten init edildiyse tekrar çalıştırma
if (window.__productPageInitialized) {
    console.log("⚠️ product.ui.js zaten çalıştırılmış, atlanıyor.");
} else {
    window.__productPageInitialized = true;

    async function initProductPage() {
        console.log("🚀 Ürün sayfası init başlıyor...");

        // 1. URL'den slug değerini al
        let slug = null;
        
        const urlParams = new URLSearchParams(window.location.search);
        slug = urlParams.get('slug');
        
        if (!slug) {
            const pathParts = window.location.pathname.split('/').filter(p => p);
            slug = pathParts[pathParts.length - 1];
        }

        if (!slug || slug === 'product.html') {
            console.error("❌ Slug bulunamadı! URL:", window.location.href);
            return;
        }
        
        console.log("✅ Slug bulundu:", slug);

        // 2. Airtable'dan veriyi çek
        const url = `https://api.airtable.com/v0/${CONFIG.AIRTABLE.BASE_ID}/${CONFIG.AIRTABLE.TABLE_NAME}?filterByFormula=Slug='${slug}'`;

        try {
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${CONFIG.AIRTABLE.API_KEY}` }
            });
            const result = await response.json();

            if (result.records.length === 0) {
                console.error("❌ Bu slug ile eşleşen ürün bulunamadı!");
                return;
            }

            const product = result.records[0];
            const f = product.fields;

            // 3. Verileri HTML'e yerleştir - ÖNCE içeriği temizle, sonra ekle
            // Bu, tekrar eden içerikleri engeller
            
            const titleEl = document.getElementById('page-title-product-name');
            const breadcrumbEl = document.getElementById('breadcrumb-product-name');
            const nameEl = document.getElementById('product-main-name-desktop');
            const priceEl = document.getElementById('product-price');
            const descEl = document.getElementById('product-description');
            const imgContainer = document.getElementById('product-images-container');

            if (titleEl) titleEl.innerText = f.Name;
            if (breadcrumbEl) breadcrumbEl.innerText = f.Name;
            if (nameEl) nameEl.innerText = f.Name;
            if (priceEl) {
                priceEl.innerText = f.Price + " SEK";
                priceEl.classList.remove('not-loaded');
                priceEl.classList.add('loaded');
            }
            if (descEl) {
                descEl.innerHTML = ''; // Önce temizle
                descEl.innerHTML = f.Description;
            }

            // Görsel varsa ekle
            if (f.imageURL && imgContainer) {
                imgContainer.innerHTML = ''; // Önce temizle
                imgContainer.innerHTML = 
                    `<img src="${f.imageURL[0].url}" alt="${f.Name}" style="width:100%;">`;
            }

            // 4. Sepete Ekle Butonu
            const addToCartBtn = document.getElementById('add-to-cart-btn');
            if (addToCartBtn) {
                // Önceki listener'ları temizle (tekrar binding'i engelle)
                const newBtn = addToCartBtn.cloneNode(true);
                addToCartBtn.parentNode.replaceChild(newBtn, addToCartBtn);
                
                newBtn.addEventListener('click', () => {
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

            console.log("✅ Ürün sayfası başarıyla yüklendi:", f.Name);

        } catch (error) {
            console.error("❌ Airtable'dan veri çekilirken hata:", error);
        }
    }

    // DOM hazır olduğunda çalıştır
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProductPage);
    } else {
        initProductPage();
    }
}