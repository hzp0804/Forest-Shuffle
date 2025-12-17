const { BONUS_TYPES, EFFECT_TYPES } = require('../data/enums');
const { TAGS, CARD_TYPES } = require('../data/constants');

/**
 * 计算打牌奖励 (Bonus) 和 触发效果 (Effect)
 */

function calculateColorReward(card, slot, paymentCards) {
  const result = {
    drawCount: 0,
    extraTurn: false,
    playFree: null,
    actions: []
  };

  if (!card.bonusConfig) {
    return result;
  }

  const config = card.bonusConfig;

  // 等待实现具体逻辑...

  return result;
}

function calculateEffect(card, context) {
  const result = {
    drawCount: 0,
    actions: []
  };

  if (!card.effectConfig) return result;

  const config = card.effectConfig;

  // 等待实现具体逻辑...

  return result;
}

module.exports = {
  calculateColorReward,
  calculateEffect
};
