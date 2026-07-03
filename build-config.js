const fs = require('fs');

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

console.log('API_KEY bulundu mu:', API_KEY ? 'EVET' : 'HAYIR');
console.log('BASE_ID bulundu mu:', BASE_ID ? 'EVET' : 'HAYIR');

const configContent = `const CONFIG = {
    AIRTABLE: {
        API_KEY: '${API_KEY}',
        BASE_ID: '${BASE_ID}',
        TABLE_NAME: '${TABLE_NAME}'
    }
};`;

fs.writeFileSync('assets/js/config.js', configContent);
console.log('✅ config.js olusturuldu!');