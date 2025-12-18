const { SCORING_TYPES } = require('../data/enums');
const { TAGS, CARD_TYPES } = require('../data/constants');

/**
 * 计算游戏得分
 */

// 缓存: OpenId -> { hash: String, result: Object }
const scoreCache = new Map();

/**
 * 生成游戏状态的简易哈希 (基于所有玩家森林中卡牌的UID)
 * 只要场上没有任何卡牌变动，不仅数量，UID组合不变，则认为分值不变
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
              if (s.stackedCards) s.stackedCards.forEach(sc => parts.push(sc.uid));
            }
          })
        }
      });
    }
  });
  return parts.join('|');
}

function calculateTotalScore(playerState, openId, allPlayerStates, nickName) {
  if (!playerState) return { total: 0, breakdown: {} };

  // 性能优化: 检查缓存
  const currentHash = generateGameStateHash(allPlayerStates);
  const cacheKey = openId; // 针对每个玩家分别缓存
  const cached = scoreCache.get(cacheKey);

  if (cached && cached.hash === currentHash) {
    // 状态未变，直接返回缓存结果 (不打印日志以减少噪音)
    return cached.result;
  }

  let total = 0;
  const breakdown = {};

  // 1. 遍历 Forest 计算得分
  const pointsCards = getAllCardsFromContext(playerState);

  // 优化：统一预统计（Tag数量, 颜色数量, 名字数量）
  const stats = precalculateStats(playerState);

  // 用于存储每张卡的得分，以便后续按森林结构输出日志
  const cardScores = {};

  pointsCards.forEach(card => {
    // 传入 stats 以优化查找
    const s = calculateCardScore(card, playerState, allPlayerStates, openId, stats);
    if (s > 0) {
      total += s;
      cardScores[card.uid] = s;
    }
  });

  // 构建按森林结构排序的得分清单 (Debug)
  const structuredLog = [];
  if (playerState.forest) {
    playerState.forest.forEach((group, index) => {
      const groupLog = { index }; // 树木序号

      const getLog = (card) => {
        if (!card) return null;
        const score = cardScores[card.uid] || 0;
        let name = card.name;
        // 标记套牌 (如: 欧洲七叶树)
        if (card.scoreConfig && card.scoreConfig.type === SCORING_TYPES.SCALE_BY_COUNT) {
          name = `${name}(套牌)`;
        }

        // 添加ID标识 (用户要求: 西方狍(101):3)
        const tid = card.id || card.cardId || '?';
        return `${name}(${tid}):${score}`;
      };

      if (group.center) groupLog['中'] = getLog(group.center);
      if (group.slots) {
        if (group.slots.top) groupLog['上'] = getLog(group.slots.top);
        if (group.slots.bottom) groupLog['下'] = getLog(group.slots.bottom);
        if (group.slots.left) groupLog['左'] = getLog(group.slots.left);
        if (group.slots.right) groupLog['右'] = getLog(group.slots.right);

        // 检查堆叠卡 (Stacked Cards)
        ['top', 'bottom', 'left', 'right'].forEach(pos => {
          const slotCard = group.slots[pos];
          if (slotCard && slotCard.stackedCards && slotCard.stackedCards.length > 0) {
            const stackLogs = slotCard.stackedCards.map(sc => getLog(sc)).filter(l => l && !l.endsWith(':0'));
            if (stackLogs.length > 0) {
              groupLog[`${pos}_stack`] = stackLogs;
            }
          }
        });
      }
      // 只记录有得分的组，或者是空的？用户想看森林排序，最好全输出或者只输出有分的树
      // 既然是清单，全部输出比较直观
      structuredLog.push(groupLog);
    });
  }

  // 优化：只在分数变化时才打印日志（通过检查缓存）
  // 如果是从缓存返回的，说明分数没变，不需要打印
  if (!cached || cached.hash !== currentHash) {
    console.log(`[得分清单 ${nickName || openId}]:`, structuredLog);
    console.log(`[共计得分 ${nickName || openId}]:`, total);
  }

  // 2. 遍历 Cave 计算得分 (如果 Cave 里的卡有分的话，通常洞穴卡只有 effect)
  // 胡兀鹫是根据洞穴数量得分，已经在 CAVE_COUNT 处理了。
  // 注意: CAVE_COUNT 是 V-Card (通常放外面)。如果洞穴里有计分卡？
  // 森林卡牌游戏里，洞穴里主要是用来作为费用的卡，或者是某些特殊效果卡进入。
  // 通常洞穴里的卡不产生分数，除非被 specific rules (如胡兀鹫) 引用。
  // 胡兀鹫本身是在 Forest 里的。

  const result = { total, breakdown };
  if (currentHash) {
    scoreCache.set(cacheKey, { hash: currentHash, result });
  }
  return result;
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

/**
 * 辅助: 获取卡牌的有效名称 (处理 SPECIES_ALIAS)
 */
