// ==========================================
// DEKORIST.SE TRACKING - GA4 + Facebook Pixel
// KOŞULLU YÜKLEME (Cookie Consent sonrası)
// ==========================================

// CookieConsent'in seçimini kontrol et
function checkCookieConsent() {
    const consent = localStorage.getItem('cc_cookie');
    
    if (!consent) {
        console.log('[Tracking] Cookie consent not given yet');
        return false;
    }
    
    try {
        const preferences = JSON.parse(consent);
        return preferences.categories || [];
    } catch (e) {
        return [];
    }
}

// ---------- Google Analytics 4 ----------
function loadGoogleAnalytics() {
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-GC40MGMLE1');
    
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-GC40MGMLE1';
    document.head.appendChild(script);
    
    console.log('[Tracking] Google Analytics loaded');
}

// ---------- Facebook Pixel ----------
function loadFacebookPixel() {
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    
    fbq('init', '1846119059653426');
    fbq('track', 'PageView');
    
    console.log('[Tracking] Facebook Pixel loaded');
}

// ---------- BAŞLAT ----------
document.addEventListener('DOMContentLoaded', function() {
    const categories = checkCookieConsent();
    
    // Analitik onaylandıysa GA yükle
    if (categories.includes('analytics')) {
        loadGoogleAnalytics();
    }
    
    // Pazarlama onaylandıysa FB yükle
    if (categories.includes('marketing')) {
        loadFacebookPixel();
    }
    
    // Hiçbiri onaylanmadıysa hiçbirini yükleme!
    if (!categories.includes('analytics') && !categories.includes('marketing')) {
        console.log('[Tracking] No tracking loaded - user declined');
    }
});