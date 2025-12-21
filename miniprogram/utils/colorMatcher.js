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

  // 主牌的颜色符号可能是一个字符串数组，也可能是一个字符串(如果是旧数据)
  // enrichCardWithSpecies 应该保证它是数组
  let targetColors = primaryCard.tree_symbol;
  if (!Array.isArray(targetColors)) {
    targetColors = [targetColors];
  }

  // 对于双面卡，特定面只有一个颜色，enrichCardWithSpecies 应该已经处理好只保留该面的颜色
  // 如果还有多个颜色，默认取第一个作为该面的主颜色
  const targetColor = targetColors[0];

  if (!targetColor) {
    console.warn("⚠️ isColorMatched: 主牌没有颜色定义", primaryCard.name, primaryCard.tree_symbol);
    return false;
  }

  const result = paymentCards.every(payCard => { // 费用卡全都包含主卡颜色
    let payCardColors = payCard.tree_symbol;
    if (!Array.isArray(payCardColors)) {
      payCardColors = [payCardColors];
    }
    const match = payCardColors.includes(targetColor);
    // console.log(`🔍 颜色匹配: 支付卡[${payCard.name}] 颜色:`, payCardColors, "目标颜色:", targetColor, "匹配:", match);
    return match;
  });

  if (!result) {
    console.log("❌ 颜色匹配失败. 主牌:", primaryCard.name, "目标色:", targetColor, "支付卡:", paymentCards.map(c => `${c.name}(${c.tree_symbol})`));
  } else {
    console.log("✅ 颜色匹配成功. 主牌:", primaryCard.name, "目标色:", targetColor);
  }

  return result;
};

module.exports = {
  getCardColors,
  isColorMatched
};
