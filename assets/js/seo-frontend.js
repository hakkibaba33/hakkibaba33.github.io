// ==========================================
// FRONTEND SEO CONTENT LOADER v4.1
// "Läs mer" / "Visa mindre" butonu eklendi
// FIX: Cache buster header'a taşındı
// ==========================================

async function loadSeoContentForPage(pageSlug) {
    const container = document.getElementById('seo-content');
    const inner = document.getElementById('seo-inner');

    console.log('[SEO] Başlatılıyor...');
    console.log('[SEO] pageSlug:', pageSlug);

    if (!container || !inner) {
        console.error('[SEO] container veya inner bulunamadı!');
        return;
    }

    const SUPABASE_URL = window.SUPABASE_URL || 'https://mowyhsssmpjrwxzvelax.supabase.co';
    const SUPABASE_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vd3loc3NzbXBqcnd4enZlbGF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNTAyODUsImV4cCI6MjA5ODcyNjI4NX0.7cfd5Ikx7nS0GqomBS3axiJ20Jz6X9h3Yk_j6Kg3lF8';

    try {
        const url = new URL(SUPABASE_URL + '/rest/v1/seo_content');
        url.searchParams.append('page_slug', 'eq.' + pageSlug);
        url.searchParams.append('active', 'eq.true');
        url.searchParams.append('select', '*');
        url.searchParams.append('order', 'sort_order.asc');

        const res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',           // Cache buster
                'Pragma': 'no-cache'                   // Cache buster
            }
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error('API Hatası: ' + res.status + ' - ' + errText);
        }

        const items = await res.json();
        console.log('[SEO] Gelen items:', items);

        if (items.length === 0) {
            container.style.display = 'none';
            return;
        }

        const item = items[0];
        console.log('[SEO] İlk item:', item);

        // Meta tag'leri güncelle
        if (item.title) {
            document.title = item.title;
        }

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
        }
        if (item.meta_description) {
            metaDesc.setAttribute('content', item.meta_description);
        }

        // İçeriği "Läs mer" butonu ile render et
        const contentHtml = items.map(i => i.content).join('\n');
        console.log('[SEO] Content HTML:', contentHtml.substring(0, 100) + '...');

        inner.innerHTML = `
            <h2 class="seo-title">${item.title}</h2>
            <div class="seo-text-body" id="seo-text-body">
                ${contentHtml}
            </div>
            <div class="seo-read-more-wrapper">
                <button class="seo-read-more-btn" id="seo-read-more-btn" onclick="toggleSeoContent()">
                    Läs mer
                </button>
            </div>
        `;
        
        container.style.display = 'block';
        console.log('[SEO] İçerik render edildi ✓');

    } catch (e) {
        console.error('[SEO] HATA:', e);
        container.style.display = 'none';
    }
}

// "Läs mer" / "Visa mindre" toggle
function toggleSeoContent() {
    const body = document.getElementById('seo-text-body');
    const btn = document.getElementById('seo-read-more-btn');
    
    if (!body || !btn) return;
    
    const isExpanded = body.classList.toggle('expanded');
    btn.classList.toggle('active', isExpanded);
    
    if (isExpanded) {
        btn.innerHTML = `Visa mindre`;
    } else {
        btn.innerHTML = `Läs mer`;
        document.getElementById('seo-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}