// ==========================================
// FRONTEND SEO CONTENT LOADER v3
// Debug modlu, hata yakalama
// ==========================================

async function loadSeoContentForPage(pageSlug) {
    const container = document.getElementById('seo-content');
    const inner = document.getElementById('seo-inner');

    console.log('[SEO] Başlatılıyor...');
    console.log('[SEO] pageSlug:', pageSlug);
    console.log('[SEO] container:', container);
    console.log('[SEO] inner:', inner);

    if (!container || !inner) {
        console.error('[SEO] container veya inner bulunamadı!');
        return;
    }

    const SUPABASE_URL = window.SUPABASE_URL || 'https://mowyhsssmpjrwxzvelax.supabase.co';
    const SUPABASE_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vd3loc3NzbXBqcnd4enZlbGF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNTAyODUsImV4cCI6MjA5ODcyNjI4NX0.7cfd5Ikx7nS0GqomBS3axiJ20Jz6X9h3Yk_j6Kg3lF8';

    console.log('[SEO] SUPABASE_URL:', SUPABASE_URL);

    try {
        // URL oluştur
        const url = new URL(SUPABASE_URL + '/rest/v1/seo_content');
        url.searchParams.append('page_slug', 'eq.' + pageSlug);
        url.searchParams.append('is_active', 'eq.true');
        url.searchParams.append('select', '*');
        url.searchParams.append('order', 'sort_order.asc');

        console.log('[SEO] API URL:', url.toString());

        const res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY,
                'Content-Type': 'application/json'
            }
        });

        console.log('[SEO] Response status:', res.status);
        console.log('[SEO] Response ok:', res.ok);

        if (!res.ok) {
            const errText = await res.text();
            console.error('[SEO] API Hatası:', res.status, errText);
            throw new Error('API Hatası: ' + res.status + ' - ' + errText);
        }

        const items = await res.json();
        console.log('[SEO] Gelen veri sayısı:', items.length);
        console.log('[SEO] Gelen veri:', items);

        if (items.length === 0) {
            console.log('[SEO] Veri bulunamadı, section gizleniyor');
            container.style.display = 'none';
            return;
        }

        const item = items[0];
        console.log('[SEO] İlk item:', item);

        // Meta tag'leri güncelle
        if (item.title) {
            document.title = item.title;
            console.log('[SEO] Title güncellendi:', item.title);
        }

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
            console.log('[SEO] Meta description tag oluşturuldu');
        }
        if (item.meta_description) {
            metaDesc.setAttribute('content', item.meta_description);
            console.log('[SEO] Meta description güncellendi:', item.meta_description);
        }

        // İçeriği render et
        const contentHtml = items.map(i => i.content).join('\n');
        inner.innerHTML = `
            <h2>${item.title}</h2>
            <div class="seo-body">
                ${contentHtml}
            </div>
        `;
        container.style.display = 'block';
        console.log('[SEO] İçerik render edildi ✓');

    } catch (e) {
        console.error('[SEO] HATA:', e);
        container.style.display = 'none';
    }
}