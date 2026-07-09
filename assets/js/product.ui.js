// ==========================================
// PRODUCT.UI.JS - v4.0 (TEMİZ)
// ==========================================

if (window.__productPageInitialized) {
    console.log("product.ui.js zaten calistirilmis.");
} else {
    window.__productPageInitialized = true;

    const SUPABASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE) ? CONFIG.SUPABASE.URL : '';
    const SUPABASE_KEY = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE) ? CONFIG.SUPABASE.ANON_KEY : '';

    async function supabaseGet(endpoint, params) {
        const url = new URL(SUPABASE_URL + '/rest/v1/' + endpoint);
        if (params) Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        const res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY,
                'Content-Type': 'application/json'
            }
        });
        if (!res.ok) throw new Error('Supabase hatasi: ' + res.status);
        return res.json();
    }

    // ==========================================
    // GLOBAL: ID'den slug'a yönlendirme
    // ==========================================
    window.redirectFromIdToSlug = async function(productId) {
        try {
            const products = await supabaseGet('products', {
                id: 'eq.' + String(productId),
                select: 'slug'
            });

            if (products.length > 0 && products[0].slug) {
                window.location.replace('/produkt/' + encodeURIComponent(products[0].slug));
            } else {
                window.location.href = '/404.html';
            }
        } catch (e) {
            console.error("Yonlendirme hatasi:", e);
            window.location.href = '/404.html';
        }
    };

    // ==========================================
    // ANA FONKSİYON
    // ==========================================
    async function initProductPage() {
        console.log("=== URUN SAYFASI INIT ===");
        console.log("URL:", window.location.href);

        const urlParams = new URLSearchParams(window.location.search);
        const pathParts = window.location.pathname.split('/').filter(p => p);

        let slug = null;

        // Durum 1: /produkt/?id=123 (eski format)
        const idParam = urlParams.get('id');
        if (idParam && pathParts[0] === 'produkt' && !pathParts[1]) {
            console.log("Eski ID formati, yonlendiriliyor...");
            await window.redirectFromIdToSlug(idParam);
            return;
        }

        // Durum 2: /produkt/urun-slug (yeni format)
        if (pathParts.length >= 2 && pathParts[0] === 'produkt') {
            slug = decodeURIComponent(pathParts[1]);
            console.log("Slug bulundu:", slug);
        }

        // Slug yoksa hata
        if (!slug || slug === 'index.html') {
            console.error("Slug bulunamadi!");
            showError("Produkt hittades inte.");
            return;
        }

        // Ürünü çek
        try {
            const products = await supabaseGet('products', {
                slug: 'eq.' + slug,
                select: '*'
            });

            if (!products || products.length === 0) {
                showError("Produkt hittades inte.");
                return;
            }

            const product = products[0];
            console.log("Urun bulundu:", product.name);

            // Sayfayı doldur
            fillProductPage(product);

        } catch (error) {
            console.error("Urun yukleme hatasi:", error);
            showError("Ett fel uppstod.");
        }
    }

    function fillProductPage(product) {
        // Başlık
        document.title = product.name + ' | DKRUG';
        
        const nameEl = document.getElementById('product-name');
        if (nameEl) nameEl.textContent = product.name;

        // Fiyat
        const priceEl = document.getElementById('product-price');
        if (priceEl) {
            if (product.discount_price && product.discount_price < product.base_price) {
                priceEl.innerHTML = `
                    <span style="text-decoration:line-through;color:#999;">${product.base_price} SEK</span>
                    <span style="color:#e54d42;font-size:24px;font-weight:bold;margin-left:8px;">${product.discount_price} SEK</span>
                `;
            } else {
                priceEl.textContent = (product.base_price || 0) + " SEK";
            }
        }

        // Açıklama
        const descEl = document.getElementById('product-description');
        if (descEl) descEl.innerHTML = product.description || '';

        // Görseller
        const gallery = document.getElementById('product-gallery');
        if (gallery && product.images) {
            gallery.innerHTML = product.images.map((img, i) => `
                <img src="${img}" alt="${product.name} ${i+1}" class="gallery-img" onclick="openLightbox(${i})">
            `).join('');
        }

        // Sepete ekle butonu
        const addBtn = document.getElementById('add-to-cart-btn');
        if (addBtn) {
            addBtn.onclick = () => {
                if (typeof addProductToCart === 'function') {
                    addProductToCart({
                        id: product.id,
                        name: product.name,
                        price: product.discount_price || product.base_price || 0,
                        image: product.images && product.images[0] ? product.images[0] : '',
                        variants: 'Standard',
                        delivery: product.delivery_time || '3-7 arbetsdagar'
                    });
                }
            };
        }
    }

    function showError(msg) {
        const container = document.querySelector('.product-page') || document.body;
        container.innerHTML = `<div style="text-align:center;padding:60px;"><p>${msg}</p><a href="/">Tillbaka till startsidan</a></div>`;
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
