const { CARDS_DATA } = require('../data/cardData');

/**
 * 获取卡片的所有颜色符号
 * @param {Object} card 
 * @returns {Array} 颜色字符串数组
 */
const getCardColors = (card) => {
  if (!card) return [];
  const cardInfo = CARDS_DATA[card.id];
  if (!cardInfo) return [];

  const colors = [];
  if (cardInfo.tree_symbol) colors.push(cardInfo.tree_symbol);
  if (cardInfo.tree_symbol_2) colors.push(cardInfo.tree_symbol_2);
  return colors;
};

/**
 * 判断支付卡片是否符合同色要求
 * @param {Object} primaryCard - 主牌（已经过 enrichCardWithSpecies 处理，单色）
 * @param {Array} paymentCards - 支付卡片数组
 * @returns {boolean} 是否所有支付卡都符合同色要求
 */
const isColorMatched = (primaryCard, paymentCards) => {
  if (!paymentCards || paymentCards.length === 0) return true;
  let targetColor = primaryCard.tree_symbol[0] // 主卡颜色
  return paymentCards.every(payCard => { // 费用卡全都包含主卡颜色
    return payCard.tree_symbol.includes(targetColor)
  });
};

module.exports = {
  getCardColors,
  isColorMatched
};
