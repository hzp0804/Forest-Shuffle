const { getCardEffectiveName } = require('../helpers');

/**
 * 处理 FLAT 类型的计分
 * 逻辑：固定分值
 * 典型应用：泽龟 (5分)
 */
const handleFlat = (card, context, allPlayerStates, myOpenId, stats) => {
  return card.scoreConfig.value || 0;
};

/**
 * 处理 PER_TAG 类型的计分
 * 逻辑：每张拥有特定标签的卡牌得分
 * 典型应用：通用计分卡 (如每张树得1分)
 */
const handlePerTag = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  return (stats.tagCounts[conf.tag] || 0) * (conf.value || 0);
};

/**
 * 处理 PER_SPECIES 类型的计分
 * 逻辑：每张指定物种（有效名称）的卡牌得分
 * 典型应用：树蛙 (每张蚊子得5分)
 */
const handlePerSpecies = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  const count = stats.nameCounts[conf.target] || 0;
  return count * (conf.value || 0);
};

/**
 * 处理 PER_NAME 类型的计分
 * 逻辑：每张指定名称的卡牌得分 (同 PER_SPECIES)
 * 典型应用：欧洲野兔
 */
const handlePerName = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  const count = stats.nameCounts[conf.target] || 0;
  return count * (conf.value || 0);
};

/**
 * 处理 PER_SUBTYPE 类型的计分
 * 逻辑：未实现 (预留接口)
 */
const handlePerSubtype = (card, context, allPlayerStates, myOpenId, stats) => {
  return 0;
};

/**
 * 处理 PER_DIFFERENT_TAG 类型的计分
 * 逻辑：统计拥有指定Tag的卡牌中，有多少种不同的物种
 * 典型应用：蝴蝶 (每种不同的蝴蝶得1分)
 */
const handlePerDifferentTag = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  const { getAllCardsFromContext } = require('../helpers');
  const allCards = getAllCardsFromContext(context);

  const uniqueSpecies = new Set();
  allCards.forEach(c => {
    if (c.tags && c.tags.includes(conf.tag)) {
      const name = getCardEffectiveName(c);
      if (name) uniqueSpecies.add(name);
    }
  });
  return uniqueSpecies.size * (conf.value || 0);
};

/**
 * 处理 PER_DIFFERENT_SPECIES 类型的计分
 * 逻辑：统计所有卡牌中，有多少种不同的物种
 * 典型应用：通用多样性计分
 */
const handlePerDifferentSpecies = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  const { getAllCardsFromContext } = require('../helpers');
  const allCards = getAllCardsFromContext(context);

  const allUnique = new Set();
  allCards.forEach(c => {
    const name = getCardEffectiveName(c);
    if (name) allUnique.add(name);
  });
  return allUnique.size * (conf.value || 0);
};

/**
 * 处理 PER_TAG_OR 类型的计分
 * 逻辑：每张带有指定多个Tag之一的卡牌得分
 * 典型应用：马鹿 (每张树木或植物得1分)
 */
const handlePerTagOr = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  let count = 0;
  if (conf.tags && Array.isArray(conf.tags)) {
    conf.tags.forEach(tag => {
      count += (stats.tagCounts[tag] || 0);
    });
  }
  return count * (conf.value || 0);
};

/**
 * 处理 PER_NAME_OR 类型的计分
 * 逻辑：每张带有指定多个树木符号之一的卡牌得分
 * 典型应用：欧洲野牛 (每张橡木或山毛榉得2分)
 * 注意：targets 中的值是树木符号（如"橡树"、"山毛榉"），应该从 colorCounts 中获取
 */
const handlePerNameOr = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  let count = 0;
  if (conf.targets && Array.isArray(conf.targets)) {
    conf.targets.forEach(targetName => {
      // 使用 colorCounts（树木符号统计）而不是 nameCounts
      count += (stats.colorCounts[targetName] || 0);
    });
  }
  return count * (conf.value || 0);
};

module.exports = {
  handleFlat,
  handlePerTag,
  handlePerSpecies,
  handlePerName,
  handlePerSubtype,
  handlePerDifferentTag,
  handlePerDifferentSpecies,
  handlePerTagOr,
  handlePerNameOr
};
