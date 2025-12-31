/**
 * 统一校验逻辑模块 - 唯一的真理来源
 * "知行合一" - 所有校验、提示、错误信息都从这里输出
 */

const { getCardCost } = require("./cost");
const { CARD_TYPES, TAGS } = require("../data/constants");
const { isColorMatched } = require('./colorMatcher');

/**
 * 校验 PLAY_FREE 模式的 Tag 匹配
 */
const validatePlayFreeTag = (primaryCard, action) => {
  if (!action || !action.tags || action.tags.length === 0) return { valid: true };
  if (!primaryCard || !primaryCard.tags) return { valid: false };

  const hasTag = action.tags.some(tag => primaryCard.tags.includes(tag));
  return { valid: hasTag };
};

/**
 * 完整的出牌校验
 * @returns {Object} {
 *   valid: boolean,           // 是否允许出牌
 *   error: string,            // 错误信息（用于 Toast）
 *   instructionState: string, // 提示状态（success/error/warning/normal）
 *   instructionText: string,  // 提示文本
 *   instructionLines: object, // 详细提示（费用/奖励/效果）
 *   instructionSegments: array // 用于 WXML 渲染
 * }
 */
const validatePlay = (params) => {
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

  // 基础检查
  if (!playerStates?.[openId]) {
    return {
      valid: false,
      error: "玩家数据异常",
      instructionState: "normal",
      instructionText: "加载中..."
    };
  }

  // 检查是否是当前玩家的回合
  if (gameState && gameState.activePlayer !== openId) {
    return {
      valid: false,
      error: "不是你的回合",
      instructionState: "normal",
      instructionText: "" // 不是自己的回合，不显示文案
    };
  }

  // 1. 特殊行动模式
  if (gameState && gameState.actionMode) {
    const currentAction = (gameState.pendingActions || [])[0];

    // ACTION_TUCK_HAND_CARD 模式
    if (gameState.actionMode === 'ACTION_TUCK_HAND_CARD') {
      const text = "请选择一张手牌叠放在大蟾蜍下";
      if (selectedCount === 1) {
        return {
          valid: true,
          instructionState: "success",
          instructionText: "点击确认进行堆叠"
        };
      }
      return {
        valid: false,
        error: text,
        instructionState: "warning",
        instructionText: text
      };
    }

    // PLAY_FREE 模式：先检查卡片条件（Tag），不检查费用
    if (gameState.actionMode === 'PLAY_FREE' && primaryCard && currentAction) {
      const tagValidation = validatePlayFreeTag(primaryCard, currentAction);

      // 检查指定名称 (如: 必须打出小野猪)
      let nameValid = true;
      if (currentAction.targetName) {
        nameValid = (primaryCard.name === currentAction.targetName);
      }

      const text = gameState.actionText;

      // 如果不符合 Tag 或 名称要求，明确告知
      const isValid = tagValidation.valid && nameValid;
      const errorMsg = isValid ? null : `不符合要求：${text}`;

      return {
        valid: isValid,
        error: errorMsg, // Toast 显示明确的错误信息
        instructionState: isValid ? "success" : "error",
        instructionText: text
      };
    }

    // ACTION_MOLE 和 ACTION_PLAY_SAPLINGS 模式：需要正常验证费用（不是免费打牌）
    if (gameState.actionMode === 'ACTION_MOLE' || gameState.actionMode === 'ACTION_PLAY_SAPLINGS') {
      // 跳过特殊模式处理，继续执行正常的费用验证逻辑
      // 不在这里 return，让代码继续往下走到费用计算部分
    } else if (
      gameState.actionMode === 'ACTION_PICK_FROM_CLEARING' ||
      gameState.actionMode === 'PICK_FROM_CLEARING_TO_HAND' ||
      gameState.actionMode === 'ACTION_PICK_FROM_CLEARING_TO_CAVE'
    ) {
      // 从空地拿牌模式
      const text = gameState.actionText || '请从空地选择一张牌';
      const isSelected = params.selectedClearingIdx !== undefined && params.selectedClearingIdx >= 0;

      return {
        valid: isSelected,
        error: isSelected ? null : '请先选择一张空地牌',
        instructionState: isSelected ? "success" : "warning",
        instructionText: text
      };
    } else {
      // 其他特殊模式
      const text = gameState.actionText;
      return {
        valid: true, // 其他特殊模式默认允许
        instructionState: "warning",
        instructionText: text
      };
    }
  }

  // 2. 摸牌/拿牌提示
  const drawnCount = turnAction?.drawnCount || 0;
  const takenCount = turnAction?.takenCount || 0;
  const curTotal = drawnCount + takenCount;

  if (curTotal === 1) {
    return {
      valid: false,
      error: "请再摸一张牌",
      instructionState: "action",
      instructionText: "请再摸一张牌"
    };
  }

  // 3. 未选中主牌
  if (!primarySelection || !primaryCard) {
    return {
      valid: false,
      error: "请先选择要打出的牌",
      instructionState: "action",
      instructionText: "请打牌/摸牌"
    };
  }

  // 4. 计算费用
  const payment = selectedCount - 1;
  const type = primaryCard.type;
  let costs = [];

  // 检查附属卡是否需要选择插槽
  // 使用 loose equality 或 toLowerCase 确保类型匹配
  const typeLower = (type || '').toLowerCase();

  if (typeLower === 'hcard' || typeLower === 'h_card') {
    if (!selectedSlot) {
      return {
        valid: false,
        error: "请选择左/右插槽",
        instructionState: "warning",
        instructionText: "请选择左/右插槽"
      };
    }
    if (selectedSlot.side !== 'left' && selectedSlot.side !== 'right') {
      console.warn("Validation failed for H_CARD: side is", selectedSlot.side);
      return {
        valid: false,
        error: "左右结构的卡只可插在左右插槽",
        instructionState: "error",
        instructionText: "左右结构的卡只可插在左右插槽"
      };
    }
  }

  if (typeLower === 'vcard' || typeLower === 'v_card') {
    if (!selectedSlot) {
      return {
        valid: false,
        error: "请选择上/下插槽",
        instructionState: "warning",
        instructionText: "请选择上/下插槽"
      };
    }
    if (selectedSlot.side !== 'top' && selectedSlot.side !== 'bottom') {
      console.warn("Validation failed for V_CARD: side is", selectedSlot.side);
      return {
        valid: false,
        error: "上下结构的卡只可插在上下插槽",
        instructionState: "error",
        instructionText: "上下结构的卡只可插在上下插槽"
      };
    }
  }

  // 计算费用
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

  // 5. 校验费用
  const isCostSatisfied = costs.some(cost => payment === cost);

  // 6. 生成提示信息
  const lines = {};

  // 费用行：满足时加 ✅
  const costText = isCostSatisfied ? `✅ 【费用】: ${costs[0]}` : `【费用】: ${costs[0]}`;
  lines.cost = {
    text: costText,
    class: isCostSatisfied ? "text-success" : "text-error"
  };

  const paymentCards = myHand.filter((c) => c.selected && c.uid !== primarySelection);
  const hasBonus = !!primaryCard.bonusConfig;
  const hasEffect = !!primaryCard.effectConfig;

  // 检查是否是鼹鼠或水田鼠模式
  const isMoleMode = gameState && gameState.actionMode === 'ACTION_MOLE';
  const isSaplingMode = gameState && gameState.actionMode === 'ACTION_PLAY_SAPLINGS';

  // 奖励行：加【奖励】标签（鼹鼠和水田鼠模式下不显示）
  if (hasBonus && !isMoleMode && !isSaplingMode) {
    const isBonusMatched = isColorMatched(primaryCard, paymentCards);
    const bonusText = primaryCard.bonus || "奖励";
    // 调试日志: 输出 isCostSatisfied 和 isBonusMatched 的状态
    console.log(`🛠️ Bonus Check: cost=${isCostSatisfied}, colorMatch=${isBonusMatched}, text=${bonusText}`);

    // 只有在费用满足且颜色匹配时才激活奖励
    const isBonusActive = isCostSatisfied && isBonusMatched;
    lines.bonus = {
      text: `【奖励】${bonusText}`,
      class: isBonusActive ? "text-success" : "text-error"
    };
  } else {
    lines.bonus = { text: "", class: "" };
  }

  // 效果行：加【效果】标签（鼹鼠和水田鼠模式下不显示）
  if (hasEffect && !isMoleMode && !isSaplingMode) {
    const effectText = primaryCard.effect || "效果";
    const isEffectActive = isCostSatisfied;
    lines.effect = {
      text: `【效果】${effectText}`,
      class: isEffectActive ? "text-success" : "text-error"
    };
  } else {
    lines.effect = { text: "", class: "" };
  }

  // 生成 segments
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

  // 如果是鼹鼠或水田鼠模式，添加特殊提示前缀
  let finalText = text;
  if (isMoleMode) {
    const molePrefix = gameState.actionText || "支付费用打出牌";
    finalText = isCostSatisfied ? `${molePrefix} | ${text}` : text;
  } else if (isSaplingMode) {
    const saplingPrefix = gameState.actionText || "打出树苗";
    finalText = isCostSatisfied ? `${saplingPrefix} | ${text}` : text;
  }

  const result = {
    valid: isCostSatisfied,
    error: isCostSatisfied ? null : `需支付 ${costs.join(" 或 ")} 张牌`,
    instructionState: isCostSatisfied ? "success" : "error",
    instructionText: finalText,
    instructionSegments: segments,
    instructionLines: lines
  }
  // 7. 返回完整结果
  return result;
};

module.exports = {
  validatePlay,
  validatePlayFreeTag
};
