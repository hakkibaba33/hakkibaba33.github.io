const fs = require('fs');
const path = require('path');

// SUPABASE
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY 
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || '';

// STRIPE
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY 
    || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    || '';

const STRIPE_SUCCESS_URL = process.env.STRIPE_SUCCESS_URL 
    || 'https://dikrug.se/tack';

const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL 
    || 'https://dikrug.se/kassa';

console.log('=== BUILD CONFIG START ===');
console.log('SUPABASE_URL bulundu mu:', SUPABASE_URL ? 'EVET' : 'HAYIR');
console.log('SUPABASE_ANON_KEY bulundu mu:', SUPABASE_ANON_KEY ? 'EVET (' + SUPABASE_ANON_KEY.substring(0, 20) + '...)' : 'HAYIR');
console.log('STRIPE_PUBLISHABLE_KEY bulundu mu:', STRIPE_PUBLISHABLE_KEY ? 'EVET (' + STRIPE_PUBLISHABLE_KEY.substring(0, 20) + '...)' : 'HAYIR');

const configContent = `const CONFIG = {
    SUPABASE: {
        URL: '${SUPABASE_URL}',
        ANON_KEY: '${SUPABASE_ANON_KEY}'
    },
    STRIPE: {
        PUBLISHABLE_KEY: '${STRIPE_PUBLISHABLE_KEY}',
        SUCCESS_URL: '${STRIPE_SUCCESS_URL}',
        CANCEL_URL: '${STRIPE_CANCEL_URL}'
    }
};`;

const outputPath = path.join(process.cwd(), 'assets', 'js', 'config.js');
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Klasor olusturuldu:', dir);
}

fs.writeFileSync(outputPath, configContent);
console.log('✅ config.js yazildi:', outputPath);

const written = fs.readFileSync(outputPath, 'utf8');
console.log('Dosya boyutu:', written.length, 'karakter');
console.log('SUPABASE icinde mi:', written.includes('SUPABASE') ? 'EVET' : 'HAYIR');
console.log('=== BUILD CONFIG END ===');