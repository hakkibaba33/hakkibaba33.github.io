const fs = require('fs');
const path = require('path');

// Tüm olası key isimlerini kontrol et
const API_KEY = process.env.AIRTABLE_API_KEY 
    || process.env.AIRTABLE_TOKEN 
    || process.env.NEXT_PUBLIC_AIRTABLE_API_KEY
    || '';

const BASE_ID = process.env.AIRTABLE_BASE_ID 
    || process.env.AIRTABLE_BASE 
    || '';

const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME 
    || process.env.AIRTABLE_TABLE 
    || 'products';

// STRIPE
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY 
    || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    || '';

const STRIPE_SUCCESS_URL = process.env.STRIPE_SUCCESS_URL 
    || 'https://dikrug.se/tack';

const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL 
    || 'https://dikrug.se/kassa';

console.log('=== BUILD CONFIG START ===');
console.log('API_KEY bulundu mu:', API_KEY ? 'EVET (' + API_KEY.substring(0, 10) + '...)' : 'HAYIR');
console.log('BASE_ID bulundu mu:', BASE_ID ? 'EVET' : 'HAYIR');
console.log('STRIPE_PUBLISHABLE_KEY bulundu mu:', STRIPE_PUBLISHABLE_KEY ? 'EVET (' + STRIPE_PUBLISHABLE_KEY.substring(0, 20) + '...)' : 'HAYIR');

const configContent = `const CONFIG = {
    AIRTABLE: {
        API_KEY: '${API_KEY}',
        BASE_ID: '${BASE_ID}',
        TABLE_NAME: '${TABLE_NAME}'
    },
    STRIPE: {
        PUBLISHABLE_KEY: '${STRIPE_PUBLISHABLE_KEY}',
        SUCCESS_URL: '${STRIPE_SUCCESS_URL}',
        CANCEL_URL: '${STRIPE_CANCEL_URL}'
    }
};`;

// Dosya yolu - Vercel'de çalışması için absolute path
const outputPath = path.join(process.cwd(), 'assets', 'js', 'config.js');

// Klasör yoksa oluştur
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Klasör oluşturuldu:', dir);
}

fs.writeFileSync(outputPath, configContent);
console.log('✅ config.js yazıldı:', outputPath);

// Dosyayı okuyup doğrula
const written = fs.readFileSync(outputPath, 'utf8');
console.log('Dosya boyutu:', written.length, 'karakter');
console.log('STRIPE içinde mi:', written.includes('STRIPE') ? 'EVET' : 'HAYIR');
console.log('=== BUILD CONFIG END ===');