function getCardEffectiveName(card) {
  if (card.effectConfig && card.effectConfig.type === 'SPECIES_ALIAS') {
    return card.effectConfig.target || card.name;
  }
  return card.name;
}

/**
 * 辅助: 获取卡牌的计数价值 (处理 TREE_MULTIPLIER)
 */
function getCardCountValue(card, targetTag) {
  let value = 1;
  if (card.effectConfig && card.effectConfig.type === 'TREE_MULTIPLIER') {
    // 如果 targetTag 是树，且此卡是树 (通常紫木蜂是在树上生效，或者它本身就是树?)
    // 紫木蜂: "This tree counts as 2 trees". 它通常是一只昆虫，必须放在树上?
    // 不，紫木蜂是 Insect. 效果是 "This tree counts as 2 trees".
    // 这意味着它所在的 parent tree 算作 2 棵树。
    // 这逻辑有点绕。如果紫木蜂在树A上，树A在算 PER_TAG(TREE) 时算 2。
    // 那么我们在遍历树的时候，需要检查树上的附件是否有紫木蜂。

    // 重新思考: TREE_MULTIPLIER 是赋予所在的树的属性。
    // 但是紫木蜂如果只作为附件，我们在 calculateEffect 里没法直接改树的属性。
    // 这里只是为了算分。

    // 目前简化处理: 如果是统计 TAG，而此卡声明了 TREE_MULTIPLIER，
    // 它是说“这棵树算2棵”。如果是紫木蜂本身，它是不是树? 不是。
    // 所以当我们在遍历 Tree 时，要检查 Tree 上的 Slots。

    // 这个 helper 目前可能只适用于简单情况 (如果卡本身有 multiplier)。
    // 鉴于紫木蜂是 Attach 卡，这个逻辑要在 PER_TAG 循环里处理 parent。
    // 暂时返回 1，留待 loop 内部处理。
  }
  return value;
}

