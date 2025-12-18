const { getCardEffectiveName, getAllCardsFromContext } = require('../helpers');

/**
 * 处理 THRESHOLD 类型的计分
 * 逻辑：达到阈值条件（如包含特定Tag的卡牌数量）获得固定分
 * 典型应用：苔藓 (至少10棵树得10分)
 */
const handleThreshold = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  const allCards = getAllCardsFromContext(context);
  let thresholdCount = 0;
  allCards.forEach(c => {
    if (conf.tag && c.tags && c.tags.includes(conf.tag)) {
      thresholdCount++;
    }
  });
  if (thresholdCount >= (conf.threshold || 0)) {
    return (conf.value || 0);
  }
  return 0;
};

/**
 * 处理 CONDITION_ON_COUNT 类型的计分
 * 逻辑：达到特定的数量条件（名称或Tag）获得固定分
 * 典型应用：山毛榉 (至少4棵山毛榉得X分)
 */
const handleConditionOnCount = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  let conditionCount = 0;
  if (conf.target) {
    conditionCount = stats.nameCounts[conf.target] || 0;
  } else if (conf.tag) {
    conditionCount = stats.tagCounts[conf.tag] || 0;
  }
  if (conditionCount >= (conf.minCount || 0)) {
    return (conf.value || 0);
  }
  return 0;
};

/**
 * 处理 CONDITION_HAS_NAME 类型的计分
 * 逻辑：拥有至少一张指定名称的卡牌获得固定分
 * 典型应用：猞猁 (至少1只西方狍), 野猪 (至少1只小野猪)
 */
const handleConditionHasName = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  const hasNameCount = stats.nameCounts[conf.target] || 0;
  if (hasNameCount >= 1) {
    return (conf.value || 0);
  }
  return 0;
};

/**
 * 处理 CONDITION_WITH_BAT 类型的计分
 * 逻辑：若同一棵树上栖息有蝙蝠，获得分数
 * 典型应用：欧洲睡鼠 (与蝙蝠共享一棵树)
 */
const handleConditionWithBat = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  let foundBatOnSameTree = false;
  if (context.forest) {
    for (const group of context.forest) {
      let cardInThisGroup = false;
      if (group.slots) {
        Object.values(group.slots).forEach(s => {
          if (s && (s.uid === card.uid || (s.stackedCards && s.stackedCards.some(sc => sc.uid === card.uid)))) {
            cardInThisGroup = true;
          }
        });
      }

      if (cardInThisGroup) {
        if (group.slots) {
          Object.values(group.slots).forEach(s => {
            if (s && s.tags && s.tags.includes('蝙蝠')) {
              foundBatOnSameTree = true;
            }
          });
        }
        break;
      }
    }
  }
  if (foundBatOnSameTree) {
    return (conf.value || 0);
  }
  return 0;
};

/**
 * 处理 DIFFERENT_BATS 类型的计分
 * 逻辑：拥有不同种类的蝙蝠数量达到一定值
 * 典型应用：蝙蝠集合 (至少3种不同蝙蝠得5分)
 */
const handleDifferentBats = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  const allCards = getAllCardsFromContext(context);
  const uniqueBats = new Set();
  allCards.forEach(c => {
    if (c.tags && c.tags.includes('蝙蝠')) {
      uniqueBats.add(c.name);
    }
  });
  if (uniqueBats.size >= (conf.minCount || 3)) {
    return (conf.value || 0);
  }
  return 0;
};

/**
 * 处理 CONDITION_ON_TAG 类型的计分
 * 逻辑：位于拥有特定Tag的树/灌木上，获得固定分
 * 典型应用：欧洲林鼬
 */
const handleConditionOnTag = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  let parentForTag = null;
  if (context.forest) {
    for (const group of context.forest) {
      if (group.slots) {
        const slots = Object.values(group.slots);
        if (slots.some(s => s && (s.uid === card.uid || (s.stackedCards && s.stackedCards.some(sc => sc.uid === card.uid))))) {
          parentForTag = group.center;
          break;
        }
      }
    }
  }
  if (parentForTag && conf.tag && parentForTag.tags && parentForTag.tags.includes(conf.tag)) {
    return (conf.value || 0);
  }
  return 0;
};

/**
 * 处理 CONDITION_ON_SUBTYPE 类型的计分
 * 逻辑：同 CONDITION_ON_TAG
 */
const handleConditionOnSubtype = (card, context, allPlayerStates, myOpenId, stats) => {
  return handleConditionOnTag(card, context, allPlayerStates, myOpenId, stats);
};

module.exports = {
  handleThreshold,
  handleConditionOnCount,
  handleConditionHasName,
  handleConditionWithBat,
  handleDifferentBats,
  handleConditionOnTag,
  handleConditionOnSubtype
};
