const fs = require('fs');

// ========== AIRTABLE ==========
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

// ========== STRIPE ==========
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY 
    || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    || '';

const STRIPE_SUCCESS_URL = process.env.STRIPE_SUCCESS_URL 
    || 'https://dikrug.se/tack';

const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL 
    || 'https://dikrug.se/kassa';

console.log('API_KEY bulundu mu:', API_KEY ? 'EVET' : 'HAYIR');
console.log('BASE_ID bulundu mu:', BASE_ID ? 'EVET' : 'HAYIR');
console.log('STRIPE_PUBLISHABLE_KEY bulundu mu:', STRIPE_PUBLISHABLE_KEY ? 'EVET' : 'HAYIR');

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

fs.writeFileSync('assets/js/config.js', configContent);
console.log('✅ config.js olusturuldu!');
