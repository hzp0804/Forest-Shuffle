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
    case BONUS_TYPES.PLAY_FREE_AND_DRAW:
    case BONUS_TYPES.PICK_FROM_CLEARING_TO_HAND:
    case BONUS_TYPES.CLEARING_TO_CAVE:
      // 这些都需要后续用户操作，将 Config 作为 action 返回
      result.actions.push(config);
      break;
  }

  return result;
}

function calculateEffect(card, context) {
  const result = {
    drawCount: 0,
    actions: []
  };

  if (!card.effectConfig) return result;

  const config = card.effectConfig;

  switch (config.type) {
    case EFFECT_TYPES.EXTRA_TURN:
      result.extraTurn = true;
      break;

    // 立即摸牌 (如: 大斑啄木鸟)
    case EFFECT_TYPES.IMMEDIATE_DRAW:
      result.drawCount += (config.count || 0);
      break;

    // 根据场上某物种数量摸牌 (如: 赤狐 - 每有一对野兔摸1张)
    case EFFECT_TYPES.DRAW_PER_EXISTING:
      if (config.tag || config.target) {
        let count = 0;
        if (context && context.forest) {
          const all = [];
          context.forest.forEach(g => {
            if (g.center) all.push(g.center);
            if (g.slots) Object.values(g.slots).forEach(s => s && all.push(s));
          });
          all.forEach(c => {
            if (config.tag && c.tags && c.tags.includes(config.tag)) count++;
            else if (config.target && c.name === config.target) count++;
          });
        }
        const divisor = config.perCount || 1;
        const rewardCount = Math.floor(count / divisor) * (config.value || 1);
        result.drawCount += rewardCount;
      }
      break;

    // 条件额外回合 (如: 仓鸮 -> 有蝙蝠时)
    case EFFECT_TYPES.CONDITION_EXTRATURN:
      if (context && context.forest) {
        let hasCondition = false;
        for (const group of context.forest) {
          if ((group.center && group.center.tags && group.center.tags.includes(config.tag)) ||
            (group.slots && Object.values(group.slots).some(s => s && s.tags && s.tags.includes(config.tag)))) {
            hasCondition = true;
            break;
          }
        }
        if (hasCondition) result.extraTurn = true;
      }
      break;

    // 特殊动作类 (需要交互)
    case EFFECT_TYPES.ACTION_MOLE:
    case EFFECT_TYPES.ACTION_RACCOON:
    case EFFECT_TYPES.ACTION_BEAR:
    case EFFECT_TYPES.FREE_PLAY_BAT:
    case EFFECT_TYPES.ACTION_REMOVE_CLEARING:
    case EFFECT_TYPES.ACTION_CLEARING_TO_CAVE:
    case EFFECT_TYPES.ACTION_PICK_FROM_CLEARING:
    case EFFECT_TYPES.ACTION_PLAY_SAPLINGS:
      result.actions.push(config);
      break;
  }

  return result;
}

function calculateTriggerEffects(forest, playedCard, triggerContext) {
  const result = {
    drawCount: 0,
    actions: []
  };

  if (!forest || !Array.isArray(forest)) return result;

  // 辅助：扁平化森林卡牌
  const allCards = [];
  forest.forEach(group => {
    if (group.center) allCards.push(group.center);
    if (group.slots) {
      Object.values(group.slots).forEach(c => {
        if (c) allCards.push(c);
      });
    }
  });

  // 遍历检查触发
  allCards.forEach(card => {
    if (!card.effectConfig) return;
    const config = card.effectConfig;

    switch (config.type) {
      case EFFECT_TYPES.TRIGGER_ON_PLAY:
      case EFFECT_TYPES.TRIGGER_ON_PLAY_TAG_DRAW:
        // 检查触发条件: 此时打出的牌 playedCard 是否包含目标 tag
        if (playedCard.tags && playedCard.tags.includes(config.tag)) {
          if (config.reward) {
            if (config.reward.type === 'DRAW') {
              result.drawCount += (config.reward.value || 0);
            }
          }
        }
        break;

      case EFFECT_TYPES.TRIGGER_ON_PLAY_POSITION:
        // 检查位置 (如: 牛肝菌-树顶)
        if (triggerContext && triggerContext.slot && triggerContext.slot.side === config.position) {
          let match = true;
          if (config.tag) {
            if (!playedCard.tags || !playedCard.tags.includes(config.tag)) {
              match = false;
            }
          }
          if (match && config.reward) {
            if (config.reward.type === 'DRAW') {
              result.drawCount += (config.reward.value || 0);
            }
          }
        }
        break;
    }
  });

  return result;
}

module.exports = {
  calculateColorReward,
  calculateEffect,
  calculateTriggerEffects
};
