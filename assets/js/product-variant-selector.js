// ==========================================
// ÜRÜN SAYFASI - RENK & BOYUT SEÇİM SİSTEMİ
// ==========================================

class ProductVariantSelector {
    constructor(productData) {
        this.product = productData;
        this.selectedColor = null;
        this.selectedSize = null;
        this.selectedVariant = null;

        this.init();
    }

    init() {
        this.renderColorSelector();
        this.bindEvents();
    }

    // Renk seçiciyi render et
    renderColorSelector() {
        const container = document.getElementById('color-selector');
        if (!container) return;

        // Üründeki benzersiz renkleri al
        const colors = [...new Set(this.product.variants.map(v => v.color).filter(Boolean))];

        if (colors.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.innerHTML = `
            <div class="variant-section">
                <h3 class="variant-title">Välj färg</h3>
                <div class="color-options">
                    ${colors.map(color => `
                        <button class="color-btn ${color === this.selectedColor ? 'active' : ''}" 
                                data-color="${color}"
                                title="${this.getColorLabel(color)}">
                            <span class="color-swatch ${color}"></span>
                            <span class="color-label">${this.getColorLabel(color)}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Boyut seçiciyi render et (renk seçildikten sonra)
    renderSizeSelector() {
        const container = document.getElementById('size-selector');
        if (!container) return;

        if (!this.selectedColor) {
            container.innerHTML = '<p class="variant-hint">Välj en färg först</p>';
            return;
        }

        // Seçili renge ait varyasyonları al
        const variants = this.product.variants.filter(v => v.color === this.selectedColor);

        container.innerHTML = `
            <div class="variant-section">
                <h3 class="variant-title">Välj storlek</h3>
                <div class="size-options">
                    ${variants.map(v => `
                        <button class="size-btn ${v.stock <= 0 ? 'out-of-stock' : ''} ${v.size === this.selectedSize ? 'active' : ''}"
                                data-size="${v.size}"
                                data-stock="${v.stock}"
                                ${v.stock <= 0 ? 'disabled' : ''}>
                            <span class="size-label">${v.size}</span>
                            <span class="size-price">${v.price} SEK</span>
                            ${v.stock <= 0 ? '<span class="stock-badge">Slutsåld</span>' : 
                              v.stock <= 3 ? '<span class="stock-badge low">Få kvar</span>' : ''}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Fiyat ve stok bilgisini güncelle
    updateProductInfo() {
        const priceEl = document.getElementById('product-price');
        const stockEl = document.getElementById('product-stock');
        const addToCartBtn = document.getElementById('add-to-cart-btn');

        if (this.selectedVariant) {
            // Fiyat göster
            const hasDiscount = this.selectedVariant.discount_price && 
                               this.selectedVariant.discount_price < this.selectedVariant.price;

            if (priceEl) {
                priceEl.innerHTML = hasDiscount 
                    ? `<span class="old-price">${this.selectedVariant.price} SEK</span>
                       <span class="current-price">${this.selectedVariant.discount_price} SEK</span>`
                    : `<span class="current-price">${this.selectedVariant.price} SEK</span>`;
            }

            // Stok göster
            if (stockEl) {
                stockEl.innerHTML = this.selectedVariant.stock > 0 
                    ? `<span class="in-stock">✓ I lager (${this.selectedVariant.stock} st)</span>`
                    : `<span class="out-stock">✗ Slutsåld</span>`;
            }

            // Sepet butonu
            if (addToCartBtn) {
                addToCartBtn.disabled = this.selectedVariant.stock <= 0;
                addToCartBtn.textContent = this.selectedVariant.stock > 0 
                    ? 'Lägg i varukorg' 
                    : 'Slutsåld';
            }

            // Görselleri güncelle (renk bazlı)
            this.updateImages();
        }
    }

    // Renk bazlı görselleri göster
    updateImages() {
        const gallery = document.getElementById('product-gallery');
        if (!gallery || !this.selectedColor) return;

        // Renk bazlı görselleri filtrele (örnek: product-red-1.jpg)
        const colorImages = this.product.images.filter(img => 
            img.toLowerCase().includes(this.selectedColor.toLowerCase())
        );

        // Eğer renk bazlı görsel yoksa tüm görselleri göster
        const imagesToShow = colorImages.length > 0 ? colorImages : this.product.images;

        // Galeriyi güncelle (basit implementasyon)
        gallery.innerHTML = imagesToShow.map((img, i) => `
            <img src="${img}" alt="${this.product.name} - ${this.selectedColor}" 
                 class="gallery-img ${i === 0 ? 'active' : ''}" data-index="${i}">
        `).join('');
    }

    // Event binding
    bindEvents() {
        document.addEventListener('click', (e) => {
            // Renk seçimi
            if (e.target.closest('.color-btn')) {
                const btn = e.target.closest('.color-btn');
                const color = btn.dataset.color;

                if (this.selectedColor === color) return;

                this.selectedColor = color;
                this.selectedSize = null;
                this.selectedVariant = null;

                // Aktif sınıfını güncelle
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Boyut seçiciyi güncelle
                this.renderSizeSelector();
                this.updateProductInfo();
            }

            // Boyut seçimi
            if (e.target.closest('.size-btn')) {
                const btn = e.target.closest('.size-btn');
                if (btn.disabled) return;

                const size = btn.dataset.size;
                this.selectedSize = size;

                // Varyasyonu bul
                this.selectedVariant = this.product.variants.find(v => 
                    v.color === this.selectedColor && v.size === size
                );

                // Aktif sınıfını güncelle
                document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                this.updateProductInfo();
            }
        });
    }

    // Renk etiketini getir
    getColorLabel(color) {
        const labels = {
            'röd': 'Röd',
            'blå': 'Blå',
            'grön': 'Grön',
            'beige': 'Beige',
            'grå': 'Grå',
            'svart': 'Svart',
            'vit': 'Vit',
            'brun': 'Brun',
            'gul': 'Gul',
            'orange': 'Orange',
            'rosa': 'Rosa',
            'lila': 'Lila',
            'turkos': 'Turkos'
        };
        return labels[color] || color;
    }

    // Sepete ekle için veri hazırla
    getCartData() {
        if (!this.selectedVariant) {
            alert('Välj färg och storlek först');
            return null;
        }

        return {
            product_id: this.product.id,
            variant_id: this.selectedVariant.id,
            name: this.product.name,
            color: this.selectedColor,
            size: this.selectedSize,
            price: this.selectedVariant.discount_price || this.selectedVariant.price,
            image: this.product.images[0]
        };
    }
}

// Kullanım:
// const selector = new ProductVariantSelector(productData);
// const cartData = selector.getCartData();