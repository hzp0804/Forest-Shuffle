const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'miniprogram/data/cardData.js');
let content = fs.readFileSync(filePath, 'utf8');

const splitMarker = 'const getCardVisual =';
const splitIndex = content.indexOf(splitMarker);

if (splitIndex !== -1) {
  const newContent = content.substring(0, splitIndex) +
    `// 导出常量以便其他模块使用
module.exports = {
  CARDS_DATA,
  SPECIES_DATA,
};
`;
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('Successfully removed visual functions from cardData.js');
} else {
  console.log('Could not find getCardVisual in cardData.js');
}
