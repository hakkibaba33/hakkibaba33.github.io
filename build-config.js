const fs = require('fs');

const configContent = `const CONFIG = {
    AIRTABLE: {
        API_KEY: '${process.env.AIRTABLE_API_KEY}',
        BASE_ID: '${process.env.AIRTABLE_BASE_ID}',
        TABLE_NAME: '${process.env.AIRTABLE_TABLE_NAME}'
    }
};`;

fs.writeFileSync('assets/js/config.js', configContent);
console.log('✅ config.js olusturuldu!');