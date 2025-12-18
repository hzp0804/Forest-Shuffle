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

  // 主牌颜色（已经过 enrichCardWithSpecies 处理为单色）
  let targetColors = primaryCard.tree_symbol || [];
  if (!Array.isArray(targetColors)) targetColors = [targetColors];

  if (targetColors.length === 0) return true;

  // 检查每张支付卡是否至少有一个颜色匹配
  return paymentCards.every(payCard => {
    const payColors = getCardColors(payCard);
    // 支付卡的任一颜色在主牌颜色中即可
    return payColors.some(c => targetColors.includes(c));
  });
};

module.exports = {
  getCardColors,
  isColorMatched
};
