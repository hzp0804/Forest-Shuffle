const { BONUS_TYPES } = require('../data/enums');
const { isColorMatched } = require('./utils');

/**
 * 计算打牌奖励 (Bonus)
 * Bonus 需要同色支付才能触发
 * @param {Object} card - 主牌（已经过 enrichCardWithSpecies 处理）
 * @param {Object} slot - 选择的插槽
 * @param {Array} paymentCards - 支付卡片数组
 * @returns {Object} 奖励结果 { drawCount, extraTurn, playFree, actions, text }
 */
function calculateBonus(card, slot, paymentCards) {
  const result = {
    drawCount: 0,
    extraTurn: false,
    playFree: null,
    actions: []
  };

  const config = card.bonusConfig;
  if (!config) return result;

  // 验证同色匹配 (Bonus 条件)
  // 如果所有支付卡片中，每一张都至少包含主牌的一个符号，才获得奖励
  if (!isColorMatched(card, paymentCards)) {
    return result; // 如果存在不匹配的支付卡，不触发 Bonus
  }

  if (config) {
    switch (config.type) {
      // 摸牌 (如: 灰林鸮-得2张)
      case BONUS_TYPES.DRAW:
        result.drawCount += (config.count || 0);
        break;

      // 额外回合 (如: 橡树)
      case BONUS_TYPES.EXTRA_TURN:
        result.extraTurn = true;
        break;

      // 摸牌+回合 (如: 棕熊)
      case BONUS_TYPES.DRAW_AND_TURN:
        result.drawCount += (config.count || 0);
        result.extraTurn = true;
        break;

      // 免费打出特定类型牌
      case BONUS_TYPES.PLAY_FREE:
      case BONUS_TYPES.PLAY_FREE_SPECIFIC:
        result.text = `免费打出-${config.tag || '指定卡'}`;
        result.actions.push(config);
        break;
      case BONUS_TYPES.PLAY_FREE_AND_DRAW:
      case BONUS_TYPES.PICK_FROM_CLEARING_TO_HAND:
      case BONUS_TYPES.CLEARING_TO_CAVE:
        result.text = "特殊行动";
        result.actions.push(config);
        break;
    }
  }

  // 补充基础奖励描述
  if (!result.text) {
    const parts = [];
    if (result.drawCount > 0) parts.push(`摸${result.drawCount}张`);
    if (result.extraTurn) parts.push("额外回合");
    if (parts.length > 0) {
      result.text = parts.join("+");
    } else if (card.bonus) {
      result.text = card.bonus;
    }
  }

  return result;
}

module.exports = {
  calculateBonus
};
