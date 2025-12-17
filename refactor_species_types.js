const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'miniprogram/data/speciesData.js');
let content = fs.readFileSync(filePath, 'utf8');

// The file already imports CARD_TYPES from ./constants
// We need to replace string literals with constants.
// type: "vCard" -> type: CARD_TYPES.V_CARD
// type: "hCard" -> type: CARD_TYPES.H_CARD
// type: "tree"  -> type: CARD_TYPES.TREE

// It is safest to do string replacement since we know the context is `type: "value"`.
// However, quotes might vary (single vs double). The file seems to use double quotes mostly but maybe single too.

let newContent = content.replace(/type:\s*['"]vCard['"]/g, 'type: CARD_TYPES.V_CARD');
newContent = newContent.replace(/type:\s*['"]hCard['"]/g, 'type: CARD_TYPES.H_CARD');
newContent = newContent.replace(/type:\s*['"]tree['"]/g, 'type: CARD_TYPES.TREE');

// Also check for 'wCard' just in case, though usually not in species data
newContent = newContent.replace(/type:\s*['"]wCard['"]/g, 'type: CARD_TYPES.W_CARD');

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Refactored speciesData.js to use CARD_TYPES constants.');
