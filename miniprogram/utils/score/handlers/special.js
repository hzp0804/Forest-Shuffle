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
            if (slotCard) {
              // 如果有 list，遍历 list 中的所有卡片
              if (slotCard.list && slotCard.list.length > 0) {
                slotCard.list.forEach(sc => {
                  if (sc.name === targetName) targetCount += 1;
                });
              } else {
                // 没有 list，说明是普通卡片
                if (slotCard.name === targetName) {
                  targetCount += 1;
                }
              }
            }
          });
        }
      });
    }

    // 4. 查表得分 (支持分组循环: e.g. 7张一组, 第8张算下一组)
    const keys = Object.keys(conf.scale).map(Number).sort((a, b) => a - b);
    const maxKey = keys[keys.length - 1]; // 最大阶梯 (e.g. 7)

    let remaining = targetCount;
    let totalScore = 0;

    // 只要剩余数量超过 maxKey，就按满组计算
    while (remaining >= maxKey) {
      totalScore += (conf.scale[maxKey] || 0);
      remaining -= maxKey; // 减去一组的数量
    }

    // 处理剩余部分
    if (remaining > 0) {
      // 找最大的 key <= remaining
      let bestKey = 0;
      for (let k of keys) {
        if (k <= remaining) bestKey = k;
        else break;
      }
      totalScore += (conf.scale[bestKey] || 0);
    }

    return totalScore;
  }

  return 0;
};

/**
 * 处理 BUTTERFLY_SET 类型的计分
 * 逻辑：蝴蝶组计分 (Set Collection)
 * 规则：统计所有蝴蝶，按不同名字组成集合。如果在某个集合中名字重复，则放入下一个集合。
 * 每个集合作为一组计分，每组内不同名字的蝴蝶数量 * value。
 */
const handleButterflySet = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  const { getAllCardsFromContext, getCardEffectiveName } = require('../helpers');
  const allCards = getAllCardsFromContext(context);

  // 1. 找到所有蝴蝶 (Tag = BUTTERFLY)
  const butterflies = allCards.filter(c => c.tags && c.tags.includes(TAGS.BUTTERFLY));

  if (butterflies.length === 0) return 0;

  // 2. 只有 UID 最小的一张蝴蝶负责由于“蝴蝶集合”产生的总分
  //    以此避免每张蝴蝶都算一遍全家福
  butterflies.sort((a, b) => (a.uid > b.uid ? 1 : -1));
  if (card.uid !== butterflies[0].uid) {
    return 0;
  }

  // 3. 统计每种名字蝴蝶的数量
  const nameCounts = {};
  butterflies.forEach(b => {
    const name = getCardEffectiveName(b);
    if (name) {
      nameCounts[name] = (nameCounts[name] || 0) + 1;
    }
  });

  // 4. 贪婪分组
  let totalScore = 0;
  const unitValue = conf.value || 1; // 默认每张1分 (基于不同种类)

  // 只要还有蝴蝶没处理完
  while (true) {
    let currentSetSize = 0;
    let hasCardInSet = false;

    // 遍历所有名字，每种取一张放入当前 Set
    Object.keys(nameCounts).forEach(name => {
      if (nameCounts[name] > 0) {
        nameCounts[name]--;
        currentSetSize++;
        hasCardInSet = true;
      }
    });

    if (!hasCardInSet) break; // 没有剩余卡牌了

    // 计分: 当前组大小 * 单价
    // 根据描述: "各为一组...同组不重名...按不同名字计分"
    // 通常意味着每组得分 = 组内不同数量 * unitValue
    totalScore += currentSetSize * unitValue;
  }

  return totalScore;
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
  handleButterflySet,
  handleMajority
};