function calculateCardScore(card, context, allPlayerStates, myOpenId, stats) {
  if (!card.scoreConfig) return 0;

  const config = card.scoreConfig;
  let score = 0;

  // 确保 stats 存在 (降级处理)
  const currentStats = stats || precalculateStats(context);
  const { tagCounts, colorCounts, nameCounts } = currentStats;

  // 提取所有卡牌（用于 SCALE_BY_COUNT 等需要遍历所有卡的计分类型）
  const allCards = [];
  if (context && context.forest) {
    context.forest.forEach(group => {
      if (group.center) allCards.push(group.center);
      if (group.slots) {
        Object.values(group.slots).forEach(slotCard => {
          if (slotCard) {
            allCards.push(slotCard);
            // 包括堆叠卡
            if (slotCard.stackedCards && Array.isArray(slotCard.stackedCards)) {
              slotCard.stackedCards.forEach(sc => allCards.push(sc));
            }
          }
        });
      }
    });
  }

  switch (config.type) {
    // 统计拥有指定 Tag 的卡牌数量
    case SCORING_TYPES.PER_TAG:
      // 直接查表 (注意: TREE_MULTIPLIER 已经被 precalculateStats 处理在 tagCounts['树'] 里了)
      score = (tagCounts[config.tag] || 0) * (config.value || 0);
      break;

    // 统计带有指定 Tag 的卡牌中，有多少种不同的物种 (基于有效名称去重)
    case SCORING_TYPES.PER_DIFFERENT_TAG:
    // 例如: 每张不同的蝴蝶牌得1分
    case SCORING_TYPES.PER_DIFFERENT_TAG:
      const uniqueSpecies = new Set();
      allCards.forEach(c => {
        if (c.tags && c.tags.includes(config.tag)) {
          // 使用有效名称 (处理 SPECIES_ALIAS)
          const name = getCardEffectiveName(c);
          if (name) uniqueSpecies.add(name);
        }
      });
      score = uniqueSpecies.size * (config.value || 0);
      break;

    // 若位于指定名称的卡牌上，获得分数（如: 苍头燕雀-山毛榉）
    case SCORING_TYPES.POSITION_ON_CARD:
      let parentTree = null;
      if (context.forest) {
        for (const group of context.forest) {
          if (group.slots) {
            const slots = Object.values(group.slots);
            if (slots.some(s => s && s.uid === card.uid)) {
              parentTree = group.center;
              break;
            }
          }
        }
      }

      if (parentTree && config.target && parentTree.name === config.target) {
        score = (config.value || 0);
      }
      break;

    // 固定分 (如: 泽龟 5分)
    case SCORING_TYPES.FLAT:
      score = config.value || 0;
      break;

    // 每张某物种 (如: 树蛙-蚊子5分)
    case SCORING_TYPES.PER_SPECIES:
      let speciesCount = 0;
      allCards.forEach(c => {
        // 使用有效名称匹配
        if (getCardEffectiveName(c) === config.target) {
          speciesCount++;
        }
      });
      score = speciesCount * (config.value || 0);
      break;

    // 每种不同的物种
    case SCORING_TYPES.PER_DIFFERENT_SPECIES:
      const allUnique = new Set();
      allCards.forEach(c => {
        const name = getCardEffectiveName(c);
        if (name) allUnique.add(name);
      });
      score = allUnique.size * (config.value || 0);
      break;

    // 根据数量阶梯计分 (如: 萤火虫/欧洲七叶树)
    case SCORING_TYPES.SCALE_BY_COUNT:
      // 首先统计符合条件的目标数量（通常是自身）
      const targetName = config.target || card.name;

      // 收集所有同名卡以便去重计分
      const matchingCards = allCards.filter(c => c.name === targetName);
      const targetCount = matchingCards.length;

      // 避免重复计分：只有 UID 最小（或排序第一）的那张卡获得分数
      // 确保 matchingCards 排序稳定
      matchingCards.sort((a, b) => (a.uid > b.uid ? 1 : -1));

      if (matchingCards.length > 0 && card.uid === matchingCards[0].uid) {
        // 我是第一张，我负责拿分
        if (config.scale) {
          if (config.scale[targetCount] !== undefined) {
            score = config.scale[targetCount];
          } else {
            // 找最大的 key <= targetCount
            const keys = Object.keys(config.scale).map(Number).sort((a, b) => a - b);
            let bestKey = 0;
            for (let k of keys) {
              if (k <= targetCount) bestKey = k;
              else break;
            }
            score = config.scale[bestKey] || 0;
          }
        }
      } else {
        // 其他同名卡不得分（或显示0分）
        score = 0;
      }
      break;

    // 达到阈值获得固定分 (如: 苔藓-10树得10分)
    case SCORING_TYPES.THRESHOLD:
      let thresholdCount = 0;
      allCards.forEach(c => {
        // 检查条件，通常是 Tag 或 Species
        if (config.tag && c.tags && c.tags.includes(config.tag)) {
          thresholdCount++;
        }
        // 或者其他条件
      });
      if (thresholdCount >= (config.threshold || 0)) {
        score = config.value || 0;
      }
      break;

    // 集齐特定集合 (如: 野草莓-8种树)
    case SCORING_TYPES.SET_COLLECTION:
      const collectionSet = new Set();
      allCards.forEach(c => {
        if (config.tag && c.tags && c.tags.includes(config.tag)) {
          if (c.name) collectionSet.add(c.name);
        }
      });
      if (collectionSet.size >= (config.count || 8)) {
        score = config.value || 0;
      }
      break;

    // 与特定卡牌共享槽位 (如: 大蟾蜍)
    case SCORING_TYPES.POSITION_SHARE_SLOT:
      // 寻找自己所在的 group 和 slot
      let foundSlot = null;
      if (context.forest) {
        for (const group of context.forest) {
          if (group.slots) {
            const slots = Object.values(group.slots);
            const mainCard = slots.find(s => s && s.uid === card.uid);
            if (mainCard) {
              foundSlot = mainCard;
              break;
            }
            if (!foundSlot) {
              for (const s of slots) {
                if (s && s.stackedCards) {
                  if (s.stackedCards.some(sc => sc.uid === card.uid)) {
                    foundSlot = s;
                    break;
                  }
                }
              }
            }
          }
          if (foundSlot) break;
        }
      }

      if (foundSlot) {
        let stackCount = 1 + (foundSlot.stackedCards ? foundSlot.stackedCards.length : 0);
        if (config.target && foundSlot.name === config.target) {
          if (config.count && stackCount >= config.count) {
            score = config.value || 0;
          }
        }
      }
      break;

    // 连接到此牌的牌 (如: 银杉)
    case SCORING_TYPES.CONDITION_ATTACHED:
      const myGroup = context.forest ? context.forest.find(g => g.center && g.center.uid === card.uid) : null;
      if (myGroup && myGroup.slots) {
        let attachedCount = 0;
        Object.values(myGroup.slots).forEach(s => {
          if (s) {
            attachedCount += (1 + (s.stackedCards ? s.stackedCards.length : 0));
          }
        });
        score = attachedCount * (config.value || 0);
      }
      break;

    // 全场每张树下的牌得2分 (红褐林蚁)
    case SCORING_TYPES.CONDITION_BELOW:
      let belowCount = 0;
      if (context.forest) {
        context.forest.forEach(g => {
          if (g.slots && g.slots.bottom) {
            belowCount += (1 + (g.slots.bottom.stackedCards ? g.slots.bottom.stackedCards.length : 0));
          }
        });
      }
      score = belowCount * (config.value || 0);
      break;

    // 全场每棵完全被占据的树木 (石貂)
    case SCORING_TYPES.CONDITION_TREE_FULL:
      let fullTreeCount = 0;
      if (context.forest) {
        context.forest.forEach(g => {
          if (g.slots) {
            const hasTop = !!g.slots.top;
            const hasBottom = !!g.slots.bottom;
            const hasLeft = !!g.slots.left;
            const hasRight = !!g.slots.right;
            if (hasTop && hasBottom && hasLeft && hasRight) {
              fullTreeCount++;
            }
          }
        });
      }
      score = fullTreeCount * (config.value || 0);
      break;

    // 洞穴内卡牌数量 (如: 胡兀鹫)
    case SCORING_TYPES.CAVE_COUNT:
      if (context.cave) {
        score = context.cave.length * (config.value || 0);
      }
      break;

    // 位于特定Tag上 (如: 欧洲林鼬->树或灌木)
    case SCORING_TYPES.CONDITION_ON_TAG:
    // 位于特定子类型上 (如: 夜莺->灌木)
    case SCORING_TYPES.CONDITION_ON_SUBTYPE:
      // 检查 parent tree (center card) 是否有目标 tag
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
      if (parentForTag && config.tag && parentForTag.tags && parentForTag.tags.includes(config.tag)) {
        score = config.value || 0;
      }
      break;

    // 根据同色卡牌数量得分 (如: 西方狍)
    // 1、获取当前卡牌的颜色（tree_symbol）
    // 2、统计全森林中同色卡牌数量
    // 3、乘以 config.value
    case SCORING_TYPES.GET_POINTS_BY_COLOR:
      let matchCount = 0;
      const mySymbol = card.tree_symbol?.[0];
      if (mySymbol) {
        matchCount = colorCounts[mySymbol] || 0;
      }
      score = matchCount * (config.value || 0);
      break;

    // 数量比别人多 (如: 椴树 - 树木最多得3分 / 椴树本身数量最多)
    case SCORING_TYPES.MAJORITY:
      if (allPlayerStates) {
        let myCount = 0;
        // 尝试使用预统计数据
        if (config.target && nameCounts[config.target] !== undefined) {
          myCount = nameCounts[config.target];
        } else if (config.tag && tagCounts && tagCounts[config.tag || TAGS.TREE] !== undefined) {
          myCount = tagCounts[config.tag || TAGS.TREE];
        } else {
          // Fallback
          if (config.target) myCount = getCountByName(context, config.target);
          else myCount = getCountByTag(context, config.tag || TAGS.TREE);
        }

        let isMajor = true;
        Object.entries(allPlayerStates).forEach(([otherId, otherState]) => {
          if (otherId !== myOpenId) {
            let otherCount = 0;
            if (config.target) {
              otherCount = getCountByName(otherState, config.target);
            } else {
              const targetTag = config.tag || TAGS.TREE;
              otherCount = getCountByTag(otherState, targetTag);
            }

            if (otherCount > myCount) {
              isMajor = false;
            }
          }
        });

        if (isMajor) {
          score = config.value || 0;
        } else {
          score = config.valueOnFail || 0;
        }
      } else {
        score = config.value || 0;
      }
      break;

    // 每张某名称的卡牌 (如: 欧洲野兔、树蛙->蚊子)
    case SCORING_TYPES.PER_NAME:
      const nameCount = nameCounts[config.target] || 0;
      score = nameCount * (config.value || 0);
      break;

    // 每张带有多个Tag之一的卡牌 (如: 马鹿->树木或植物, 金雕->爪印或两栖)
    case SCORING_TYPES.PER_TAG_OR:
      let orTagCount = 0;
      if (config.tags && Array.isArray(config.tags)) {
        config.tags.forEach(tag => {
          orTagCount += (tagCounts[tag] || 0);
        });
      }
      score = orTagCount * (config.value || 0);
      break;

    // 每张带有多个名称之一的卡牌 (如: 欧洲野牛->橡木或山毛榉)
    case SCORING_TYPES.PER_NAME_OR:
      let orNameCount = 0;
      if (config.targets && Array.isArray(config.targets)) {
        config.targets.forEach(targetName => {
          orNameCount += (nameCounts[targetName] || 0);
        });
      }
      score = orNameCount * (config.value || 0);
      break;

    // 达到数量条件获得分数 (如: 苔藓->至少10棵树, 山毛榉->至少4棵山毛榉)
    case SCORING_TYPES.CONDITION_ON_COUNT:
      let conditionCount = 0;
      if (config.target) {
        conditionCount = nameCounts[config.target] || 0;
      } else if (config.tag) {
        conditionCount = tagCounts[config.tag] || 0;
      }
      if (conditionCount >= (config.minCount || 0)) {
        score = config.value || 0;
      }
      break;

    // 拥有某名称卡牌获得分数 (如: 猞猁->至少1只西方狍, 野猪->至少1只小野猪)
    case SCORING_TYPES.CONDITION_HAS_NAME:
      const hasNameCount = nameCounts[config.target] || 0;
      if (hasNameCount >= 1) {
        score = config.value || 0;
      }
      break;

    // 同一树上有蝙蝠获得分数 (如: 欧洲睡鼠)
    case SCORING_TYPES.CONDITION_WITH_BAT:
      let foundBatOnSameTree = false;
      if (context.forest) {
        for (const group of context.forest) {
          // 检查这张卡是否在这个group的slot中
          let cardInThisGroup = false;
          if (group.slots) {
            Object.values(group.slots).forEach(s => {
              if (s && (s.uid === card.uid || (s.stackedCards && s.stackedCards.some(sc => sc.uid === card.uid)))) {
                cardInThisGroup = true;
              }
            });
          }

          if (cardInThisGroup) {
            // 检查同一个group的其他slot是否有蝙蝠
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
        score = config.value || 0;
      }
      break;

    // 不同种类蝙蝠数量 (如: 所有蝙蝠卡->至少3种不同蝙蝠得5分)
    case SCORING_TYPES.DIFFERENT_BATS:
      const uniqueBats = new Set();
      allCards.forEach(c => {
        if (c.tags && c.tags.includes('蝙蝠')) {
          uniqueBats.add(c.name);
        }
      });
      if (uniqueBats.size >= (config.minCount || 3)) {
        score = config.value || 0;
      }
      break;

    // 集齐8种不同的树木 (如: 野草莓、橡树)
    case SCORING_TYPES.COLLECT_ALL_TREES:
      const uniqueTrees = new Set();
      allCards.forEach(c => {
        if (c.tags && c.tags.includes('树')) {
          uniqueTrees.add(c.name);
        }
      });
      if (uniqueTrees.size >= 8) {
        score = config.value || 0;
      }
      break;

    // 每张树下的卡 (如: 红褐林蚁)
    case SCORING_TYPES.PER_CARD_UNDER_TREE:
      let underTreeCount = 0;
      if (context.forest) {
        context.forest.forEach(g => {
          if (g.slots && g.slots.bottom) {
            underTreeCount += (1 + (g.slots.bottom.stackedCards ? g.slots.bottom.stackedCards.length : 0));
          }
        });
      }
      score = underTreeCount * (config.value || 0);
      break;

    // 每棵完全占据的树 (如: 石貂)
    case SCORING_TYPES.PER_FULL_TREE:
      let fullCount = 0;
      if (context.forest) {
        context.forest.forEach(g => {
          if (g.slots) {
            if (g.slots.top && g.slots.bottom && g.slots.left && g.slots.right) {
              fullCount++;
            }
          }
        });
      }
      score = fullCount * (config.value || 0);
      break;

    // 连接到这棵树的每张卡 (如: 银杉)
    case SCORING_TYPES.PER_CARD_ON_TREE:
      const cardGroup = context.forest ? context.forest.find(g => g.center && g.center.uid === card.uid) : null;
      if (cardGroup && cardGroup.slots) {
        let attachedCount = 0;
        Object.values(cardGroup.slots).forEach(s => {
          if (s) {
            attachedCount += (1 + (s.stackedCards ? s.stackedCards.length : 0));
          }
        });
        score = attachedCount * (config.value || 0);
      }
      break;

    // 位于灌木上 (如: 夜莺)
    case SCORING_TYPES.POSITION_ON_SHRUB:
      let parentShrub = null;
      if (context.forest) {
        for (const group of context.forest) {
          if (group.slots) {
            const slots = Object.values(group.slots);
            if (slots.some(s => s && s.uid === card.uid)) {
              parentShrub = group.center;
              break;
            }
          }
        }
      }
      if (parentShrub && parentShrub.tags && parentShrub.tags.includes('灌木')) {
        score = config.value || 0;
      }
      break;

    // 位于树或灌木上 (如: 欧洲林鼬)
    case SCORING_TYPES.POSITION_ON_TREE_OR_SHRUB:
      let parentTreeOrShrub = null;
      if (context.forest) {
        for (const group of context.forest) {
          if (group.slots) {
            const slots = Object.values(group.slots);
            if (slots.some(s => s && s.uid === card.uid)) {
              parentTreeOrShrub = group.center;
              break;
            }
          }
        }
      }
      if (parentTreeOrShrub && parentTreeOrShrub.tags &&
        (parentTreeOrShrub.tags.includes('树') || parentTreeOrShrub.tags.includes('灌木'))) {
        score = config.value || 0;
      }
      break;
  }

  return score;
}

// 辅助: 统计某 Tag 的数量 (包括 Tree Multiplier 逻辑)
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
      // 检查 slots (是否也要统计 slot 里的 tag? 通常是的)
      if (g.slots) {
        Object.values(g.slots).forEach(s => {
          if (s && s.tags && s.tags.includes(tag)) {
            count++;
          }
        });
      }
    });
  }
  return count;
}

