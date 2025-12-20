const { TAGS, CARD_TYPES } = require('../../data/constants');

// 缓存: OpenId -> { hash: String, result: Object }
const scoreCache = new Map();

/**
 * 生成游戏状态的简易哈希 (基于所有玩家森林中卡牌的UID)
 */
function generateGameStateHash(allPlayerStates) {
  if (!allPlayerStates) return '';
  const parts = [];
  // 确保顺序固定，以便生成稳定的Hash
  Object.keys(allPlayerStates).sort().forEach(pid => {
    const pState = allPlayerStates[pid];
    if (pState && pState.forest) {
      pState.forest.forEach(g => {
        if (g.center) parts.push(g.center.uid);
        if (g.slots) {
          Object.values(g.slots).forEach(s => {
            if (s) {
              parts.push(s.uid);
              if (s.list) s.list.forEach(sc => parts.push(sc.uid));
            }
          })
        }
      });
    }
  });
  return parts.join('|');
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
          if (card) {
            // 如果有 list，说明是堆叠卡片，list 包含了所有卡片（包括最上面显示的那张）
            // 每张卡片都需要单独计分
            if (card.list && card.list.length > 0) {
              card.list.forEach(sc => cards.push(sc));
            } else {
              cards.push(card);
            }
          }
        });
      }
    });
  }
  return cards;
}

/**
 * 辅助: 获取卡牌的有效名称 (处理 SPECIES_ALIAS)
 */
function getCardEffectiveName(card) {
  if (!card) return null;
  if (card.effectConfig && card.effectConfig.type === 'SPECIES_ALIAS' && card.effectConfig.target) {
    return card.effectConfig.target;
  }
  return card.name;
}

/**
 * 辅助: 获取卡牌的计数价值 (处理 TREE_MULTIPLIER)
 */
function getCardCountValue(card) {
  // 目前保留接口，逻辑在 processCard 中内联处理了
  return 1;
}

/**
 * 辅助: 统计某 Tag 的数量 (包括 Tree Multiplier 逻辑)
 * 注意：这个函数主要用于 Majority 和 On-the-fly 计算，Precalc 也有类似逻辑
 */
function getCountByTag(paramContext, tag) {
  let count = 0;
  if (paramContext.forest) {
    paramContext.forest.forEach(g => {
      // 检查 center
      if (g.center && g.center.tags && g.center.tags.includes(tag)) {
        let val = 1;
        // 检查 Tree Multiplier (仅针对 Tree)
        if (tag === TAGS.TREE && g.slots) {
          const hasMultiplier = Object.values(g.slots).some(s =>
            s && s.effectConfig && s.effectConfig.type === 'TREE_MULTIPLIER'
          );
          if (hasMultiplier) val = 2;
        }
        count += val;
      }
      // 检查 slots（统计所有卡片，包括堆叠中的）
      if (g.slots) {
        Object.values(g.slots).forEach(s => {
          if (s) {
            if (s.list && s.list.length > 0) {
              // 堆叠卡片：list 中的每张卡片都已经过 enrichCardWithSpecies 处理
              // 只包含打出的物种信息，所以需要统计所有卡片
              s.list.forEach(sc => {
                if (sc.tags && sc.tags.includes(tag)) {
                  count++;
                }
              });
            } else {
              if (s.tags && s.tags.includes(tag)) count++;
            }
          }
        });
      }
    });
  }
  return count;
}

/**
 * 辅助: 统计某 Name 的数量
 */
function getCountByName(paramContext, name) {
  let count = 0;
  if (paramContext.forest) {
    paramContext.forest.forEach(g => {
      if (g.center && (g.center.name === name)) {
        count++;
      }
      // 统计所有卡片（包括堆叠中的）
      if (g.slots) {
        Object.values(g.slots).forEach(s => {
          if (s) {
            if (s.list && s.list.length > 0) {
              // 堆叠卡片：list 中的每张卡片都已经过 enrichCardWithSpecies 处理
              // 只包含打出的物种信息，所以需要统计所有卡片
              s.list.forEach(sc => {
                if (sc.name === name) count++;
              });
            } else {
              if (s.name === name) count++;
            }
          }
        });
      }
    });
  }
  return count;
}

/**
 * 统一预统计：Tags, Colors(TreeSymbols), Names
 * 返回 { tagCounts, colorCounts, nameCounts }
 */
function precalculateStats(context) {
  console.log("🌳 统计森林卡牌信息")
  const tagCounts = {};
  const colorCounts = {};
  const nameCounts = {};

  if (!context.forest) return { tagCounts, colorCounts, nameCounts };

  const processCard = (card) => {
    if (!card) return;

    // 1. Count Tags
    if (card.tags && Array.isArray(card.tags)) {
      card.tags.forEach(t => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    }

    // 2. Count Colors (Tree Symbols)
    if (card.tree_symbol && Array.isArray(card.tree_symbol)) {
      card.tree_symbol.forEach(s => {
        colorCounts[s] = (colorCounts[s] || 0) + 1;
      });
    }

    // 3. Count Names
    if (card.name) {
      nameCounts[card.name] = (nameCounts[card.name] || 0) + 1;

      // 处理 SPECIES_ALIAS 效果 (如: 雪兔被视为欧洲野兔，仅用于计分)
      if (card.effectConfig && card.effectConfig.type === 'SPECIES_ALIAS' && card.effectConfig.target) {
        nameCounts[card.effectConfig.target] = (nameCounts[card.effectConfig.target] || 0) + 1;
      }
    }
  };

  context.forest.forEach(group => {
    // 处理树木中心
    if (group.center) {
      processCard(group.center);

      // 检查是否有紫木蜂效果（TREE_MULTIPLIER）
      // 紫木蜂效果只对山毛榉和欧洲七叶树有效
      if (group.slots) {
        const hasMultiplier = Object.values(group.slots).some(s =>
          s && s.effectConfig && s.effectConfig.type === 'TREE_MULTIPLIER'
        );

        const isValidTree = group.center.name === '山毛榉' || group.center.name === '欧洲七叶树';

        if (hasMultiplier && isValidTree && group.center.name) {
          nameCounts[group.center.name] = (nameCounts[group.center.name] || 0) + 1;
        }
      }
    }

    // 处理槽位卡片
    if (group.slots) {
      Object.values(group.slots).forEach(s => {
        if (s) {
          if (s.list && s.list.length > 0) {
            // 堆叠卡片：list 中的每张卡片都已经过 enrichCardWithSpecies 处理
            // 只包含打出的物种信息，所以需要统计所有卡片
            s.list.forEach(processCard);
          } else {
            processCard(s);
          }
        }
      });
    }
  });

  return { tagCounts, colorCounts, nameCounts };
}

/**
 * 获取缓存的分数
 */
function getCachedScore(openId) {
  const cached = scoreCache.get(openId);
  return cached ? cached.result : null;
}

module.exports = {
  scoreCache,
  generateGameStateHash,
  getAllCardsFromContext,
  getCardEffectiveName,
  getCardCountValue,
  getCountByTag,
  getCountByName,
  precalculateStats,
  getCachedScore
};
