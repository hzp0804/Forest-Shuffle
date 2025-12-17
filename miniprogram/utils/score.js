const { SCORING_TYPES } = require('../data/enums');
const { TAGS, CARD_TYPES } = require('../data/constants');

/**
 * 计算游戏得分
 */

function calculateTotalScore(playerState, openId) {
  if (!playerState) return { total: 0, breakdown: {} };

  let total = 0;

  // 等待实现具体逻辑...

  return { total, breakdown: {} };
}

/**
 * 辅助：获取上下文中的所有卡牌 (扁平化)
 */
function getAllCardsFromContext(context) {
  const cards = [];
  if (context.forest) {
    context.forest.forEach(group => {
      if (group.center) cards.push(group.center);
      if (group.slots) {
        Object.values(group.slots).forEach(card => {
          if (card) cards.push(card);
        });
      }
    });
  }
  // TODO: 确认是否需要包含洞穴中的卡牌 (通常Tag计分只算森林可见的)
  // if (context.cave) { ... }
  return cards;
}

function calculateCardScore(card, context) {
  if (!card.scoreConfig) return 0;

  const config = card.scoreConfig;
  let score = 0;

  // 获取当前场上所有卡牌以便统计
  const allCards = getAllCardsFromContext(context);

  switch (config.type) {
    case SCORING_TYPES.PER_TAG:
      // 统计拥有指定 Tag 的卡牌数量
      let count = 0;
      allCards.forEach(c => {
        if (c.tags && c.tags.includes(config.tag)) {
          count++;
        }
      });
      score = count * (config.value || 0);
      break;

    // 等待实现更多逻辑...
  }

  return score;
}

module.exports = {
  calculateTotalScore,
  calculateCardScore
};
