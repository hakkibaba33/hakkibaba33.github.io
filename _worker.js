export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // /produkt/slug-adi → /produkt/index.html
    if (path.startsWith('/produkt/') && path !== '/produkt/' && path !== '/produkt/index.html') {
      return env.ASSETS.fetch(new URL('/produkt/index.html', request.url));
    }
    
    // /mattor/... → /mattor/index.html
    if (path.startsWith('/mattor/') && path !== '/mattor/' && path !== '/mattor/index.html') {
      return env.ASSETS.fetch(new URL('/mattor/index.html', request.url));
    }
    
    // Diğer kategoriler için aynı mantık...
    
    // Varsayılan: statik dosyaları serve et
    return env.ASSETS.fetch(request);
  }
};
