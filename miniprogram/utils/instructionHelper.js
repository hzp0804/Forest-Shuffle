const {
  getCardCost
} = require("./cost");
const {
  CARD_TYPES,
  TAGS
} = require("../data/constants");
const {
  isColorMatched
} = require('./colorMatcher');

/**
 * 核心文案判断逻辑
 * @param {Object} params
 * @param {Object} params.openId
 * @param {Object} params.playerStates
 * @param {Object} params.gameState
 * @param {Object} params.turnAction
 * @param {String} params.primarySelection
 * @param {Object} params.selectedSlot
 * @param {Object} params.primaryCard - 已经经过 enrichCardWithSpecies 处理的主牌对象
 * @param {Array} params.myHand
 * @param {Number} params.selectedCount
 */
const checkInstruction = (params) => {
  const {
    openId,
    playerStates,
    gameState,
    turnAction,
    primarySelection,
    selectedSlot,
    primaryCard,
    myHand,
    selectedCount
  } = params;

  if (!playerStates?.[openId]) return {
    instructionState: "normal",
    instructionText: "加载中..."
  };

  // 1. 如果处于特殊行动模式，优先显示特殊行动提示
  if (gameState && gameState.actionMode) {
    let text = gameState.actionText || "特殊行动中...";
    return {
      instructionState: "warning",
      instructionText: `✨ 奖励: ${text}`
    };
  }

  const drawnCount = turnAction?.drawnCount || 0;
  const takenCount = turnAction?.takenCount || 0;
  const curTotal = drawnCount + takenCount;

  if (curTotal === 1) {
    return {
      instructionState: "warning",
      instructionText: drawnCount > 0 ? "请再摸一张牌" : "还可以再拿一张牌"
    };
  }

  if (!primarySelection) return {
    instructionState: selectedCount === 0 ? "normal" : "warning",
    instructionText: selectedCount === 0 ? "摸牌 / 出牌" : "请确认主牌选择",
  };

  if (!primaryCard) return {
    instructionState: "error",
    instructionText: "主牌数据异常"
  };

  const payment = selectedCount - 1;
  const type = primaryCard.type;
  let costs = [];

  if (type === CARD_TYPES.TREE) {
    costs = [getCardCost(primaryCard, "center")];
    if (primaryCard.species?.length > 1) costs.push(getCardCost(primaryCard, "center_2"));
  } else if (type === CARD_TYPES.H_CARD) {
    if (selectedSlot?.side === "left") costs = [getCardCost(primaryCard, "left")];
    else if (selectedSlot?.side === "right") costs = [getCardCost(primaryCard, "right")];
    else costs = [getCardCost(primaryCard, "left"), getCardCost(primaryCard, "right")];
  } else if (type === CARD_TYPES.V_CARD) {
    if (selectedSlot?.side === "top") costs = [getCardCost(primaryCard, "top")];
    else if (selectedSlot?.side === "bottom") costs = [getCardCost(primaryCard, "bottom")];
    else costs = [getCardCost(primaryCard, "top"), getCardCost(primaryCard, "bottom")];
  }

  costs = [...new Set(costs)];

  // 如果选中的是树，则完全无视任何已选中的森林插槽
  if (type === CARD_TYPES.TREE) {
    // 树木不需要插槽验证
  } else if (!selectedSlot) {
    return {
      instructionState: "warning",
      instructionText: "请选择森林空位"
    };
  } else {
    // 只有非树卡片才验证插槽合法性
    if (type === CARD_TYPES.H_CARD && !["left", "right"].includes(selectedSlot.side)) {
      return {
        instructionState: "error",
        instructionText: "卡牌需放置在左右槽位"
      };
    }
    if (type === CARD_TYPES.V_CARD && !["top", "bottom"].includes(selectedSlot.side)) {
      return {
        instructionState: "error",
        instructionText: "卡牌需放置在上下槽位"
      };
    }
    const myForest = playerStates[openId].forest || [];
    const targetTree = myForest.find((t) => (t._id || t.uid) === selectedSlot.treeId);
    if (targetTree) {
      const slotContent = targetTree.slots?.[selectedSlot.side] || targetTree[selectedSlot.side];
      if (slotContent) return {
        instructionState: "error",
        instructionText: "该位置已有卡牌"
      };
    }
  }

  const isFreeMode = ['FREE_PLAY_BAT', 'PLAY_SAPLINGS', 'PLAY_FREE'].includes(gameState?.actionMode);

  // 免费模式下的特殊验证
  if (isFreeMode) {
    const mode = gameState.actionMode;
    // 1. 验证卡牌类型限制
    if (mode === 'FREE_PLAY_BAT' && (!primaryCard.tags || !primaryCard.tags.includes(TAGS.BAT))) {
      return { instructionState: "error", instructionText: "✨ 奖励限制: 只能打出带有蝙蝠符号的牌" };
    }
    if (mode === 'PLAY_FREE') {
      const config = (gameState.pendingActions || [])[0];
      if (config && config.tags && Array.isArray(config.tags)) {
        const hasMatchingTag = config.tags.some(tag => primaryCard.tags && primaryCard.tags.includes(tag));
        if (!hasMatchingTag) {
          return { instructionState: "error", instructionText: `✨ 奖励限制: 只能打出带有指定符号的牌` };
        }
      }
    }

    // 2. 验证费用 (免费模式下支付卡必须为0)
    if (payment > 0) {
      return { instructionState: "error", instructionText: "✨ 奖励模式下无需支付额外费用，请取消选中其他手牌" };
    }

    return { instructionState: "success", instructionText: "✨ 免费打出该卡 (费用: 0)" };
  }

  // 支付验证和 instructionLines 生成
  const isSatisfied = costs.some((cost) => payment === cost);
  const lines = {};

  // 1. Cost 行
  if (isSatisfied) {
    lines.cost = { text: "✅ 费用已满足", class: "text-bold" };
  } else {
    lines.cost = {
      text: `❌ 需支付: ${costs.join(" 或 ")} (已付: ${payment})`,
      class: "text-warn"
    };
  }

  const paymentCards = myHand.filter((c) => c.selected && c.uid !== primarySelection);
  const hasBonus = !!primaryCard.bonusConfig;
  const hasEffect = !!primaryCard.effectConfig;

  // 2. Bonus 行
  if (hasBonus) {
    const isBonusMatched = isColorMatched(primaryCard, paymentCards);
    const bonusText = primaryCard.bonus || "奖励";
    lines.bonus = {
      text: `[奖励: ${bonusText}]`,
      class: (isSatisfied && isBonusMatched) ? "text-success" : "text-warn"
    };
  } else {
    // 占位
    lines.bonus = { text: "", class: "" };
  }

  // 3. Effect 行
  if (hasEffect) {
    const effectText = primaryCard.effect || "效果";
    lines.effect = {
      text: `[效果: ${effectText}]`,
      class: isSatisfied ? "text-highlight" : "text-warn"
    };
  } else {
    // 占位
    lines.effect = { text: "", class: "" };
  }

  // 兼容旧逻辑的 segments
  const segments = [];
  segments.push(lines.cost);
  if (lines.bonus && lines.bonus.text) {
    segments.push({ text: " | ", class: "text-gray" });
    segments.push(lines.bonus);
  }
  if (lines.effect && lines.effect.text) {
    segments.push({ text: " | ", class: "text-gray" });
    segments.push(lines.effect);
  }

  const text = segments.map(s => s.text).join(" ");

  return {
    instructionState: isSatisfied ? "success" : "error",
    instructionText: text,
    instructionSegments: segments,
    instructionLines: lines,
  };
};

module.exports = {
  checkInstruction
};