// 辅助: 统计某 Name 的数量
function getCountByName(paramContext, name) {
  let count = 0;
  if (paramContext.forest) {
    paramContext.forest.forEach(g => {
      if (g.center && (g.center.name === name)) {
        count++;
      }
      if (g.slots) {
        Object.values(g.slots).forEach(s => {
          if (s) {
            if (s.name === name) count++;
            if (s.stackedCards) {
              s.stackedCards.forEach(sc => {
                if (sc.name === name) count++;
              });
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
  const tagCounts = {};
  const colorCounts = {};
  const nameCounts = {};

  if (!context.forest) return { tagCounts, colorCounts, nameCounts };

  const processCard = (card) => {
    if (!card) return;

    // 1. Count Tags
    if (card.tags && Array.isArray(card.tags)) {
      card.tags.forEach(t => {
        let val = 1;
        // 特殊处理 Tree Multiplier (仅当统计 Tree Tag 时生效，这里简单全量统计? 
        // 只有当查询 TAGS.TREE 时才应该算2。为了通用性，我们可以在这里通过特殊key或者逻辑处理?)
        // 为了保持 TagCounts 纯净，这里只存物理数量。Multiplier 逻辑最好在 Specific Lookup 时处理?
        // 但用户要求"统一统计"。
        // 让我们硬编码：如果是 Tree 标签，且有 Multiplier，则该卡对 "树" 贡献 +1 (总共2)。
        // 为了方便，我们在 tagCounts 中直接加

        tagCounts[t] = (tagCounts[t] || 0) + 1;

        // 如果是 Tree 且有 Multiplier，额外加一次 Tree 计数
        if (t === TAGS.TREE && card.effectConfig && card.effectConfig.type === 'TREE_MULTIPLIER') {
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        }
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

      // 处理 TREATED_AS 效果 (如: 雪兔被视为欧洲野兔)
      if (card.effectConfig && card.effectConfig.type === 'TREATED_AS' && card.effectConfig.target) {
        nameCounts[card.effectConfig.target] = (nameCounts[card.effectConfig.target] || 0) + 1;
      }
    }
  };

  context.forest.forEach(group => {
    if (group.center) processCard(group.center);
    if (group.slots) {
      Object.values(group.slots).forEach(s => {
        if (s) {
          processCard(s);
          if (s.stackedCards) s.stackedCards.forEach(processCard);
        }
      });
    }
  });

  return { tagCounts, colorCounts, nameCounts };
}

/**
 * 获取缓存的分数（用于优化性能）
 * @param {string} openId - 玩家 openId
 * @returns {Object|null} 缓存的分数数据，如果没有缓存则返回 null
 */
function getCachedScore(openId) {
  const cached = scoreCache.get(openId);
  return cached ? cached.result : null;
}

module.exports = {
  calculateTotalScore,
  calculateCardScore,
  getCachedScore
};

