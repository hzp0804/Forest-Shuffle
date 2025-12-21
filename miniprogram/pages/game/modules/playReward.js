const { calculateReward, calculateTriggerEffects } = require("../../../utils/reward.js");

/**
 * 计算出牌奖励
 * 包括 Bonus、Effect 和 Trigger Effects
 */
function calculatePlayRewards(page, primaryCard, selectedSlot, paymentCards, forest, source, gameState) {
  let bonus = { drawCount: 0, extraTurn: false, actions: [] };
  let effect = { drawCount: 0, extraTurn: false, actions: [] };

  const isSpecialPlayMode = ['ACTION_MOLE', 'ACTION_PLAY_SAPLINGS', 'PLAY_FREE'].includes(gameState.actionMode);

  if (source === 'PLAYER_ACTION') {
    // 在特殊模式下打牌,不重新触发该牌自身的 Bonus 和 Effect (防止无限循环)
    if (!isSpecialPlayMode) {
      bonus = calculateReward(primaryCard, selectedSlot, paymentCards, {}, true);
      effect = calculateReward(primaryCard, null, paymentCards, { forest }, false);
    }
  }

  // 始终计算森林中已存在的常驻效果触发
  const triggers = calculateTriggerEffects(forest, primaryCard, { slot: selectedSlot });

  const reward = {
    drawCount: (bonus.drawCount || 0) + (effect.drawCount || 0) + (triggers.drawCount || 0),
    extraTurn: bonus.extraTurn || effect.extraTurn,
    actions: [...(bonus.actions || []), ...(effect.actions || [])],
    removeClearingFlag: bonus.removeClearingFlag || effect.removeClearingFlag || false,
    clearingToCaveFlag: bonus.clearingToCaveFlag || effect.clearingToCaveFlag || false
  };

  console.log('🎁 奖励计算详情:', {
    card: primaryCard.name,
    bonus: bonus,
    effect: effect,
    finalReward: reward
  });

  return { bonus, effect, triggers, reward };
}

/**
 * 处理奖励抽牌
 * 从牌堆抽取指定数量的卡牌
 */
function processRewardDraw(deck, hand, drawCount) {
  const newDeck = [...deck];
  const newHand = [...hand];
  const drawnCards = [];

  const currentHandSize = newHand.length;
  const maxCanDraw = 10 - currentHandSize;
  const actualDraw = Math.max(0, Math.min(drawCount, maxCanDraw));

  for (let i = 0; i < actualDraw; i++) {
    if (newDeck.length > 0) {
      const card = newDeck.shift();
      newHand.push(card);
      drawnCards.push(card);
    }
  }

  return { newDeck, newHand, drawnCards, actualDraw };
}

module.exports = {
  calculatePlayRewards,
  processRewardDraw
};
