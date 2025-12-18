const { TAGS, CARD_TYPES } = require('../../../data/constants');
const { getCardEffectiveName, getAllCardsFromContext } = require('../helpers');

/**
 * 处理 SET_COLLECTION 类型的计分
 * 逻辑：收集满足特定标签的一组卡牌，若卡牌名称数量达到阈值，获得固定分数
 * 典型应用：野草莓 (8种不同的树木 - 尽管有专门的 COLLECT_ALL_TREES，某些扩展可能用此通用类型)
 * @param {Object} card - 当前计分卡牌
 * @param {Object} context - 游戏上下文 { forest, cave }
 * @param {Object} allPlayerStates - 所有玩家状态
 * @param {String} myOpenId - 当前玩家 OpenId
 * @param {Object} stats - 预统计数据
 */
const handleSetCollection = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  const collectionSet = new Set();

  // 需要遍历所有卡牌，过滤标签，并收集名称
  const allCards = getAllCardsFromContext(context);

  allCards.forEach(c => {
    if (conf.tag && c.tags && c.tags.includes(conf.tag)) {
      if (c.name) collectionSet.add(c.name);
    }
  });

  // 达到数量要求则得分
  if (collectionSet.size >= (conf.count || 8)) {
    return (conf.value || 0);
  }
  return 0;
};

/**
 * 处理 COLLECT_ALL_TREES 类型的计分
 * 逻辑：集齐8种不同的树木
 * 典型应用：野草莓
 * 特殊处理：检查 type 为 TREE 或 tags 包含 TREE/树，并使用 getCardEffectiveName 处理别名
 */
const handleCollectAllTrees = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  const uniqueTrees = new Set();
  const allCards = getAllCardsFromContext(context);

  allCards.forEach(c => {
    // 修正逻辑：检查是否为树木（Type 或 Tag）
    if (c.type === CARD_TYPES.TREE || (c.tags && (c.tags.includes(CARD_TYPES.TREE) || c.tags.includes(TAGS.TREE)))) {
      const name = getCardEffectiveName(c);
      if (name) uniqueTrees.add(name);
    }
  });

  if (uniqueTrees.size >= 8) {
    return (conf.value || 0);
  }
  return 0;
};

module.exports = {
  handleSetCollection,
  handleCollectAllTrees
};
