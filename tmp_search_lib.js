const fs = require('fs');
const path = 'Tabelas/USER_TAB_COLUMNS_202604161646.json';
const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
const key = Object.keys(raw)[0];
const data = raw[key];

// Verificar TSILIB
console.log('=== TSILIB ===');
const tsiLib = data.filter(c => c.TABLE_NAME === 'TSILIB').map(c => c.COLUMN_NAME);
console.log(tsiLib.join('\n') || 'Não encontrada');

// Verificar TGFCONFCRED
console.log('\n=== TGFCONFCRED ===');
const confCred = data.filter(c => c.TABLE_NAME === 'TGFCONFCRED').map(c => c.COLUMN_NAME);
console.log(confCred.join('\n') || 'Não encontrada');

// Verificar TSICONF
console.log('\n=== TSICONF ===');
const tsiConf = data.filter(c => c.TABLE_NAME === 'TSICONF').map(c => c.COLUMN_NAME);
console.log(tsiConf.join('\n') || 'Não encontrada');

// Verificar VSILIB
console.log('\n=== VSILIB ===');
const vsiLib = data.filter(c => c.TABLE_NAME === 'VSILIB').map(c => c.COLUMN_NAME);
console.log(vsiLib.join('\n') || 'Não encontrada');

// Verificar VGFLIBEVE
console.log('\n=== VGFLIBEVE ===');
const vgfLibEve = data.filter(c => c.TABLE_NAME === 'VGFLIBEVE').map(c => c.COLUMN_NAME);
console.log(vgfLibEve.join('\n') || 'Não encontrada');
