// ==========================================
// CLOUDFLARE PAGES FUNCTIONS - SPA ROUTING
// ==========================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 1. Statik dosyaları (CSS, JS, resim) olduğu gibi serve et
    if (path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
      return env.ASSETS.fetch(request);
    }

    // 2. YENİ EKLENEN STATİK SAYFALAR (Burada dosyaları doğrudan eşleştiriyoruz)
    
    // KOOPVILLKOR YÖNLENDİRMESİ
    if (path === '/kopvillkor' || path === '/kopvillkor/' || path === '/kopvillkor/index.html') {
      return env.ASSETS.fetch(new URL('/kopvillkor/index.html', request.url));
    }

    // INTEGRITETSPOLICY YÖNLENDİRMESİ
    if (path === '/integritetspolicy' || path === '/integritetspolicy/' || path === '/integritetspolicy/index.html') {
      return env.ASSETS.fetch(new URL('/integritetspolicy/index.html', request.url));
    }

    // KONTAKT YÖNLENDİRMESİ
    if (path === '/kontakt' || path === '/kontakt/' || path === '/kontakt/index.html') {
      return env.ASSETS.fetch(new URL('/kontakt/index.html', request.url));
    }
    
    // 3. /produkt/slug-adi → /produkt/index.html
    if (path.startsWith('/produkt/') && path !== '/produkt/' && path !== '/produkt/index.html') {
      return env.ASSETS.fetch(new URL('/produkt/index.html', request.url));
    }
    
    // /mattor/alt-kategori → /mattor/index.html
    if (path.startsWith('/mattor/') && path !== '/mattor/' && path !== '/mattor/index.html') {
      return env.ASSETS.fetch(new URL('/mattor/index.html', request.url));
    }
    
    // /metervara/alt-kategori → /metervara/index.html
    if (path.startsWith('/metervara/') && path !== '/metervara/' && path !== '/metervara/index.html') {
      return env.ASSETS.fetch(new URL('/metervara/index.html', request.url));
    }
    
    // /gangmattor/alt-kategori → /gangmattor/index.html
    if (path.startsWith('/gangmattor/') && path !== '/gangmattor/' && path !== '/gangmattor/index.html') {
      return env.ASSETS.fetch(new URL('/gangmattor/index.html', request.url));
    }
    
    // /runda-mattor/alt-kategori → /runda-mattor/index.html
    if (path.startsWith('/runda-mattor/') && path !== '/runda-mattor/' && path !== '/runda-mattor/index.html') {
      return env.ASSETS.fetch(new URL('/runda-mattor/index.html', request.url));
    }
    
    // /badrumsmattor/alt-kategori → /badrumsmattor/index.html
    if (path.startsWith('/badrumsmattor/') && path !== '/badrumsmattor/' && path !== '/badrumsmattor/index.html') {
      return env.ASSETS.fetch(new URL('/badrumsmattor/index.html', request.url));
    }
    
    // /gardiner/alt-kategori → /gardiner/index.html
    if (path.startsWith('/gardiner/') && path !== '/gardiner/' && path !== '/gardiner/index.html') {
      return env.ASSETS.fetch(new URL('/gardiner/index.html', request.url));
    }
    
    // /rea/alt-kategori → /rea/index.html
    if (path.startsWith('/rea/') && path !== '/rea/' && path !== '/rea/index.html') {
      return env.ASSETS.fetch(new URL('/rea/index.html', request.url));
    }
    
    // Varsayılan: statik dosyaları serve et (index.html, vs.)
    return env.ASSETS.fetch(request);
  }
};