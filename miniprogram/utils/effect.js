const { EFFECT_TYPES } = require('../data/enums');
const { TAGS, CARD_TYPES } = require('../data/constants');

/**
 * 计算即时效果 (Immediate Effect)
 * Effect 不需要同色支付
 * @param {Object} card - 主牌
 * @param {Object} context - 上下文 { forest }
 * @param {Array} paymentCards - 支付卡片数组（暂未使用）
 * @returns {Object} 效果结果 { drawCount, extraTurn, actions, text }
 */
function calculateEffect(card, context, paymentCards) {
  const result = {
    drawCount: 0,
    actions: []
  };

  const config = card.effectConfig;

  if (config) {
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
        result.text = "鼹鼠特殊行动";
        result.actions.push(config);
        break;
      case EFFECT_TYPES.ACTION_RACCOON:
        result.text = "浣熊特殊行动";
        result.actions.push(config);
        break;
      case EFFECT_TYPES.ACTION_BEAR:
        result.text = "洞穴收入";
        result.actions.push(config);
        break;
      case EFFECT_TYPES.FREE_PLAY_BAT:
        result.text = "免费打出蝙蝠";
        result.actions.push(config);
        break;
      case EFFECT_TYPES.ACTION_REMOVE_CLEARING:
      case EFFECT_TYPES.ACTION_CLEARING_TO_CAVE:
      case EFFECT_TYPES.ACTION_PICK_FROM_CLEARING:
      case EFFECT_TYPES.ACTION_PLAY_SAPLINGS:
        result.actions.push(config);
        break;
    }
  }

  // 补充基础效果描述
  if (!result.text) {
    const parts = [];
    if (result.drawCount > 0) parts.push(`摸${result.drawCount}张`);
    if (result.extraTurn) parts.push("额外回合");
    if (parts.length > 0) {
      result.text = parts.join("+");
    } else if (card.effect) {
      result.text = card.effect;
    }
  }

  return result;
}

/**
 * 计算常驻效果 (Trigger Effects)
 * 即已经在森林里的物种携带的奖励，当打出某个物种的回合，打出的卡片本身不触发其常驻奖励
 * @param {Array} forest - 森林卡牌数组
 * @param {Object} playedCard - 刚打出的卡片
 * @param {Object} triggerContext - 触发上下文 { slot }
 * @returns {Object} 触发效果结果 { drawCount, actions }
 */
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
    // 规则：当打出此物种的回合是不会触发其自身的常驻奖励的
    if (card.uid === playedCard.uid) return;

    if (!card.effectConfig) return;
    const config = card.effectConfig;

    switch (config.type) {
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
  calculateEffect,
  calculateTriggerEffects
};
