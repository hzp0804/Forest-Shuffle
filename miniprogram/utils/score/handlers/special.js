const { TAGS } = require('../../../data/constants');
const { getCountByName, getCountByTag, getAllCardsFromContext } = require('../helpers');

const handleCaveCount = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;

  // context 可能只包含 forest，需要从 playerStates 或传入完整的 playerState 获取 cave
  // 通常 calculateTotalScore 传入的是 playerState (包含 hand, forest, cave)
  // 如果 context 只有 forest，需要检查是否可以访问 cave
  if (context.cave && Array.isArray(context.cave)) {
    const score = context.cave.length * (conf.value || 0);
    console.log(`🦅 [${card.name}] 洞穴卡牌数量: ${context.cave.length}, 得分: ${score}`);
    return score;
  }

  // 如果 cave 字段不存在，这通常是旧数据的问题，应该在 processGameData 中被修复
  console.warn(`⚠️ [${card.name}] cave 字段不存在或无效 (cave=${JSON.stringify(context.cave)}), 返回 0 分`);
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
          // 检查 Multiplier（紫木蜂效果只对山毛榉和欧洲七叶树有效）
          const isValidTree = targetName === '山毛榉' || targetName === '欧洲七叶树';
          if (isValidTree && group.slots) {
            const hasMultiplier = Object.values(group.slots).some(s =>
              s && s.effectConfig && s.effectConfig.type === 'TREE_MULTIPLIER'
            );
            if (hasMultiplier) {
              targetCount += 1;
            }
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
 * 只有 UID 最小的蝴蝶负责计算所有套的总分，其他蝴蝶得0分
 */
const handleButterflySet = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  const { getAllCardsFromContext, getCardEffectiveName } = require('../helpers');
  const allCards = getAllCardsFromContext(context);

  // 1. 找到所有蝴蝶 (Tag = BUTTERFLY)
  const butterflies = allCards.filter(c => c.tags && c.tags.includes(TAGS.BUTTERFLY));

  if (butterflies.length === 0) return 0;

  // 2. 只有 UID 最小的蝴蝶负责计算总分
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

  // 4. 贪婪分组，计算所有套的总分
  let totalScore = 0;
  const nameCountsCopy = { ...nameCounts };

  while (true) {
    let currentSetSize = 0;
    let hasCardInSet = false;

    // 遍历所有名字，每种取一张放入当前套
    Object.keys(nameCountsCopy).forEach(name => {
      if (nameCountsCopy[name] > 0) {
        nameCountsCopy[name]--;
        currentSetSize++;
        hasCardInSet = true;
      }
    });

    if (!hasCardInSet) break; // 没有剩余卡牌了

    // 计算当前套的得分
    if (conf.scale) {
      // 使用阶梯计分表
      totalScore += (conf.scale[currentSetSize] || 0);
    } else {
      // 使用简单的线性计分
      totalScore += currentSetSize * (conf.value || 1);
    }
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
