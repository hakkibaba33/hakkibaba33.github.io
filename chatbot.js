// ==========================================
// DKRUG CHATBOT - API'siz + Supabase Entegre
// v1.1 - Modüler Sürüm
// info@dekorist.se | +46763016775
// ==========================================

(function() {
    'use strict';
    
    // ==========================================
    // KONFIGURASYON
    // ==========================================
    
    const CONFIG = {
        email: 'info@dekorist.se',
        phone: '+46763016775',
        phoneDisplay: '076-301 67 75',
        workHours: 'vardagar 9-17',
        freeShippingThreshold: 500,
        deliveryDays: '3-7 arbetsdagar',
        returnDays: 30,
        maxMessages: 50
    };
    
    // ==========================================
    // SUPABASE BAGLANTISI (Global CONFIG'den)
    // ==========================================
    
    const SUPABASE_URL = (typeof window.CONFIG !== 'undefined' && window.CONFIG.SUPABASE) 
        ? window.CONFIG.SUPABASE.URL 
        : '';
    const SUPABASE_KEY = (typeof window.CONFIG !== 'undefined' && window.CONFIG.SUPABASE) 
        ? window.CONFIG.SUPABASE.ANON_KEY 
        : '';
    
    // ==========================================
    // URUN VERISI CACHE
    // ==========================================
    
    let productsCache = [];
    let categoriesCache = [];
    let isProductsLoaded = false;
    
    async function loadProducts() {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            console.warn('[Chatbot] Supabase config bulunamadi');
            return;
        }
        
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&active=eq.true`, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });
            
            if (!res.ok) throw new Error('Supabase hatasi');
            
            productsCache = await res.json();
            categoriesCache = [...new Set(productsCache.map(p => p.category).filter(Boolean))];
            isProductsLoaded = true;
            
            console.log(`[Chatbot] ${productsCache.length} urun yuklendi`);
            
        } catch (err) {
            console.error('[Chatbot] Urun yukleme hatasi:', err);
        }
    }
    
    // ==========================================
    // CHATBOT MOTORU
    // ==========================================
    
    const ChatEngine = {
        patterns: {
            'hej|hallå|tjena|merhaba|hey|hi|hello': 'greeting',
            'matta|kilim|halı|rug|carpet|vardagsrum|sovrum|kok|persisk|orientalisk|modern': 'product_search',
            'pris|kostar|hur mycket|fiyat|price|billig|dyr': 'price',
            'lager|finns|stock|tilgänglig|slut|var finns': 'stock',
            'storlek|ölçü|size|dimension|cm|meter|bredd|längd|200x300|160x230': 'size',
            'material|ull|bomull|silke|skötsel|tvätt|rengöring|wool|cotton|silk': 'material',
            'leverans|frakt|kargo|shipping|när kommer|leveranstid|fri frakt': 'shipping',
            'retur|iade|return|ångra|byta|öppet köp|ångerrätt': 'return',
            'betal|payment|faktura|klarna|swish|kort|visa|mastercard': 'payment',
            'kontakt|telefon|mail|support|människa|ringa|maila|reach': 'contact',
            'butik|magaza|om oss|hakkimizda|företag|dream kilim|dekorist': 'about',
            'rea|rabatt|kampanj|indirim|erbjudande|outlet': 'campaign'
        },
        
        analyze(message) {
            const lower = message.toLowerCase().trim();
            
            for (const [pattern, intent] of Object.entries(this.patterns)) {
                const regex = new RegExp(pattern, 'i');
                if (regex.test(lower)) return { intent, query: lower };
            }
            
            if (isProductsLoaded) {
                const matchedProduct = this.findProduct(lower);
                if (matchedProduct) {
                    return { intent: 'product_detail', product: matchedProduct };
                }
            }
            
            return { intent: 'unknown', query: lower };
        },
        
        findProduct(query) {
            return productsCache.find(p => {
                const name = (p.name || '').toLowerCase();
                const slug = (p.slug || '').toLowerCase();
                const category = (p.category || '').toLowerCase();
                const desc = (p.description || '').toLowerCase();
                
                return name.includes(query) || 
                       slug.includes(query) || 
                       category.includes(query) ||
                       desc.includes(query);
            });
        },
        
        findByCategory(category) {
            return productsCache.filter(p => {
                const cat = (p.category || '').toLowerCase();
                return cat.includes(category.toLowerCase());
            });
        }
    };
    
    // ==========================================
    // YANIT GENERATORU
    // ==========================================
    
    const ResponseBuilder = {
        
        greeting() {
            return `
                <strong>Hej! 👋 Välkommen till Dream Kilim!</strong><br><br>
                Jag kan hjälpa dig med:<br>
                • 🔍 <em>Hitta mattor</em> (skriv t.ex. "vardagsrum" eller "persisk")<br>
                • 📏 <em>Storlekar och mått</em><br>
                • 🚚 <em>Leverans och returer</em><br>
                • 💰 <em>Priser och betalning</em><br><br>
                <em style="font-size:12px;opacity:0.7;">Vad letar du efter?</em>
            `;
        },
        
        product_search(data) {
            if (!isProductsLoaded) {
                return 'Ursäkt, produktdatabasen laddar fortfarande. Försök igen om en stund!';
            }
            
            const query = data.query;
            let results = [];
            
            const categoryMatches = ChatEngine.findByCategory(query);
            if (categoryMatches.length > 0) results = categoryMatches;
            
            if (results.length === 0) {
                results = productsCache.filter(p => {
                    const name = (p.name || '').toLowerCase();
                    return name.includes(query) || query.includes(name);
                });
            }
            
            if (results.length === 0) {
                return `
                    Jag hittade inga mattor som matchar "<em>${query}</em>".<br><br>
                    Prova med: <em>vardagsrum</em>, <em>sovrum</em>, <em>persisk</em>, <em>modern</em><br>
                    Eller se alla våra mattor <a href="/category.html" style="color:var(--dk-accent);">här →</a>
                `;
            }
            
            const display = results.slice(0, 5);
            const hasMore = results.length > 5;
            
            return `
                <strong>Hittade ${results.length} mattor:</strong><br><br>
                ${display.map(p => {
                    const price = (p.discount_price || p.base_price || 0).toLocaleString('sv-SE');
                    const img = p.images && p.images[0] ? p.images[0] : '';
                    return `
                        <div style="display:flex;gap:10px;margin-bottom:10px;align-items:center;">
                            ${img ? `<img src="${img}" style="width:50px;height:67px;object-fit:cover;border-radius:4px;">` : ''}
                            <div>
                                <a href="/matta/${p.slug}" style="color:var(--dk-accent);font-weight:600;">${p.name}</a><br>
                                <span style="font-size:13px;">${price} SEK</span>
                                ${p.discount_price && p.base_price ? `<span style="font-size:12px;text-decoration:line-through;opacity:0.6;margin-left:5px;">${p.base_price.toLocaleString('sv-SE')} SEK</span>` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
                ${hasMore ? `<br><em>...och ${results.length - 5} till. <a href="/category.html" style="color:var(--dk-accent);">Se alla →</a></em>` : ''}
            `;
        },
        
        product_detail(data) {
            const p = data.product;
            const price = (p.discount_price || p.base_price || 0).toLocaleString('sv-SE');
            const oldPrice = p.base_price && p.discount_price ? p.base_price.toLocaleString('sv-SE') : null;
            const img = p.images && p.images[0] ? p.images[0] : '';
            const variants = p.variants || [];
            const sizes = variants.map(v => v.size).join(', ') || 'Standard';
            const inStock = variants.some(v => v.stock > 0);
            
            return `
                <div style="display:flex;gap:12px;margin-bottom:12px;">
                    ${img ? `<img src="${img}" style="width:80px;height:107px;object-fit:cover;border-radius:8px;border:1px solid var(--dk-border);">` : ''}
                    <div>
                        <strong style="font-size:15px;">${p.name}</strong><br>
                        <span style="font-size:18px;font-weight:700;color:var(--dk-accent);">${price} SEK</span>
                        ${oldPrice ? `<span style="font-size:14px;text-decoration:line-through;opacity:0.6;margin-left:8px;">${oldPrice} SEK</span>` : ''}<br>
                        <span style="font-size:13px;color:var(--dk-text-light);">${p.category || ''}</span>
                    </div>
                </div>
                <div style="background:var(--dk-secondary);padding:10px 14px;border-radius:8px;margin:10px 0;">
                    <strong>Storlekar:</strong> ${sizes}<br>
                    <strong>Lagerstatus:</strong> ${inStock ? '✅ I lager' : '❌ Slut i lager'}<br>
                    <strong>Leverans:</strong> ${CONFIG.deliveryDays}
                </div>
                ${p.description ? `<p style="font-size:13px;line-height:1.5;margin:10px 0;">${p.description.substring(0, 150)}${p.description.length > 150 ? '...' : ''}</p>` : ''}
                <a href="/matta/${p.slug}" style="display:inline-block;background:var(--dk-accent);color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:5px;">Se produkt →</a>
            `;
        },
        
        price() {
            if (!isProductsLoaded || productsCache.length === 0) {
                return `
                    Våra mattor varierar beroende på storlek, material och ursprung:<br><br>
                    • <strong>Små mattor</strong> (80x150 cm): från 1 500 SEK<br>
                    • <strong>Medel</strong> (160x230 cm): från 3 500 SEK<br>
                    • <strong>Stora</strong> (200x300 cm): från 5 500 SEK<br>
                    • <strong>Persiska/Orientaliska</strong>: från 8 000 SEK<br><br>
                    <em>🎁 Fri frakt vid köp över ${CONFIG.freeShippingThreshold} SEK!</em><br>
                    <a href="/category.html" style="color:var(--dk-accent);">Se alla priser →</a>
                `;
            }
            
            const prices = productsCache.map(p => p.discount_price || p.base_price || 0).filter(p => p > 0);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
            
            const cheapest = [...productsCache]
                .sort((a, b) => (a.discount_price || a.base_price) - (b.discount_price || b.base_price))
                .slice(0, 3);
            
            return `
                <strong>Vårt prisspann:</strong><br>
                <div style="font-size:24px;font-weight:700;color:var(--dk-accent);margin:10px 0;">
                    ${minPrice.toLocaleString('sv-SE')} – ${maxPrice.toLocaleString('sv-SE')} SEK
                </div>
                <em>Genomsnittligt pris: ${avgPrice.toLocaleString('sv-SE')} SEK</em><br><br>
                
                <strong>Bästa erbjudanden just nu:</strong><br>
                ${cheapest.map(p => `
                    • <a href="/matta/${p.slug}" style="color:var(--dk-accent);">${p.name}</a> — 
                    <strong>${(p.discount_price || p.base_price).toLocaleString('sv-SE')} SEK</strong>
                    ${p.discount_price ? `<span style="text-decoration:line-through;opacity:0.6;font-size:12px;">${p.base_price.toLocaleString('sv-SE')}</span>` : ''}
                `).join('<br>')}<br><br>
                
                <em>🎁 Fri frakt över ${CONFIG.freeShippingThreshold} SEK!</em>
            `;
        },
        
        stock() {
            if (!isProductsLoaded) {
                return 'Lagerstatus uppdateras... Försök igen om en stund!';
            }
            
            const inStock = productsCache.filter(p => {
                const variants = p.variants || [];
                return variants.some(v => v.stock > 0);
            });
            
            const lowStock = productsCache.filter(p => {
                const variants = p.variants || [];
                return variants.some(v => v.stock > 0 && v.stock <= 3);
            });
            
            return `
                <strong>Lagerstatus:</strong><br>
                • <strong>${inStock.length}</strong> mattor finns i lager<br>
                • <strong>${lowStock.length}</strong> produkter är lågt i lager (högst 3 kvar)<br><br>
                
                ${lowStock.length > 0 ? `
                    <strong>⚡ Sista chansen:</strong><br>
                    ${lowStock.slice(0, 3).map(p => `
                        • <a href="/matta/${p.slug}" style="color:var(--dk-accent);">${p.name}</a>
                    `).join('<br>')}
                    <br><br>
                ` : ''}
                
                <em>Vill du se en specifik matta? Skriv namnet!</em>
            `;
        },
        
        size() {
            return `
                <strong>Vanliga mattstorlekar:</strong><br><br>
                
                <div style="background:var(--dk-secondary);padding:12px;border-radius:8px;margin:8px 0;">
                    <strong>🛋️ Vardagsrum</strong><br>
                    • 200×300 cm (soffgrupp)<br>
                    • 160×230 cm (mindre rum)<br>
                    • 300×400 cm (stora rum)
                </div>
                
                <div style="background:var(--dk-secondary);padding:12px;border-radius:8px;margin:8px 0;">
                    <strong>🛏️ Sovrum</strong><br>
                    • 80×150 cm (sängkant)<br>
                    • 120×170 cm (under sängen)
                </div>
                
                <div style="background:var(--dk-secondary);padding:12px;border-radius:8px;margin:8px 0;">
                    <strong>🍽️ Kök/Matplats</strong><br>
                    • 80×200 cm (löpare)<br>
                    • 140×200 cm (matbord)
                </div>
                
                <br><em>💡 Tips: Mät ditt rum och lägg till 20 cm på varje sida om möjligt!</em><br>
                <em>Vill du ha hjälp att välja storlek? Beskriv ditt rum!</em>
            `;
        },
        
        material() {
            return `
                <strong>Våra material:</strong><br><br>
                
                <strong>🐑 Ull</strong><br>
                • Varmt, hållbart, naturligt smutsavvisande<br>
                • Idealiskt för: Vardagsrum, sovrum<br><br>
                
                <strong>🌿 Bomull</strong><br>
                • Mjukt, lättskött, maskintvättbart<br>
                • Idealiskt för: Kök, barnrum<br><br>
                
                <strong>✨ Silke/Bambu</strong><br>
                • Lyxigt skimmer, svalt, allergivänligt<br>
                • Idealiskt för: Sovrum, gästrum<br><br>
                
                <strong>🧵 Syntet</strong><br>
                • Budgetvänligt, färgstarkt, lättskött<br>
                • Idealiskt för: Uterum, hemmakontor<br><br>
                
                <em>🧼 Skötselråd: Dammsug regelbundet, tvätta vid fläckar, undvik direkt solljus.</em>
            `;
        },
        
        shipping() {
            return `
                <strong>🚚 Leveransinformation:</strong><br><br>
                
                <div style="background:var(--dk-secondary);padding:14px;border-radius:8px;">
                    <strong>Fri frakt</strong> vid köp över <strong>${CONFIG.freeShippingThreshold} SEK</strong> 🎁<br>
                    Under ${CONFIG.freeShippingThreshold} SEK: 79 SEK i frakt
                </div><br>
                
                <strong>Leveranstid:</strong> ${CONFIG.deliveryDays}<br>
                <strong>Leveransalternativ:</strong><br>
                • Hemleverans till dörren<br>
                • Ombud (närmaste utlämningsställe)<br><br>
                
                <strong>Spåra din beställning:</strong><br>
                Du får ett spårningsnummer via e-post när din matta skickas.<br><br>
                
                <em>📦 Alla mattor rullas professionellt för att undvika veck.</em>
            `;
        },
        
        return() {
            return `
                <strong>🔄 Retur & Byte:</strong><br><br>
                
                <div style="background:#e8f5e9;padding:14px;border-radius:8px;border-left:4px solid #4caf50;">
                    <strong>${CONFIG.returnDays} dagars öppet köp</strong> ✅<br>
                    Helt nöjd eller pengarna tillbaka!
                </div><br>
                
                <strong>Så här returnerar du:</strong><br>
                1. Kontakta oss på <a href="mailto:${CONFIG.email}" style="color:var(--dk-accent);">${CONFIG.email}</a><br>
                2. Vi skickar en retursedel<br>
                3. Packa mattan i originalförpackning<br>
                4. Lämna på närmaste ombud<br><br>
                
                <strong>Observera:</strong><br>
                • Mattan måste vara oanvänd och i originalskick<br>
                • Specialbeställningar (måttanpassade) kan ej returneras<br>
                • Returfrakt betalas av köparen (om inte felexpedierat)<br><br>
                
                <em>Har du frågor? Vi hjälper dig gärna! 😊</em>
            `;
        },
        
        payment() {
            return `
                <strong>💳 Betalningsalternativ:</strong><br><br>
                
                <div style="display:flex;flex-direction:column;gap:10px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:24px;">💸</span>
                        <div><strong>Swish</strong> — Direktbetalning, snabbast</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:24px;">💳</span>
                        <div><strong>Kortbetalning</strong> — Visa, Mastercard, Maestro</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:24px;">📋</span>
                        <div><strong>Faktura</strong> — Via Klarna (14 eller 30 dagar)</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:24px;">📅</span>
                        <div><strong>Delbetalning</strong> — Klarna, 3-36 månader</div>
                    </div>
                </div><br>
                
                <em>🔒 Alla betalningar är säkra och krypterade med SSL.</em>
            `;
        },
        
        contact() {
            return `
                <strong>📞 Kontakta oss:</strong><br><br>
                
                <div style="background:var(--dk-secondary);padding:16px;border-radius:8px;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                        <span style="font-size:20px;">📧</span>
                        <div>
                            <strong>E-post</strong><br>
                            <a href="mailto:${CONFIG.email}" style="color:var(--dk-accent);font-size:15px;">${CONFIG.email}</a>
                        </div>
                    </div>
                    
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                        <span style="font-size:20px;">📱</span>
                        <div>
                            <strong>Telefon/SMS</strong><br>
                            <a href="tel:${CONFIG.phone}" style="color:var(--dk-accent);font-size:15px;">${CONFIG.phoneDisplay}</a>
                        </div>
                    </div>
                    
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:20px;">🕐</span>
                        <div>
                            <strong>Öppettider</strong><br>
                            ${CONFIG.workHours}
                        </div>
                    </div>
                </div><br>
                
                <em>Vi svarar vanligtvis inom 2 timmar under öppettider!</em><br>
                <em>För brådskande ärenden, ring oss gärna.</em>
            `;
        },
        
        about() {
            return `
                <strong>🏛️ Om Dream Kilim (Dekorist)</strong><br><br>
                
                Vi är en svensk familjeägd mattbutik med rötter i Anatolien. Sedan 2015 förmedlar vi handknutna och vävda mattor direkt från producenterna till ditt hem.<br><br>
                
                <strong>Vår filosofi:</strong><br>
                • Äkta hantverk till rimliga priser<br>
                • Rättvis handel med vävare<br>
                • Hållbart sortiment<br>
                • Personlig service<br><br>
                
                <strong>Vårt lager:</strong> Stockholm<br>
                <strong>Frakt:</strong> Hela Sverige<br><br>
                
                <em>"Varje matta har en historia. Vi hjälper dig hitta din."</em> 🧡
            `;
        },
        
        campaign() {
            const onSale = productsCache.filter(p => p.discount_price && p.base_price && p.discount_price < p.base_price);
            
            if (onSale.length === 0) {
                return `
                    <strong>Just nu har vi inga aktiva kampanjer.</strong><br><br>
                    Men missa inte våra <a href="/category.html" style="color:var(--dk-accent);">bästsäljare</a>!<br><br>
                    <em>🎁 Tips: Anmäl dig till vårt nyhetsbrev för exklusiva erbjudanden.</em>
                `;
            }
            
            const bestDeals = onSale
                .sort((a, b) => ((b.base_price - b.discount_price) / b.base_price) - ((a.base_price - a.discount_price) / a.base_price))
                .slice(0, 3);
            
            return `
                <strong>🔥 Aktuella erbjudanden:</strong><br><br>
                ${bestDeals.map(p => {
                    const discount = Math.round(((p.base_price - p.discount_price) / p.base_price) * 100);
                    return `
                        <div style="background:#fff3e0;padding:12px;border-radius:8px;margin-bottom:10px;border-left:4px solid #ff9800;">
                            <a href="/matta/${p.slug}" style="color:var(--dk-accent);font-weight:600;">${p.name}</a><br>
                            <span style="font-size:20px;font-weight:700;">${p.discount_price.toLocaleString('sv-SE')} SEK</span>
                            <span style="text-decoration:line-through;opacity:0.6;margin-left:8px;">${p.base_price.toLocaleString('sv-SE')} SEK</span>
                            <span style="background:#ff9800;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;margin-left:8px;">-${discount}%</span>
                        </div>
                    `;
                }).join('')}<br>
                
                <a href="/category.html" style="color:var(--dk-accent);">Se alla reamattor →</a>
            `;
        },
        
        unknown() {
            return `
                <em>Ursäkt, jag förstod inte riktigt. 😅</em><br><br>
                
                Jag kan hjälpa dig med:<br>
                • 🏠 <em>Hitta mattor</em> — skriv t.ex. "vardagsrum" eller "persisk"<br>
                • 📏 <em>Storleksguide</em><br>
                • 🚚 <em>Leveransinfo</em><br>
                • 💰 <em>Priser</em><br>
                • 📞 <em>Kontakta oss</em><br><br>
                
                <strong>Eller nå oss direkt:</strong><br>
                📧 <a href="mailto:${CONFIG.email}" style="color:var(--dk-accent);">${CONFIG.email}</a><br>
                📱 <a href="tel:${CONFIG.phone}" style="color:var(--dk-accent);">${CONFIG.phoneDisplay}</a>
            `;
        }
    };
    
    // ==========================================
    // CHAT ARAYUZU
    // ==========================================
    
    const ChatUI = {
        trigger: null,
        window: null,
        messages: null,
        input: null,
        typing: null,
        isOpen: false,
        messageCount: 0,
        
        init() {
            this.trigger = document.getElementById('chat-trigger');
            this.window = document.getElementById('chat-window');
            this.messages = document.getElementById('chat-messages');
            this.input = document.getElementById('chat-input');
            this.typing = document.getElementById('chat-typing');
            
            if (!this.trigger || !this.window) {
                console.warn('[Chatbot] HTML elementleri bulunamadi - chat-trigger veya chat-window eksik');
                return false;
            }
            
            // Event listeners
            this.trigger.addEventListener('click', () => this.toggle());
            document.getElementById('close-chat')?.addEventListener('click', () => this.close());
            document.getElementById('send-chat')?.addEventListener('click', () => this.send());
            this.input?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.send();
            });
            
            // ESC ile kapat
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) this.close();
            });
            
            console.log('[Chatbot] Basarili sekilde baslatildi!');
            return true;
        },
        
        toggle() {
            this.isOpen = !this.isOpen;
            this.window.classList.toggle('active', this.isOpen);
            this.trigger.classList.toggle('hidden', this.isOpen);
            if (this.isOpen) {
                this.input?.focus();
                if (this.messageCount === 0) {
                    this.addBotMessage(ResponseBuilder.greeting());
                }
            }
        },
        
        close() {
            this.isOpen = false;
            this.window.classList.remove('active');
            this.trigger.classList.remove('hidden');
        },
        
        async send() {
            const text = this.input?.value.trim();
            if (!text) return;
            
            this.addUserMessage(text);
            this.input.value = '';
            
            this.messageCount++;
            if (this.messageCount > CONFIG.maxMessages) {
                this.clearOldMessages();
            }
            
            this.showTyping(true);
            
            await new Promise(r => setTimeout(r, 600 + Math.random() * 800));
            
            const analysis = ChatEngine.analyze(text);
            let response;
            
            if (analysis.intent === 'product_detail' && analysis.product) {
                response = ResponseBuilder.product_detail(analysis);
            } else if (ResponseBuilder[analysis.intent]) {
                response = ResponseBuilder[analysis.intent](analysis);
            } else {
                response = ResponseBuilder.unknown();
            }
            
            this.showTyping(false);
            this.addBotMessage(response);
        },
        
        addUserMessage(text) {
            const div = document.createElement('div');
            div.className = 'user-msg';
            div.textContent = text;
            this.messages.appendChild(div);
            this.scrollToBottom();
        },
        
        addBotMessage(html) {
            const div = document.createElement('div');
            div.className = 'bot-msg';
            div.innerHTML = html;
            this.messages.appendChild(div);
            this.scrollToBottom();
        },
        
        showTyping(show) {
            if (this.typing) {
                this.typing.style.display = show ? 'flex' : 'none';
                if (show) this.scrollToBottom();
            }
        },
        
        scrollToBottom() {
            if (this.messages) {
                this.messages.scrollTop = this.messages.scrollHeight;
            }
        },
        
        clearOldMessages() {
            const allMsgs = this.messages.querySelectorAll('.bot-msg, .user-msg');
            if (allMsgs.length > 20) {
                for (let i = 0; i < allMsgs.length - 20; i++) {
                    allMsgs[i].remove();
                }
            }
            this.messageCount = 20;
        }
    };
    
    // ==========================================
    // BASLATMA
    // ==========================================
    
    function initChatbot() {
        // Urunleri yukle
        loadProducts();
        
        // UI'i baslat
        const success = ChatUI.init();
        
        if (!success) {
            console.warn('[Chatbot] Init basarisiz, 2 saniye sonra tekrar denenecek...');
            setTimeout(initChatbot, 2000);
        }
    }
    
    // DOM hazir oldugunda baslat
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatbot);
    } else {
        initChatbot();
    }
    
})();
