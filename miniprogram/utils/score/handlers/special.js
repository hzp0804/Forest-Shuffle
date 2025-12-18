const { TAGS } = require('../../../data/constants');
const { getCountByName, getCountByTag, getAllCardsFromContext } = require('../helpers');

/**
 * 处理 CAVE_COUNT 类型的计分
 * 逻辑：基于洞穴中的卡牌数量得分
 * 典型应用：胡兀鹫 (每张洞穴卡得1分)
 */
const handleCaveCount = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  if (context.cave) {
    return context.cave.length * (conf.value || 0);
  }
  return 0;
};

/**
 * 处理 GET_POINTS_BY_COLOR 类型的计分
 * 逻辑：基于同色卡牌（Tree Symbol）的数量得分
 * 典型应用：西方狍 (每张同色卡得1分)
 */
const handleGetPointsByColor = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  let matchCount = 0;
  // 获取当前卡牌的颜色符号
  const mySymbol = card.tree_symbol?.[0];
  if (mySymbol && stats.colorCounts) {
    matchCount = stats.colorCounts[mySymbol] || 0;
  }
  return matchCount * (conf.value || 0);
};

/**
 * 处理 SCALE_BY_COUNT 类型的计分
 * 逻辑：根据同名卡牌的数量，按阶梯表获得分数。仅第一张同名卡得分。
 * 典型应用：萤火虫 (1->2, 2->5...), 欧洲七叶树
 * 特殊处理：
 * 1. 考虑 TREE_MULTIPLIER (紫木蜂) 增加计数
 * 2. 只有 UID 最小的一张卡生效，避免重复得分
 */
const handleScaleByCount = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  const targetName = conf.target || card.name;

  // 1. 收集所有同名卡
  const allCards = getAllCardsFromContext(context);
  const matchingCards = allCards.filter(c => c.name === targetName);

  // 2. 排序 (UID) 确定谁得分
  matchingCards.sort((a, b) => (a.uid > b.uid ? 1 : -1));

  // 只有列表中的第一张负责得分，其他得0分
  if (matchingCards.length > 0 && card.uid === matchingCards[0].uid) {
    // 3. 计算实际数量 (考虑 Multiplier)
    let targetCount = 0;
    if (context && context.forest) {
      context.forest.forEach(group => {
        // 检查 Center
        if (group.center && group.center.name === targetName) {
          targetCount += 1;
          // 检查 Multiplier
          const hasMultiplier =
            (group.slots?.left?.effectConfig?.type === 'TREE_MULTIPLIER') ||
            (group.slots?.right?.effectConfig?.type === 'TREE_MULTIPLIER');
          if (hasMultiplier) {
            targetCount += 1;
          }
        }
        // 检查 Slots (通常 Slot 卡不受 Tree Multiplier 影响)
        if (group.slots) {
          Object.values(group.slots).forEach(slotCard => {
            if (slotCard && slotCard.name === targetName) {
              targetCount += 1;
            }
            // 检查堆叠卡
            if (slotCard && slotCard.stackedCards) {
              slotCard.stackedCards.forEach(sc => {
                if (sc.name === targetName) targetCount += 1;
              });
            }
          });
        }
      });
    }

    // 4. 查表得分
    if (conf.scale) {
      if (conf.scale[targetCount] !== undefined) {
        return conf.scale[targetCount];
      } else {
        // 找最大的 key <= targetCount
        const keys = Object.keys(conf.scale).map(Number).sort((a, b) => a - b);
        let bestKey = 0;
        for (let k of keys) {
          if (k <= targetCount) bestKey = k;
          else break;
        }
        return conf.scale[bestKey] || 0;
      }
    }
  }

  return 0;
};

/**
 * 处理 MAJORITY 类型的计分
 * 逻辑：与所有其他玩家对比，若自己拥有最多指定Tag/Name的卡牌，则得分
 * 典型应用：椴树 (树木最多得3分)
 */
const handleMajority = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;

  if (allPlayerStates) {
    let myCount = 0;
    // 使用当前玩家的 Stats
    if (conf.target && stats.nameCounts[conf.target] !== undefined) {
      myCount = stats.nameCounts[conf.target];
    } else if (conf.tag && stats.tagCounts[conf.tag || TAGS.TREE] !== undefined) {
      myCount = stats.tagCounts[conf.tag || TAGS.TREE];
    } else {
      // Fallback
      if (conf.target) myCount = getCountByName(context, conf.target);
      else myCount = getCountByTag(context, conf.tag || TAGS.TREE);
    }

    let isMajor = true;
    Object.entries(allPlayerStates).forEach(([otherId, otherState]) => {
      if (otherId !== myOpenId) {
        let otherCount = 0;
        // 对其他玩家需现场计算 (无法复用当前玩家的stats)
        if (conf.target) {
          otherCount = getCountByName(otherState, conf.target);
        } else {
          const targetTag = conf.tag || TAGS.TREE;
          otherCount = getCountByTag(otherState, targetTag);
        }

        if (otherCount > myCount) {
          isMajor = false;
        }
      }
    });

    if (isMajor) {
      return (conf.value || 0);
    } else {
      return (conf.valueOnFail || 0);
    }
  } else {
    // 只有自己时默认满足?
    return (conf.value || 0);
  }
};

module.exports = {
  handleCaveCount,
  handleGetPointsByColor,
  handleScaleByCount,
  handleMajority
};
