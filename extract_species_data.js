const fs = require('fs');
const path = require('path');

const cardDataPath = path.join(__dirname, 'miniprogram/data/cardData.js');
const speciesDataPath = path.join(__dirname, 'miniprogram/data/speciesData.js');

let cardDataContent = fs.readFileSync(cardDataPath, 'utf8');

// 1. Extract SPECIES_DATA object
// Searching for "const SPECIES_DATA = {" and the finding the matching closing brace is complex with regex due to nested braces.
// We will use a simpler approach: assume SPECIES_DATA starts at the beginning and find where it likely ends before CARDS_DATA starts or $f definition.

const startMarker = 'const SPECIES_DATA = {';
const endMarker = 'let $f = (data) => {';

const startIndex = cardDataContent.indexOf(startMarker);
const endIndex = cardDataContent.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find SPECIES_DATA block markers.');
  process.exit(1);
}

// Extract the block including the closing brace before $f
// We need to find the last closing brace before `let $f`.
// Actually, the structure is:
// const SPECIES_DATA = { ... }
// let $f = ...
// So we can take everything from startMarker up to the line before endMarker.

let speciesDataBlock = cardDataContent.substring(startIndex, endIndex).trim();

// Remove the "const SPECIES_DATA = " part to get just the object content if we want to re-wrap or just keep it.
// The user wants to extract it to speciesData.js.

// 2. Create speciesData.js content
// It needs to require constants too.
const constantsImport = "const { DECK_TYPES, CARD_TYPES, TAGS, SPECIES_NAMES } = require('./constants');\n\n";
const moduleExport = "\nmodule.exports = { SPECIES_DATA };\n";

const newSpeciesDataFileContent = constantsImport + speciesDataBlock + moduleExport;

fs.writeFileSync(speciesDataPath, newSpeciesDataFileContent, 'utf8');
console.log('Created miniprogram/data/speciesData.js');

// 3. Update cardData.js
// Remove SPECIES_DATA block.
// Add require for SPECIES_DATA.

const newCardDataContent = cardDataContent.substring(0, startIndex) +
  `const { SPECIES_DATA } = require('./speciesData');\n\n` +
  cardDataContent.substring(endIndex);

// Also check exports.
// The original file exported SPECIES_DATA at the end:
// module.exports = { CARDS_DATA, SPECIES_DATA };
// This is still valid if we import it, but effectively we are re-exporting it.
// However, the request implies pulling it out. `cardData.js` might not need to define it, just use it or re-export it.
// Since `CARDS_DATA` does NOT use `SPECIES_DATA` directly (it uses `SPECIES_NAMES` constants), `cardData.js` might not even need validation logic *inside* it depending on usage.
// But we keep the import to allow re-exporting so other files don't break immediately if they require it from cardData.js.

fs.writeFileSync(cardDataPath, newCardDataContent, 'utf8');
console.log('Updated miniprogram/data/cardData.js');
