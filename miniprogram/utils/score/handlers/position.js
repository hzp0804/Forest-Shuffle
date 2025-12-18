const { getCardEffectiveName } = require('../helpers');

/**
 * 处理 POSITION_ON_CARD 类型的计分
 * 逻辑：若位于指定名称的卡牌上，获得分数
 * 典型应用：苍头燕雀 (位于山毛榉上)
 */
const handlePositionOnCard = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
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

  if (parentTree && conf.target && parentTree.name === conf.target) {
    return (conf.value || 0);
  }
  return 0;
};

/**
 * 处理 POSITION_ON_SHRUB 类型的计分
 * 逻辑：若位于灌木上，获得分数
 * 典型应用：夜莺
 */
const handlePositionOnShrub = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
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
    return (conf.value || 0);
  }
  return 0;
};

/**
 * 处理 POSITION_ON_TREE_OR_SHRUB 类型的计分
 * 逻辑：若位于树或灌木上，获得分数
 * 典型应用：欧洲林鼬
 */
const handlePositionOnTreeOrShrub = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  let parent = null;
  if (context.forest) {
    for (const group of context.forest) {
      if (group.slots) {
        const slots = Object.values(group.slots);
        if (slots.some(s => s && s.uid === card.uid)) {
          parent = group.center;
          break;
        }
      }
    }
  }
  if (parent && parent.tags && (parent.tags.includes('树') || parent.tags.includes('灌木'))) {
    return (conf.value || 0);
  }
  return 0;
};

/**
 * 处理 CONDITION_ATTACHED 类型的计分
 * 逻辑：连接到这棵树的每张卡数量得分
 * 典型应用：银杉 (Silver Fir)
 */
const handleConditionAttached = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  const myGroup = context.forest ? context.forest.find(g => g.center && g.center.uid === card.uid) : null;
  if (myGroup && myGroup.slots) {
    let attachedCount = 0;
    Object.values(myGroup.slots).forEach(s => {
      if (s) {
        attachedCount += (1 + (s.stackedCards ? s.stackedCards.length : 0));
      }
    });
    return attachedCount * (conf.value || 0);
  }
  return 0;
};

/**
 * 处理 CONDITION_BELOW 类型的计分
 * 逻辑：计算全场每张位于树下的卡（即底部槽位卡牌+堆叠）的总分
 * 典型应用：红褐林蚁
 */
const handleConditionBelow = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  let belowCount = 0;
  if (context.forest) {
    context.forest.forEach(g => {
      if (g.slots && g.slots.bottom) {
        belowCount += (1 + (g.slots.bottom.stackedCards ? g.slots.bottom.stackedCards.length : 0));
      }
    });
  }
  return belowCount * (conf.value || 0);
};

/**
 * 处理 CONDITION_TREE_FULL 类型的计分
 * 逻辑：计算全场每棵完全被占据（上下左右）的树木数量总分
 * 典型应用：石貂 (Beech Marten)
 */
const handleConditionTreeFull = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
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
  return fullTreeCount * (conf.value || 0);
};

/**
 * 处理 PER_CARD_UNDER_TREE 类型的计分 (同 CONDITION_BELOW)
 */
const handlePerCardUnderTree = (card, context, allPlayerStates, myOpenId, stats) => {
  return handleConditionBelow(card, context, allPlayerStates, myOpenId, stats);
};

/**
 * 处理 PER_FULL_TREE 类型的计分 (同 CONDITION_TREE_FULL)
 */
const handlePerFullTree = (card, context, allPlayerStates, myOpenId, stats) => {
  return handleConditionTreeFull(card, context, allPlayerStates, myOpenId, stats);
};

/**
 * 处理 PER_CARD_ON_TREE 类型的计分 (同 CONDITION_ATTACHED)
 */
const handlePerCardOnTree = (card, context, allPlayerStates, myOpenId, stats) => {
  return handleConditionAttached(card, context, allPlayerStates, myOpenId, stats);
};

/**
 * 处理 POSITION_SHARE_SLOT 类型的计分
 * 逻辑：与特定卡牌共享槽位（堆叠在一起）
 * 典型应用：(旧版大蟾蜍逻辑)
 */
const handlePositionShareSlot = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
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
            if (s && s.stackedCards && s.stackedCards.some(sc => sc.uid === card.uid)) {
              foundSlot = s;
              break;
            }
          }
        }
      }
      if (foundSlot) break;
    }
  }

  if (foundSlot) {
    let stackCount = 1 + (foundSlot.stackedCards ? foundSlot.stackedCards.length : 0);
    if (conf.target && foundSlot.name === conf.target) {
      if (conf.count && stackCount >= conf.count) {
        return (conf.value || 0);
      }
    }
  }
  return 0;
};

/**
 * 处理 PER_STACKED_CARD 类型的计分
 * 逻辑：每张堆叠在自身下方的卡牌得分
 * 典型应用：大蟾蜍 (每张堆叠卡5分)
 */
const handlePerStackedCard = (card, context, allPlayerStates, myOpenId, stats) => {
  const conf = card.scoreConfig;
  let stackedCount = 0;
  if (context.forest) {
    for (const group of context.forest) {
      if (group.slots) {
        const mySlot = Object.values(group.slots).find(s => s && s.uid === card.uid);
        if (mySlot && mySlot.stackedCards) {
          stackedCount = mySlot.stackedCards.length;
          break;
        }
      }
    }
  }
  return stackedCount * (conf.value || 0);
};

module.exports = {
  handlePositionOnCard,
  handlePositionOnShrub,
  handlePositionOnTreeOrShrub,
  handleConditionAttached,
  handleConditionBelow,
  handleConditionTreeFull,
  handlePerCardUnderTree,
  handlePerFullTree,
  handlePerCardOnTree,
  handlePositionShareSlot,
  handlePerStackedCard
};
