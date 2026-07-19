// ==========================================
// PRODUCT CALCULATOR v2.4
// FontAwesome kaldırıldı, Inline SVG eklendi
// Halı ikonları chip stiline dönüştürüldü
// ==========================================

window.ProductCalculator = (function() {

    const state = {
        calculatorType: null,
        product: null,
        m2: {
            en: 0, boy: 0, calculatedM2: 0, totalPrice: 0,
            quantity: 1, form: 'Rektangulär', maxStock: 999
        },
        gardin: {
            en: 0, boy: 300, metre: 0, totalPrice: 0,
            quantity: 1, suspensionType: 'gardinskena',
            customerNote: '', pileRatio: 3.0
        },
        isCalculated: false
    };

    // ==========================================
    // SVG ICONS (Inline, no FontAwesome)
    // ==========================================
    const SVG_ICONS = {
        ruler: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 8.7 8.7 21.3c-1 1-2.5 1-3.4 0l-2.6-2.6c-1-1-1-2.5 0-3.4L15.3 2.7c1-1 2.5-1 3.4 0l2.6 2.6c1 1 1 2.5 0 3.4Z"/><path d="m14.5 6.5 3 3"/><path d="m11.5 9.5 3 3"/><path d="m8.5 12.5 3 3"/><path d="m5.5 15.5 3 3"/></svg>`,

        chevronDown: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,

        check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,

        rectShape: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="1"/></svg>`,

        ovalShape: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="10" ry="6"/></svg>`,

        circleShape: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>`,

        gripLines: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="9" y2="9"/><line x1="3" x2="21" y1="15" y2="15"/></svg>`,

        circleNotch: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 9 9"/></svg>`,

        ring: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>`,

        info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,

        commentDots: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/></svg>`,

        commentDotsRegular: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/></svg>`
    };

    const formatCurrency = (num) => {
        if (!num || isNaN(num)) return '0 kr';
        return Math.round(parseFloat(num)).toLocaleString('sv-SE').replace(',', ' ') + ' kr';
    };

    const notify = (message, type = 'error') => {
        if (typeof window.showToast === 'function') window.showToast(message, type);
        else console.log(`[${type.toUpperCase()}] ${message}`);
    };

    const getUnitPrice = (product) => {
        if (!product) return 0;
        if (state.calculatorType === 'm2' && product.m2_price_per_m2) return parseFloat(product.m2_price_per_m2);
        if (state.calculatorType === 'gardin' && product.gardin_meter_price) return parseFloat(product.gardin_meter_price);
        return parseFloat(product.discount_price || product.base_price || product.price || 0);
    };

    const getRegularUnitPrice = (product) => {
        if (!product) return 0;
        if (state.calculatorType === 'm2' && product.m2_price_per_m2) return parseFloat(product.m2_price_per_m2);
        if (state.calculatorType === 'gardin' && product.gardin_meter_price) return parseFloat(product.gardin_meter_price);
        return parseFloat(product.base_price || product.price || 0);
    };

    const updateCartButton = (enabled, text = null) => {
        const btn = document.getElementById('add-to-cart-btn');
        if (!btn) return;
        btn.disabled = !enabled;
        btn.style.opacity = enabled ? '1' : '0.5';
        btn.style.pointerEvents = enabled ? 'auto' : 'none';
        btn.textContent = text || (enabled ? 'LÄGG I VARUKORG' : 'Ange mått');
    };

    const updatePriceDisplay = (price, regularPrice = null) => {
        const priceEl = document.getElementById('product-price');
        if (!priceEl) return;
        const hasDiscount = regularPrice && regularPrice > price;
        if (hasDiscount) {
            priceEl.innerHTML = '<span class="discount-price">' + formatCurrency(price) + '</span>' +
                '<span class="original-price">' + formatCurrency(regularPrice) + '</span>';
        } else {
            priceEl.innerHTML = '<span class="normal-price">' + formatCurrency(price) + '</span>';
        }
    };

    // ==========================================
    // HALI (M²) - Chip stili şekil seçimi
    // ==========================================

    const renderMattaForm = (container, product) => {
        state.calculatorType = 'm2';
        state.product = product;
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
                        <div class="accordion-title-group">
                            <span class="accordion-subtitle" id="matta-accordion-subtitle">Ange dina mått för att beräkna pris</span>
                        </div>
                    </div>
                    <div class="accordion-right">
                        ${SVG_ICONS.chevronDown}
                    </div>
                </button>
                <div class="calc-accordion-content" id="matta-accordion-content">
                    <div class="accordion-inner">
                        <div class="form-selector">
                            <label class="form-label">Välj form</label>
                            <div class="suspension-chips">
                                ${[
                                    { form: 'Rektangulär', icon: SVG_ICONS.rectShape },
                                    { form: 'Oval', icon: SVG_ICONS.ovalShape },
                                    { form: 'Rund', icon: SVG_ICONS.circleShape }
                                ].map(({form, icon}) => `
                                    <label class="suspension-chip">
                                        <input type="radio" name="rug-form" value="${form}" ${form === 'Rektangulär' ? 'checked' : ''}>
                                        <div class="suspension-chip-label">
                                            ${icon}
                                            <span>${form}</span>
                                        </div>
                                    </label>`).join('')}
                            </div>
                        </div>
                        <div class="input-grid">
                            <div class="input-group">
                                <label class="form-label">Bredd (cm)</label>
                                <select id="m2-en" class="premium-input">${widthOptions}</select>
                            </div>
                            <div class="input-group">
                                <label class="form-label">Längd (cm)</label>
                                <input type="number" id="m2-boy" class="premium-input" placeholder="Min: ${minBoy} cm" min="${minBoy}">
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
            </div>`;

        initMattaEvents(product);
        updateCartButton(false);
    };

    const initMattaEvents = (product) => {
        const toggle = document.getElementById('matta-accordion-toggle');
        const content = document.getElementById('matta-accordion-content');
        toggle.addEventListener('click', () => {
            const isOpen = content.classList.contains('open');
            if (isOpen) { content.classList.remove('open'); toggle.classList.remove('active'); toggle.setAttribute('aria-expanded', 'false'); }
            else { content.classList.add('open'); toggle.classList.add('active'); toggle.setAttribute('aria-expanded', 'true'); }
        });
        document.querySelectorAll('input[name="rug-form"]').forEach(input => {
            input.addEventListener('change', (e) => {
                state.m2.form = e.target.value;
                const boyInput = document.getElementById('m2-boy');
                const enInput = document.getElementById('m2-en');
                if (e.target.value === 'Rund') {
                    if (enInput.value) boyInput.value = enInput.value;
                    boyInput.readOnly = true; boyInput.style.backgroundColor = '#f5f5f5';
                } else { boyInput.readOnly = false; boyInput.style.backgroundColor = '#fff'; }
            });
        });
        document.getElementById('m2-en').addEventListener('change', (e) => {
            if (document.querySelector('input[name="rug-form"]:checked')?.value === 'Rund') {
                document.getElementById('m2-boy').value = e.target.value;
            }
        });
        document.getElementById('m2-calc-btn').addEventListener('click', () => calculateMatta(product));
        document.getElementById('m2-reset-btn').addEventListener('click', () => resetMattaForm(product));
    };

    const calculateMatta = (product) => {
        const en = parseFloat(document.getElementById('m2-en').value);
        const boy = parseFloat(document.getElementById('m2-boy').value);
        const summaryEl = document.getElementById('m2-summary');
        const liveSummary = document.getElementById('m2-live-summary');
        const minBoy = parseFloat(product.m2_min_length || 0);

        if (!en || en <= 0) { notify('Välj en bredd', 'warning'); updateCartButton(false); return; }
        if (!boy || boy <= 0) { notify('Ange en giltig längd', 'warning'); updateCartButton(false); return; }
        if (boy < minBoy) { notify(`Minsta längd är ${minBoy} cm`, 'warning'); updateCartButton(false); return; }

        const m2 = (en / 100) * (boy / 100);
        const unitPrice = getUnitPrice(product);
        const regularUnitPrice = getRegularUnitPrice(product);
        const totalPrice = Math.round(m2 * unitPrice);
        const totalRegularPrice = Math.round(m2 * regularUnitPrice);
        const maxStock = parseFloat(product.m2_stock_per_width?.[String(en)] || product.max_stock || 999);

        if (m2 > maxStock) {
            notify(`Endast ${maxStock.toFixed(2)} m² tillgängligt. Ditt val kräver ${m2.toFixed(2)} m².`, 'error');
            updateCartButton(false); return;
        }

        state.m2 = { en, boy, calculatedM2: m2, totalPrice, quantity: 1, form: document.querySelector('input[name="rug-form"]:checked')?.value || 'Rektangulär', maxStock };
        state.isCalculated = true;

        const hasDiscount = totalRegularPrice > totalPrice;
        summaryEl.innerHTML = `
            <div class="summary-compact-row">
                <strong>${en} × ${boy} cm</strong>
                <span class="summary-dot"></span>
                <span>${state.m2.form}</span>
                <span class="summary-dot"></span>
                <strong>${m2.toFixed(2)} m²</strong>
            </div>
            <hr class="summary-divider">
            <div class="summary-total-compact">
                <span>Totalt</span>
                <strong class="total-price ${hasDiscount ? 'has-discount' : ''}">
                    ${hasDiscount ? `<span class="original-price">${formatCurrency(totalRegularPrice)}</span>` : ''}
                    ${formatCurrency(totalPrice)}
                </strong>
            </div>`;
        summaryEl.classList.add('visible');

        liveSummary.innerHTML = `<strong>${en}×${boy} cm</strong> | ${m2.toFixed(2)} m² | ${formatCurrency(totalPrice)}`;
        liveSummary.classList.add('visible');

        const subtitle = document.getElementById('matta-accordion-subtitle');
        const status = document.getElementById('matta-accordion-status');
        if (subtitle) subtitle.textContent = `${en}×${boy} cm | ${state.m2.form} | ${formatCurrency(totalPrice)}`;
        if (status) { status.textContent = 'Pris beräknat'; status.style.display = 'inline'; }

        updatePriceDisplay(totalPrice, hasDiscount ? totalRegularPrice : null);
        updateCartButton(true);
        notify('Pris beräknat! Klicka på "Lägg i varukorg" för att fortsätta.', 'success');

        const calcBtn = document.getElementById('m2-calc-btn');
        if (calcBtn) { calcBtn.classList.add('calculated'); calcBtn.innerHTML = 'PRIS BERÄKNAT ' + SVG_ICONS.check; }
    };

    const resetMattaForm = (product) => {
        document.getElementById('m2-en').value = '';
        const boyInput = document.getElementById('m2-boy');
        boyInput.value = ''; boyInput.readOnly = false; boyInput.style.backgroundColor = '#fff';
        const rectRadio = document.querySelector('input[name="rug-form"][value="Rektangulär"]');
        if (rectRadio) rectRadio.checked = true;
        document.getElementById('m2-summary').classList.remove('visible');
        document.getElementById('m2-summary').innerHTML = '';
        document.getElementById('m2-live-summary').classList.remove('visible');
        document.getElementById('m2-live-summary').innerHTML = '';
        const calcBtn = document.getElementById('m2-calc-btn');
        if (calcBtn) { calcBtn.classList.remove('calculated'); calcBtn.textContent = 'BERÄKNA PRIS'; }
        const subtitle = document.getElementById('matta-accordion-subtitle');
        const status = document.getElementById('matta-accordion-status');
        if (subtitle) subtitle.textContent = 'Ange dina mått för att beräkna pris';
        if (status) status.style.display = 'none';
        state.m2 = { en: 0, boy: 0, calculatedM2: 0, totalPrice: 0, quantity: 1, form: 'Rektangulär', maxStock: state.m2.maxStock };
        state.isCalculated = false;
        updateCartButton(false);
        const unitPrice = getUnitPrice(product);
        const regularPrice = getRegularUnitPrice(product);
        updatePriceDisplay(unitPrice, regularPrice > unitPrice ? regularPrice : null);
    };

    // ==========================================
    // PERDE (GARDIN) - FontAwesome kaldırıldı, SVG eklendi
    // ==========================================

    const renderGardinForm = (container, product) => {
        state.calculatorType = 'gardin';
        state.product = product;
        const minEn = product.gardin_min_width || 50;
        const defaultBoy = product.gardin_default_height || 300;
        const maxBoy = product.gardin_max_width || 500;
        const pileFactor = product.gardin_pile_factor || 3.0;
        const kornisOptions = product.gardin_kornis_options || ['Gardinskena (Veckband)', 'Dolda hällor', 'Öljetter (Maljet)'];
        const kornisIcons = [SVG_ICONS.gripLines, SVG_ICONS.circleNotch, SVG_ICONS.ring];

        container.innerHTML = `
            <div class="calc-accordion-box gardin-box" id="gardin-calc-box">
                <button type="button" class="calc-accordion-header" id="gardin-accordion-toggle" aria-expanded="false">
                    <div class="accordion-left">
                        <div class="accordion-title-group">
                            <span class="accordion-subtitle" id="gardin-accordion-subtitle">Ange dina mått för att beräkna pris</span>
                        </div>
                    </div>
                    <div class="accordion-right">
                        ${SVG_ICONS.chevronDown}
                    </div>
                </button>
                <div class="calc-accordion-content" id="gardin-accordion-content">
                    <div class="accordion-inner">
                        <div class="suspension-selector">
                            <label class="form-label">Upphängning</label>
                            <div class="suspension-chips">
                                ${kornisOptions.map((opt, i) => `
                                    <label class="suspension-chip">
                                        <input type="radio" name="suspension" value="${opt}" ${i === 0 ? 'checked' : ''}>
                                        <div class="suspension-chip-label">
                                            ${kornisIcons[i] || SVG_ICONS.ring}
                                            <span>${opt.split(' ')[0]}</span>
                                        </div>
                                    </label>`).join('')}
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
                            ${SVG_ICONS.info}
                            <span>Veckning (pile) ingår med faktor ${pileFactor}x</span>
                        </div>
                        <div class="note-expandable-section">
                            <button type="button" class="note-toggle-btn" id="note-toggle-btn">
                                ${SVG_ICONS.commentDotsRegular}
                                <span class="note-toggle-text">Lägg till anteckning</span>
                                <span class="note-toggle-badge" id="note-toggle-badge" style="display:none;">1</span>
                                ${SVG_ICONS.chevronDown}
                            </button>
                            <div class="note-expandable-content" id="note-expandable-content">
                                <label class="form-label">Meddelande till skräddaren <span class="note-optional">(valfritt)</span></label>
                                <textarea id="gardin-note" class="premium-textarea" placeholder="Skriv dina önskemål här..." rows="3"></textarea>
                                <div class="note-char-count" id="note-char-count">0 / 500 tecken</div>
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
            </div>`;

        initGardinEvents(product);
        updateCartButton(false, 'Ange mått');
    };

    const initGardinEvents = (product) => {
        const toggle = document.getElementById('gardin-accordion-toggle');
        const content = document.getElementById('gardin-accordion-content');
        toggle.addEventListener('click', () => {
            const isOpen = content.classList.contains('open');
            if (isOpen) { content.classList.remove('open'); toggle.classList.remove('active'); toggle.setAttribute('aria-expanded', 'false'); }
            else { content.classList.add('open'); toggle.classList.add('active'); toggle.setAttribute('aria-expanded', 'true'); }
        });

        // Chip stili korniş seçimi
        document.querySelectorAll('input[name="suspension"]').forEach(input => {
            input.addEventListener('change', (e) => {
                state.gardin.suspensionType = e.target.value;
                document.querySelectorAll('.suspension-chip-label').forEach(label => label.classList.remove('active-chip'));
                const checkedLabel = e.target.parentElement.querySelector('.suspension-chip-label');
                if (checkedLabel) checkedLabel.classList.add('active-chip');
            });
        });

        const noteToggleBtn = document.getElementById('note-toggle-btn');
        const noteContent = document.getElementById('note-expandable-content');
        const noteTextarea = document.getElementById('gardin-note');
        const charCount = document.getElementById('note-char-count');
        const noteBadge = document.getElementById('note-toggle-badge');
        const noteToggleText = noteToggleBtn.querySelector('.note-toggle-text');
        const MAX_CHARS = 500;

        noteToggleBtn.addEventListener('click', () => {
            const isOpen = noteContent.classList.contains('open');
            if (isOpen) { noteContent.classList.remove('open'); noteToggleBtn.classList.remove('active'); }
            else { noteContent.classList.add('open'); noteToggleBtn.classList.add('active'); setTimeout(() => noteTextarea.focus(), 300); }
        });

        if (noteTextarea) {
            noteTextarea.addEventListener('input', (e) => {
                const value = e.target.value;
                const length = value.length;
                if (length > MAX_CHARS) e.target.value = value.substring(0, MAX_CHARS);
                const currentLength = Math.min(length, MAX_CHARS);
                charCount.textContent = `${currentLength} / ${MAX_CHARS} tecken`;
                if (currentLength >= MAX_CHARS * 0.9) charCount.classList.add('near-limit');
                else charCount.classList.remove('near-limit');
                state.gardin.customerNote = e.target.value;
                if (currentLength > 0) { noteBadge.style.display = 'inline-flex'; noteBadge.textContent = currentLength; noteToggleText.textContent = 'Visa anteckning'; }
                else { noteBadge.style.display = 'none'; noteToggleText.textContent = 'Lägg till anteckning'; }
            });
        }

        document.addEventListener('click', (e) => {
            const noteSection = document.querySelector('.note-expandable-section');
            if (noteSection && !noteSection.contains(e.target)) {
                noteContent.classList.remove('open'); noteToggleBtn.classList.remove('active');
            }
        });

        document.getElementById('gardin-en').addEventListener('input', updateGardinLiveSummary);
        document.getElementById('gardin-boy').addEventListener('input', updateGardinLiveSummary);
        document.getElementById('gardin-calc-btn').addEventListener('click', () => calculateGardin(product));
        document.getElementById('gardin-reset-btn').addEventListener('click', () => resetGardinForm(product));
    };

    const updateGardinLiveSummary = () => {
        const en = document.getElementById('gardin-en').value;
        const boy = document.getElementById('gardin-boy').value;
        const liveSummary = document.getElementById('gardin-live-summary');
        if (en > 0) { liveSummary.innerHTML = `<strong>${en}×${boy} cm</strong> | ${state.gardin.suspensionType}`; liveSummary.classList.add('visible'); }
        else liveSummary.classList.remove('visible');
    };

    const calculateGardin = (product) => {
        const en = parseFloat(document.getElementById('gardin-en').value);
        const boy = parseFloat(document.getElementById('gardin-boy').value);
        const summaryEl = document.getElementById('gardin-summary');
        const minEn = parseFloat(product.gardin_min_width || 50);
        const maxBoy = parseFloat(product.gardin_max_width || 500);
        const pileFactor = parseFloat(product.gardin_pile_factor || 3.0);

        if (!en || en < minEn) { notify(`Minsta bredd är ${minEn} cm`, 'warning'); updateCartButton(false); return; }
        if (!boy || boy <= 0) { notify('Ange en giltig höjd', 'warning'); updateCartButton(false); return; }
        if (boy > maxBoy) { notify(`Max höjd är ${maxBoy} cm`, 'warning'); updateCartButton(false); return; }

        const metre = (en / 100) * pileFactor;
        const unitPrice = getUnitPrice(product);
        const regularUnitPrice = getRegularUnitPrice(product);
        const totalPrice = Math.round(metre * unitPrice);
        const totalRegularPrice = Math.round(metre * regularUnitPrice);

        state.gardin = { en, boy, metre, totalPrice, quantity: 1, suspensionType: document.querySelector('input[name="suspension"]:checked')?.value || 'Gardinskena (Veckband)', customerNote: state.gardin.customerNote, pileRatio: pileFactor };
        state.isCalculated = true;

        const hasDiscount = totalRegularPrice > totalPrice;
        const noteHtml = state.gardin.customerNote ? `
            <div class="summary-note-compact">
                ${SVG_ICONS.commentDots}
                <span>${state.gardin.customerNote}</span>
            </div>` : '';

        summaryEl.innerHTML = `
            <div class="summary-compact-row">
                <strong>${en} × ${boy} cm</strong>
                <span class="summary-dot"></span>
                <span>${state.gardin.suspensionType}</span>
                <span class="summary-dot"></span>
                <strong>${metre.toFixed(2)} m</strong> veckning
            </div>
            ${noteHtml}
            <hr class="summary-divider">
            <div class="summary-total-compact">
                <span>Totalt</span>
                <strong class="total-price ${hasDiscount ? 'has-discount' : ''}">
                    ${hasDiscount ? `<span class="original-price">${formatCurrency(totalRegularPrice)}</span>` : ''}
                    ${formatCurrency(totalPrice)}
                </strong>
            </div>`;
        summaryEl.classList.add('visible');

        const subtitle = document.getElementById('gardin-accordion-subtitle');
        const status = document.getElementById('gardin-accordion-status');
        if (subtitle) subtitle.textContent = `${en}×${boy} cm | ${formatCurrency(totalPrice)}`;
        if (status) { status.textContent = 'Pris beräknat'; status.style.display = 'inline'; }

        updatePriceDisplay(totalPrice, hasDiscount ? totalRegularPrice : null);
        updateCartButton(true);
        notify('Pris beräknat! Klicka på "Lägg i varukorg" för att fortsätta.', 'success');

        const calcBtn = document.getElementById('gardin-calc-btn');
        if (calcBtn) { calcBtn.classList.add('calculated'); calcBtn.innerHTML = 'PRIS BERÄKNAT ' + SVG_ICONS.check; }
    };

    const resetGardinForm = (product) => {
        const defaultBoy = product.gardin_default_height || 300;
        document.getElementById('gardin-en').value = '';
        document.getElementById('gardin-boy').value = defaultBoy;
        const noteTextarea = document.getElementById('gardin-note');
        const noteContent = document.getElementById('note-expandable-content');
        const noteToggleBtn = document.getElementById('note-toggle-btn');
        const noteBadge = document.getElementById('note-toggle-badge');
        const noteToggleText = noteToggleBtn?.querySelector('.note-toggle-text');
        const charCount = document.getElementById('note-char-count');
        if (noteTextarea) noteTextarea.value = '';
        if (noteContent) noteContent.classList.remove('open');
        if (noteToggleBtn) noteToggleBtn.classList.remove('active');
        if (noteBadge) noteBadge.style.display = 'none';
        if (noteToggleText) noteToggleText.textContent = 'Lägg till anteckning';
        if (charCount) { charCount.textContent = '0 / 500 tecken'; charCount.classList.remove('near-limit'); }
        document.getElementById('gardin-summary').classList.remove('visible');
        document.getElementById('gardin-summary').innerHTML = '';
        document.getElementById('gardin-live-summary').classList.remove('visible');
        document.getElementById('gardin-live-summary').innerHTML = '';
        const firstKornis = document.querySelector('input[name="suspension"]');
        if (firstKornis) {
            firstKornis.checked = true;
            document.querySelectorAll('.suspension-chip-label').forEach(l => l.classList.remove('active-chip'));
        }
        const calcBtn = document.getElementById('gardin-calc-btn');
        if (calcBtn) { calcBtn.classList.remove('calculated'); calcBtn.textContent = 'BERÄKNA PRIS'; }
        const subtitle = document.getElementById('gardin-accordion-subtitle');
        const status = document.getElementById('gardin-accordion-status');
        if (subtitle) subtitle.textContent = 'Ange dina mått för att beräkna pris';
        if (status) status.style.display = 'none';
        state.gardin = { en: 0, boy: defaultBoy, metre: 0, totalPrice: 0, quantity: 1, suspensionType: 'gardinskena', customerNote: '', pileRatio: 3.0 };
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
            if (!product) { console.error('ProductCalculator: Ürün verisi gerekli'); return; }
            const container = document.getElementById('calculator-insertion-point');
            if (!container) { console.error('ProductCalculator: #calculator-insertion-point bulunamadı'); return; }
            console.log('[Calculator] Ürün verisi:', product);
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
        renderMattaForm: renderMattaForm,
        renderGardinForm: renderGardinForm,
        getCartItem: () => {
            if (!state.isCalculated) return null;
            const product = state.product;
            const baseItem = { id: product.id, name: product.name, image: product.images?.[0] || '', delivery: product.delivery_time || '3-7 arbetsdagar' };
            if (state.calculatorType === 'm2' && state.m2.en > 0) {
                return {
                    ...baseItem,
                    cartItemId: `${product.id}_m2_${state.m2.en}_${state.m2.boy}_${state.m2.form}_${Date.now()}`,
                    price: state.m2.totalPrice,
                    original_price: Math.round(state.m2.calculatedM2 * getRegularUnitPrice(product)),
                    size: `${state.m2.en}×${state.m2.boy} cm (${state.m2.form})`,
                    en: state.m2.en, boy: state.m2.boy, form: state.m2.form, m2: state.m2.calculatedM2,
                    isM2: true, quantity: 1
                };
            }
            if (state.calculatorType === 'gardin' && state.gardin.en > 0) {
                return {
                    ...baseItem,
                    cartItemId: `${product.id}_gardin_${state.gardin.en}_${state.gardin.boy}_${Date.now()}`,
                    price: state.gardin.totalPrice,
                    original_price: Math.round(state.gardin.metre * getRegularUnitPrice(product)),
                    size: `${state.gardin.en}×${state.gardin.boy} cm (Gardin)`,
                    en: state.gardin.en, boy: state.gardin.boy, metre: state.gardin.metre,
                    suspension: state.gardin.suspensionType, note: state.gardin.customerNote,
                    isGardin: true, quantity: 1
                };
            }
            return null;
        },
        reset: () => {
            state.isCalculated = false;
            state.m2 = { en: 0, boy: 0, calculatedM2: 0, totalPrice: 0, quantity: 1, form: 'Rektangulär', maxStock: 999 };
            state.gardin = { en: 0, boy: 300, metre: 0, totalPrice: 0, quantity: 1, suspensionType: 'gardinskena', customerNote: '', pileRatio: 3.0 };
            if (state.calculatorType === 'm2' && state.product) resetMattaForm(state.product);
            else if (state.calculatorType === 'gardin' && state.product) resetGardinForm(state.product);
        },
        getState: () => ({ ...state }),
        getType: () => state.calculatorType,
        isReady: () => state.isCalculated
    };
})();