// ==========================================
// PRODUCT CALCULATOR v2.0 - Admin Panel Uyumlu
// Halı (M²) ve Perde (Gardin) Hesaplayıcı
// Supabase entegrasyonlu - Admin panel veri yapısına uygun
// ==========================================

window.ProductCalculator = (function() {

    const state = {
        calculatorType: null, // 'm2' veya 'gardin'
        product: null,

        // Halı state
        m2: {
            en: 0,
            boy: 0,
            calculatedM2: 0,
            totalPrice: 0,
            quantity: 1,
            form: 'Rektangulär',
            maxStock: 999
        },

        // Perde state
        gardin: {
            en: 0,
            boy: 300,
            metre: 0,
            totalPrice: 0,
            quantity: 1,
            suspensionType: 'gardinskena',
            customerNote: '',
            pileRatio: 3.0
        },

        isCalculated: false
    };

    // Para formatı
    const formatCurrency = (num) => {
        if (!num || isNaN(num)) return '0 kr';
        return Math.round(parseFloat(num)).toLocaleString('sv-SE').replace(',', ' ') + ' kr';
    };

    // Bildirim göster
    const notify = (message, type = 'error') => {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    };

    // ==========================================
    // HELPER FONKSİYONLAR
    // ==========================================

    // ✅ ADMIN PANEL UYUMLU: Fiyat hesaplama
    // Admin panelde: m2_price_per_m2 (halı) veya gardin_meter_price (perde)
    const getUnitPrice = (product) => {
        if (!product) return 0;

        // Önce hesaplayıcıya özel fiyatı kontrol et
        if (state.calculatorType === 'm2' && product.m2_price_per_m2) {
            return parseFloat(product.m2_price_per_m2);
        }
        if (state.calculatorType === 'gardin' && product.gardin_meter_price) {
            return parseFloat(product.gardin_meter_price);
        }

        // Yoksa genel fiyatları kullan
        return parseFloat(product.discount_price || product.base_price || product.price || 0);
    };

    const getRegularUnitPrice = (product) => {
        if (!product) return 0;

        // Önce hesaplayıcıya özel fiyatı kontrol et
        if (state.calculatorType === 'm2' && product.m2_price_per_m2) {
            return parseFloat(product.m2_price_per_m2);
        }
        if (state.calculatorType === 'gardin' && product.gardin_meter_price) {
            return parseFloat(product.gardin_meter_price);
        }

        return parseFloat(product.base_price || product.price || 0);
    };

    // Sepete ekle butonunu güncelle
    const updateCartButton = (enabled, text = null) => {
        const btn = document.getElementById('add-to-cart-btn');
        if (!btn) return;

        btn.disabled = !enabled;
        btn.style.opacity = enabled ? '1' : '0.5';
        btn.style.pointerEvents = enabled ? 'auto' : 'none';

        if (text) {
            btn.textContent = text;
        } else {
            btn.textContent = enabled ? 'LÄGG I VARUKORG' : 'Ange mått';
        }
    };

    // Fiyat gösterimini güncelle
    const updatePriceDisplay = (price, regularPrice = null) => {
        const priceEl = document.getElementById('product-price');
        if (!priceEl) return;

        const hasDiscount = regularPrice && regularPrice > price;

        if (hasDiscount) {
            priceEl.innerHTML = `
                <span class="original-price">${formatCurrency(regularPrice)}</span>
                <span class="current-price price-discount">${formatCurrency(price)}</span>
            `;
        } else {
            priceEl.innerHTML = `<span class="current-price">${formatCurrency(price)}</span>`;
        }
    };

    // ==========================================
    // HALI (M²) HESAPLAYICI
    // ==========================================

    const renderMattaForm = (container, product) => {
        state.calculatorType = 'm2';
        state.product = product;

        // ✅ ADMIN PANEL UYUMLU: Veri yapısı
        const availableWidths = product.m2_available_widths || [];
        const minBoy = product.m2_min_length || 0;

        let widthOptions = '<option value="">Välj bredd</option>';
        if (Array.isArray(availableWidths) && availableWidths.length > 0) {
            widthOptions += availableWidths.map(w => `<option value="${w}">${w} cm</option>`).join('');
        }

        container.innerHTML = `
            <div class="calc-accordion-box matta-box" id="matta-calc-box">
                <button type="button" class="calc-accordion-header" id="matta-accordion-toggle" aria-expanded="false">
                    <div class="accordion-left">
                        <i class="fa-solid fa-ruler-combined"></i>
                        <div class="accordion-title-group">
                            <span class="accordion-title">Måttanpassa din matta</span>
                            <span class="accordion-subtitle" id="matta-accordion-subtitle">Ange dina mått för att beräkna pris</span>
                        </div>
                    </div>
                    <div class="accordion-right">
                        <span class="accordion-status" id="matta-accordion-status"></span>
                        <i class="fa-solid fa-chevron-down accordion-chevron"></i>
                    </div>
                </button>

                <div class="calc-accordion-content" id="matta-accordion-content">
                    <div class="accordion-inner">

                        <div class="form-selector">
                            <label class="form-label">Välj form</label>
                            <div class="form-options-grid">
                                ${['Rektangulär', 'Oval', 'Rund'].map(form => {
                                    let svgPath = '';
                                    if(form === 'Rektangulär') svgPath = '<rect x="3" y="6" width="18" height="12" rx="1" />';
                                    if(form === 'Oval') svgPath = '<ellipse cx="12" cy="12" rx="10" ry="6" />';
                                    if(form === 'Rund') svgPath = '<circle cx="12" cy="12" r="9" />';

                                    return `
                                        <label class="form-option">
                                            <input type="radio" name="rug-form" value="${form}" ${form === 'Rektangulär' ? 'checked' : ''}>
                                            <div class="option-content">
                                                <svg class="shape-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><g stroke-linecap="round" stroke-linejoin="round">${svgPath}</g></svg>
                                                <span>${form}</span>
                                            </div>
                                        </label>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        <div class="input-grid">
                            <div class="input-group">
                                <label class="form-label">Bredd (cm)</label>
                                <select id="m2-en" class="premium-input">
                                    ${widthOptions}
                                </select>
                            </div>
                            <div class="input-group">
                                <label class="form-label">Längd (cm)</label>
                                <input type="number" id="m2-boy" class="premium-input" placeholder="Min: ${minBoy} cm" min="${minBoy}">
                            </div>
                        </div>

                        <div class="quantity-section">
                            <label class="form-label">ANTAL</label>
                            <div class="quantity-row">
                                <div class="qty-stepper">
                                    <button type="button" id="m2-qty-minus" aria-label="Minska antal">−</button>
                                    <input type="number" id="m2-qty" value="1" min="1" readonly aria-label="Antal">
                                    <button type="button" id="m2-qty-plus" aria-label="Öka antal">+</button>
                                </div>
                                <span class="qty-label">st matta</span>
                            </div>
                        </div>

                        <div id="m2-live-summary" class="live-summary"></div>

                        <div class="form-actions">
                            <button type="button" id="m2-calc-btn" class="calc-btn-primary">BERÄKNA PRIS</button>
                            <button type="button" id="m2-reset-btn" class="calc-btn-secondary">TA BORT</button>
                        </div>

                        <div id="m2-summary" class="calc-summary"></div>

                    </div>
                </div>
            </div>
        `;

        initMattaEvents(product);
        updateCartButton(false);
    };

    const initMattaEvents = (product) => {
        const toggle = document.getElementById('matta-accordion-toggle');
        const content = document.getElementById('matta-accordion-content');

        toggle.addEventListener('click', () => {
            const isOpen = content.classList.contains('open');
            if (isOpen) {
                content.classList.remove('open');
                toggle.classList.remove('active');
                toggle.setAttribute('aria-expanded', 'false');
            } else {
                content.classList.add('open');
                toggle.classList.add('active');
                toggle.setAttribute('aria-expanded', 'true');
            }
        });

        document.querySelectorAll('input[name="rug-form"]').forEach(input => {
            input.addEventListener('change', (e) => {
                state.m2.form = e.target.value;
                const boyInput = document.getElementById('m2-boy');
                const enInput = document.getElementById('m2-en');

                if (e.target.value === 'Rund') {
                    if (enInput.value) boyInput.value = enInput.value;
                    boyInput.readOnly = true;
                    boyInput.style.backgroundColor = '#f5f5f5';
                } else {
                    boyInput.readOnly = false;
                    boyInput.style.backgroundColor = '#fff';
                }
            });
        });

        document.getElementById('m2-en').addEventListener('change', (e) => {
            const selectedForm = document.querySelector('input[name="rug-form"]:checked')?.value;
            if (selectedForm === 'Rund') {
                document.getElementById('m2-boy').value = e.target.value;
            }
        });

        const qtyInput = document.getElementById('m2-qty');
        document.getElementById('m2-qty-plus').addEventListener('click', () => {
            qtyInput.value = parseInt(qtyInput.value) + 1;
            state.m2.quantity = parseInt(qtyInput.value);
        });
        document.getElementById('m2-qty-minus').addEventListener('click', () => {
            if (parseInt(qtyInput.value) > 1) {
                qtyInput.value = parseInt(qtyInput.value) - 1;
                state.m2.quantity = parseInt(qtyInput.value);
            }
        });

        document.getElementById('m2-calc-btn').addEventListener('click', () => {
            calculateMatta(product);
        });

        document.getElementById('m2-reset-btn').addEventListener('click', () => {
            resetMattaForm(product);
        });
    };

    const calculateMatta = (product) => {
        const en = parseFloat(document.getElementById('m2-en').value);
        const boy = parseFloat(document.getElementById('m2-boy').value);
        const qty = parseInt(document.getElementById('m2-qty').value) || 1;
        const summaryEl = document.getElementById('m2-summary');
        const liveSummary = document.getElementById('m2-live-summary');
        const minBoy = parseFloat(product.m2_min_length || 0);

        if (!en || en <= 0) {
            notify('Välj en bredd', 'warning');
            updateCartButton(false);
            return;
        }
        if (!boy || boy <= 0) {
            notify('Ange en giltig längd', 'warning');
            updateCartButton(false);
            return;
        }
        if (boy < minBoy) {
            notify(`Minsta längd är ${minBoy} cm`, 'warning');
            updateCartButton(false);
            return;
        }

        // M² hesapla
        const m2 = (en / 100) * (boy / 100);

        // ✅ ADMIN PANEL UYUMLU: m2_price_per_m2 kullan
        const unitPrice = getUnitPrice(product);
        const regularUnitPrice = getRegularUnitPrice(product);

        const totalPrice = Math.round(m2 * unitPrice * qty);
        const totalRegularPrice = Math.round(m2 * regularUnitPrice * qty);

        // Stok kontrolü
        const maxStock = parseFloat(product.m2_stock_per_width?.[String(en)] || product.max_stock || 999);
        const requestedM2 = m2 * qty;

        if (requestedM2 > maxStock) {
            notify(`Endast ${maxStock.toFixed(2)} m² tillgängligt. Ditt val kräver ${requestedM2.toFixed(2)} m².`, 'error');
            updateCartButton(false);
            return;
        }

        state.m2 = {
            en: en,
            boy: boy,
            calculatedM2: m2,
            totalPrice: totalPrice,
            quantity: qty,
            form: document.querySelector('input[name="rug-form"]:checked')?.value || 'Rektangulär',
            maxStock: maxStock
        };
        state.isCalculated = true;

        const hasDiscount = totalRegularPrice > totalPrice;
        summaryEl.innerHTML = `
            <div class="summary-row">
                <span>Form:</span>
                <strong>${state.m2.form}</strong>
            </div>
            <div class="summary-row">
                <span>Mått:</span>
                <strong>${en} × ${boy} cm</strong>
            </div>
            <div class="summary-row">
                <span>Yta:</span>
                <strong>${m2.toFixed(2)} m²</strong>
            </div>
            <div class="summary-row">
                <span>Antal:</span>
                <strong>${qty} st</strong>
            </div>
            <hr class="summary-divider">
            <div class="summary-total">
                <span><strong>Totalt:</strong></span>
                <strong class="total-price ${hasDiscount ? 'has-discount' : ''}">
                    ${hasDiscount ? `<span class="original-price">${formatCurrency(totalRegularPrice)}</span>` : ''}
                    ${formatCurrency(totalPrice)}
                </strong>
            </div>
        `;
        summaryEl.classList.add('visible');

        liveSummary.innerHTML = `<strong>${en}×${boy} cm</strong> | ${m2.toFixed(2)} m² | ${formatCurrency(totalPrice)}`;
        liveSummary.classList.add('visible');

        const subtitle = document.getElementById('matta-accordion-subtitle');
        const status = document.getElementById('matta-accordion-status');
        if (subtitle) subtitle.textContent = `${en}×${boy} cm | ${state.m2.form} | ${formatCurrency(totalPrice)}`;
        if (status) {
            status.textContent = 'Pris beräknat';
            status.style.display = 'inline';
        }

        updatePriceDisplay(totalPrice, hasDiscount ? totalRegularPrice : null);
        updateCartButton(true);
        notify('Pris beräknat! Klicka på "Lägg i varukorg" för att fortsätta.', 'success');

        const calcBtn = document.getElementById('m2-calc-btn');
        if (calcBtn) {
            calcBtn.classList.add('calculated');
            calcBtn.innerHTML = 'PRIS BERÄKNAT <i class="fa-solid fa-check"></i>';
        }
    };

    const resetMattaForm = (product) => {
        document.getElementById('m2-en').value = '';
        const boyInput = document.getElementById('m2-boy');
        boyInput.value = '';
        boyInput.readOnly = false;
        boyInput.style.backgroundColor = '#fff';

        document.getElementById('m2-qty').value = '1';

        const rectRadio = document.querySelector('input[name="rug-form"][value="Rektangulär"]');
        if (rectRadio) rectRadio.checked = true;

        document.getElementById('m2-summary').classList.remove('visible');
        document.getElementById('m2-summary').innerHTML = '';
        document.getElementById('m2-live-summary').classList.remove('visible');
        document.getElementById('m2-live-summary').innerHTML = '';

        const calcBtn = document.getElementById('m2-calc-btn');
        if (calcBtn) {
            calcBtn.classList.remove('calculated');
            calcBtn.textContent = 'BERÄKNA PRIS';
        }

        const subtitle = document.getElementById('matta-accordion-subtitle');
        const status = document.getElementById('matta-accordion-status');
        if (subtitle) subtitle.textContent = 'Ange dina mått för att beräkna pris';
        if (status) status.style.display = 'none';

        state.m2 = {
            en: 0, boy: 0, calculatedM2: 0, totalPrice: 0,
            quantity: 1, form: 'Rektangulär', maxStock: state.m2.maxStock
        };
        state.isCalculated = false;

        updateCartButton(false);

        const unitPrice = getUnitPrice(product);
        const regularPrice = getRegularUnitPrice(product);
        updatePriceDisplay(unitPrice, regularPrice > unitPrice ? regularPrice : null);
    };

    // ==========================================
    // PERDE (GARDIN) HESAPLAYICI
    // ==========================================

    const renderGardinForm = (container, product) => {
        state.calculatorType = 'gardin';
        state.product = product;

        // ✅ ADMIN PANEL UYUMLU: Veri yapısı
        const minEn = product.gardin_min_width || 50;
        const defaultBoy = product.gardin_default_height || 300;
        const maxBoy = product.gardin_max_width || 500; // Adminde max_width ama boy için kullanılıyor
        const pileFactor = product.gardin_pile_factor || 3.0;
        const kornisOptions = product.gardin_kornis_options || ['Gardinskena (Veckband)', 'Dolda hällor', 'Öljetter (Maljet)'];

        container.innerHTML = `
            <div class="calc-accordion-box gardin-box" id="gardin-calc-box">
                <button type="button" class="calc-accordion-header" id="gardin-accordion-toggle" aria-expanded="false">
                    <div class="accordion-left">
                        <i class="fa-solid fa-ruler-combined"></i>
                        <div class="accordion-title-group">
                            <span class="accordion-title">Måttanpassa din gardin</span>
                            <span class="accordion-subtitle" id="gardin-accordion-subtitle">Ange dina mått för att beräkna pris</span>
                        </div>
                    </div>
                    <div class="accordion-right">
                        <span class="accordion-status" id="gardin-accordion-status"></span>
                        <i class="fa-solid fa-chevron-down accordion-chevron"></i>
                    </div>
                </button>

                <div class="calc-accordion-content" id="gardin-accordion-content">
                    <div class="accordion-inner">

                        <div class="suspension-selector">
                            <label class="form-label">Upphängning</label>
                            <div class="suspension-options">
                                ${kornisOptions.map((opt, i) => `
                                    <label class="suspension-option">
                                        <input type="radio" name="suspension" value="${opt}" ${i === 0 ? 'checked' : ''}>
                                        <div class="suspension-card ${i === 0 ? 'active' : ''}" id="card-${opt.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}">
                                            <i class="fa-solid ${i === 0 ? 'fa-grip-lines' : (i === 1 ? 'fa-circle-notch' : 'fa-ring')}"></i>
                                            <span>${opt}</span>
                                        </div>
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <div class="input-grid">
                            <div class="input-group">
                                <label class="form-label">Bredd (cm)</label>
                                <input type="number" id="gardin-en" class="premium-input" min="${minEn}" placeholder="Min: ${minEn} cm">
                            </div>
                            <div class="input-group">
                                <label class="form-label">Höjd (cm)</label>
                                <input type="number" id="gardin-boy" class="premium-input" value="${defaultBoy}" max="${maxBoy}">
                            </div>
                        </div>

                        <div class="pile-info">
                            <i class="fa-solid fa-circle-info"></i>
                            <span>Veckning (pile) ingår med faktor ${pileFactor}x</span>
                        </div>

                        <div class="quantity-section">
                            <label class="form-label">ANTAL</label>
                            <div class="quantity-note-row">
                                <div class="qty-stepper">
                                    <button type="button" id="gardin-qty-minus" aria-label="Minska antal">−</button>
                                    <input type="number" id="gardin-qty" value="1" min="1" readonly aria-label="Antal">
                                    <button type="button" id="gardin-qty-plus" aria-label="Öka antal">+</button>
                                </div>
                                <div class="note-btn-wrapper">
                                    <button type="button" id="open-note-btn">
                                        <i class="fa-regular fa-comment-dots"></i>
                                        <span>Anteckning</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div id="note-modal" class="note-modal">
                            <div class="note-modal-inner">
                                <h4>Meddelande till skräddaren</h4>
                                <textarea id="gardin-note" placeholder="Skriv dina önskemål här..."></textarea>
                                <button type="button" id="close-note-btn">Spara</button>
                            </div>
                        </div>

                        <div id="gardin-live-summary" class="live-summary"></div>

                        <div class="form-actions">
                            <button type="button" id="gardin-calc-btn" class="calc-btn-primary">BERÄKNA PRIS</button>
                            <button type="button" id="gardin-reset-btn" class="calc-btn-secondary">TA BORT</button>
                        </div>

                        <div id="gardin-summary" class="calc-summary"></div>

                    </div>
                </div>
            </div>
        `;

        initGardinEvents(product);
        updateCartButton(false, 'Ange mått');
    };

    const initGardinEvents = (product) => {
        const toggle = document.getElementById('gardin-accordion-toggle');
        const content = document.getElementById('gardin-accordion-content');

        toggle.addEventListener('click', () => {
            const isOpen = content.classList.contains('open');
            if (isOpen) {
                content.classList.remove('open');
                toggle.classList.remove('active');
                toggle.setAttribute('aria-expanded', 'false');
            } else {
                content.classList.add('open');
                toggle.classList.add('active');
                toggle.setAttribute('aria-expanded', 'true');
            }
        });

        document.querySelectorAll('input[name="suspension"]').forEach(input => {
            input.addEventListener('change', (e) => {
                state.gardin.suspensionType = e.target.value;
                document.querySelectorAll('.suspension-card').forEach(card => card.classList.remove('active'));
                const cardId = 'card-' + e.target.value.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                const card = document.getElementById(cardId);
                if (card) card.classList.add('active');
            });
        });

        document.querySelectorAll('.suspension-card').forEach(card => {
            card.addEventListener('click', function() {
                const input = this.parentElement.querySelector('input');
                input.checked = true;
                input.dispatchEvent(new Event('change'));
            });
        });

        const qtyInput = document.getElementById('gardin-qty');
        document.getElementById('gardin-qty-plus').addEventListener('click', () => {
            qtyInput.value = parseInt(qtyInput.value) + 1;
            state.gardin.quantity = parseInt(qtyInput.value);
        });
        document.getElementById('gardin-qty-minus').addEventListener('click', () => {
            if (parseInt(qtyInput.value) > 1) {
                qtyInput.value = parseInt(qtyInput.value) - 1;
                state.gardin.quantity = parseInt(qtyInput.value);
            }
        });

        const noteBtn = document.getElementById('open-note-btn');
        const noteModal = document.getElementById('note-modal');
        const closeNoteBtn = document.getElementById('close-note-btn');

        noteBtn.addEventListener('click', () => {
            noteModal.classList.toggle('visible');
        });

        closeNoteBtn.addEventListener('click', () => {
            const noteVal = document.getElementById('gardin-note').value;
            state.gardin.customerNote = noteVal;
            noteModal.classList.remove('visible');

            if (noteVal && noteVal.trim() !== '') {
                noteBtn.classList.add('saved');
                noteBtn.innerHTML = '<i class="fa-solid fa-check"></i><span>Sparad</span>';
            } else {
                noteBtn.classList.remove('saved');
                noteBtn.innerHTML = '<i class="fa-regular fa-comment-dots"></i><span>Anteckning</span>';
            }
            updateGardinLiveSummary();
        });

        document.getElementById('gardin-en').addEventListener('input', updateGardinLiveSummary);
        document.getElementById('gardin-boy').addEventListener('input', updateGardinLiveSummary);

        document.getElementById('gardin-calc-btn').addEventListener('click', () => {
            calculateGardin(product);
        });

        document.getElementById('gardin-reset-btn').addEventListener('click', () => {
            resetGardinForm(product);
        });
    };

    const updateGardinLiveSummary = () => {
        const en = document.getElementById('gardin-en').value;
        const boy = document.getElementById('gardin-boy').value;
        const liveSummary = document.getElementById('gardin-live-summary');

        if (en > 0) {
            liveSummary.innerHTML = `<strong>${en}×${boy} cm</strong> | ${state.gardin.suspensionType}`;
            liveSummary.classList.add('visible');
        } else {
            liveSummary.classList.remove('visible');
        }
    };

    const calculateGardin = (product) => {
        const en = parseFloat(document.getElementById('gardin-en').value);
        const boy = parseFloat(document.getElementById('gardin-boy').value);
        const qty = parseInt(document.getElementById('gardin-qty').value) || 1;
        const summaryEl = document.getElementById('gardin-summary');

        // ✅ ADMIN PANEL UYUMLU: Veri yapısı
        const minEn = parseFloat(product.gardin_min_width || 50);
        const maxBoy = parseFloat(product.gardin_max_width || 500);
        const pileFactor = parseFloat(product.gardin_pile_factor || 3.0);

        if (!en || en < minEn) {
            notify(`Minsta bredd är ${minEn} cm`, 'warning');
            updateCartButton(false);
            return;
        }
        if (!boy || boy <= 0) {
            notify('Ange en giltig höjd', 'warning');
            updateCartButton(false);
            return;
        }
        if (boy > maxBoy) {
            notify(`Max höjd är ${maxBoy} cm`, 'warning');
            updateCartButton(false);
            return;
        }

        // Perde hesaplama: En × pile oranı = metre
        const metre = (en / 100) * pileFactor;

        // ✅ ADMIN PANEL UYUMLU: gardin_meter_price kullan
        const unitPrice = getUnitPrice(product);
        const regularUnitPrice = getRegularUnitPrice(product);

        const totalPrice = Math.round(metre * unitPrice * qty);
        const totalRegularPrice = Math.round(metre * regularUnitPrice * qty);

        state.gardin = {
            en: en,
            boy: boy,
            metre: metre,
            totalPrice: totalPrice,
            quantity: qty,
            suspensionType: document.querySelector('input[name="suspension"]:checked')?.value || 'Gardinskena (Veckband)',
            customerNote: state.gardin.customerNote,
            pileRatio: pileFactor
        };
        state.isCalculated = true;

        const hasDiscount = totalRegularPrice > totalPrice;
        summaryEl.innerHTML = `
            <div class="summary-row">
                <span>Bredd:</span>
                <strong>${en} cm</strong>
            </div>
            <div class="summary-row">
                <span>Höjd:</span>
                <strong>${boy} cm</strong>
            </div>
            <div class="summary-row">
                <span>Upphängning:</span>
                <strong>${state.gardin.suspensionType}</strong>
            </div>
            <div class="summary-row">
                <span>Veckning (${pileFactor}x):</span>
                <strong>${metre.toFixed(2)} m</strong>
            </div>
            <div class="summary-row">
                <span>Antal:</span>
                <strong>${qty} st</strong>
            </div>
            ${state.gardin.customerNote ? `<div class="summary-row note-row"><span>Anteckning:</span><strong>"${state.gardin.customerNote}"</strong></div>` : ''}
            <hr class="summary-divider">
            <div class="summary-total">
                <span><strong>Totalt:</strong></span>
                <strong class="total-price ${hasDiscount ? 'has-discount' : ''}">
                    ${hasDiscount ? `<span class="original-price">${formatCurrency(totalRegularPrice)}</span>` : ''}
                    ${formatCurrency(totalPrice)}
                </strong>
            </div>
        `;
        summaryEl.classList.add('visible');

        const subtitle = document.getElementById('gardin-accordion-subtitle');
        const status = document.getElementById('gardin-accordion-status');
        if (subtitle) subtitle.textContent = `${en}×${boy} cm | ${formatCurrency(totalPrice)}`;
        if (status) {
            status.textContent = 'Pris beräknat';
            status.style.display = 'inline';
        }

        updatePriceDisplay(totalPrice, hasDiscount ? totalRegularPrice : null);
        updateCartButton(true);
        notify('Pris beräknat! Klicka på "Lägg i varukorg" för att fortsätta.', 'success');

        const calcBtn = document.getElementById('gardin-calc-btn');
        if (calcBtn) {
            calcBtn.classList.add('calculated');
            calcBtn.innerHTML = 'PRIS BERÄKNAT <i class="fa-solid fa-check"></i>';
        }
    };

    const resetGardinForm = (product) => {
        const defaultBoy = product.gardin_default_height || 300;

        document.getElementById('gardin-en').value = '';
        document.getElementById('gardin-boy').value = defaultBoy;
        document.getElementById('gardin-qty').value = '1';
        document.getElementById('gardin-note').value = '';

        document.getElementById('gardin-summary').classList.remove('visible');
        document.getElementById('gardin-summary').innerHTML = '';
        document.getElementById('gardin-live-summary').classList.remove('visible');
        document.getElementById('gardin-live-summary').innerHTML = '';

        const firstKornis = document.querySelector('input[name="suspension"]');
        if (firstKornis) {
            firstKornis.checked = true;
            document.querySelectorAll('.suspension-card').forEach(card => card.classList.remove('active'));
            const firstCard = document.querySelector('.suspension-card');
            if (firstCard) firstCard.classList.add('active');
        }

        const noteBtn = document.getElementById('open-note-btn');
        if (noteBtn) {
            noteBtn.classList.remove('saved');
            noteBtn.innerHTML = '<i class="fa-regular fa-comment-dots"></i><span>Anteckning</span>';
        }

        const calcBtn = document.getElementById('gardin-calc-btn');
        if (calcBtn) {
            calcBtn.classList.remove('calculated');
            calcBtn.textContent = 'BERÄKNA PRIS';
        }

        const subtitle = document.getElementById('gardin-accordion-subtitle');
        const status = document.getElementById('gardin-accordion-status');
        if (subtitle) subtitle.textContent = 'Ange dina mått för att beräkna pris';
        if (status) status.style.display = 'none';

        state.gardin = {
            en: 0, boy: defaultBoy, metre: 0, totalPrice: 0,
            quantity: 1, suspensionType: 'gardinskena', customerNote: '', pileRatio: 3.0
        };
        state.isCalculated = false;

        updateCartButton(false, 'Ange mått');

        const unitPrice = getUnitPrice(product);
        const regularPrice = getRegularUnitPrice(product);
        updatePriceDisplay(unitPrice, regularPrice > unitPrice ? regularPrice : null);
    };

    // ==========================================
    // PUBLIC API
    // ==========================================

    return {
        init: (product) => {
            if (!product) {
                console.error('ProductCalculator: Ürün verisi gerekli');
                return;
            }

            const container = document.getElementById('calculator-insertion-point');
            if (!container) {
                console.error('ProductCalculator: #calculator-insertion-point bulunamadı');
                return;
            }

            console.log('[Calculator] Ürün verisi:', product);
            console.log('[Calculator] product_type:', product.product_type);
            console.log('[Calculator] m2_calculator_active:', product.m2_calculator_active);
            console.log('[Calculator] gardin_calculator_active:', product.gardin_calculator_active);

            // ✅ ADMIN PANEL UYUMLU: product_type ve boolean flag'ler ile kontrol
            const isM2 = product.product_type === 'm2_calculator' || product.m2_calculator_active === true;
            const isGardin = product.gardin_calculator_active === true;

            if (isGardin) {
                console.log('[Calculator] Gardin formu render ediliyor...');
                container.style.display = 'block';
                ProductCalculator.renderGardinForm(container, product);
            } else if (isM2) {
                console.log('[Calculator] M2 formu render ediliyor...');
                container.style.display = 'block';
                ProductCalculator.renderMattaForm(container, product);
            } else {
                console.log('[Calculator] Normal ürün - hesaplayıcı gösterilmiyor');
                container.style.display = 'none';
            }
        },

        // Debug için render fonksiyonlarını expose et
        renderMattaForm: renderMattaForm,
        renderGardinForm: renderGardinForm,

        getCartItem: () => {
            if (!state.isCalculated) return null;

            const product = state.product;
            const baseItem = {
                id: product.id,
                name: product.name,
                image: product.images?.[0] || '',
                delivery: product.delivery_time || '3-7 arbetsdagar'
            };

            if (state.calculatorType === 'm2' && state.m2.en > 0) {
                return {
                    ...baseItem,
                    cartItemId: `${product.id}_m2_${state.m2.en}_${state.m2.boy}_${state.m2.form}_${Date.now()}`,
                    price: state.m2.totalPrice,
                    original_price: Math.round(state.m2.calculatedM2 * getRegularUnitPrice(product) * state.m2.quantity),
                    size: `${state.m2.en}×${state.m2.boy} cm (${state.m2.form})`,
                    en: state.m2.en,
                    boy: state.m2.boy,
                    form: state.m2.form,
                    m2: state.m2.calculatedM2,
                    isM2: true,
                    quantity: state.m2.quantity
                };
            }

            if (state.calculatorType === 'gardin' && state.gardin.en > 0) {
                return {
                    ...baseItem,
                    cartItemId: `${product.id}_gardin_${state.gardin.en}_${state.gardin.boy}_${Date.now()}`,
                    price: state.gardin.totalPrice,
                    original_price: Math.round(state.gardin.metre * getRegularUnitPrice(product) * state.gardin.quantity),
                    size: `${state.gardin.en}×${state.gardin.boy} cm (Gardin)`,
                    en: state.gardin.en,
                    boy: state.gardin.boy,
                    metre: state.gardin.metre,
                    suspension: state.gardin.suspensionType,
                    note: state.gardin.customerNote,
                    isGardin: true,
                    quantity: state.gardin.quantity
                };
            }

            return null;
        },

        reset: () => {
            state.isCalculated = false;
            state.m2 = { en: 0, boy: 0, calculatedM2: 0, totalPrice: 0, quantity: 1, form: 'Rektangulär', maxStock: 999 };
            state.gardin = { en: 0, boy: 300, metre: 0, totalPrice: 0, quantity: 1, suspensionType: 'gardinskena', customerNote: '', pileRatio: 3.0 };
        },

        getState: () => ({ ...state }),
        getType: () => state.calculatorType,
        isReady: () => state.isCalculated
    };
})();