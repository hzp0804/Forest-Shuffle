const { getCardInfoById, getCardVisual, getSaplingVisual } = require("./getCardInfoById");
const { getCardCost } = require("./cost");
const { calculateScore } = require("./score");
const RewardUtils = require("./reward");

/**
 * 丰富卡片信息 helper 函数
 * 将卡片的基础信息（从 cardData 获取）与实例信息（如 uid, dynamic 状态）合并
 * @param {Object} card - 卡片对象 (包含 id, uid 等)
 * @returns {Object|null} - 包含完整信息的卡片对象，若输入为空则返回 null
 */
const enrichCard = (card) => {
  if (!card) return null;
  // 兼容 card.id 或 card.cardId
  const id = card.id || card.cardId;
  const info = getCardInfoById(id);
  // 合并信息，保留原 card 中的动态数据（如 uid）并覆盖/补充静态数据
  return { ...info, ...card, id };
};

/**
 * 处理手牌数组
 * 为手牌中的每一张卡片补充详细信息，并根据当前选中的状态恢复 UI 选中效果
 * @param {Array} hand - 手牌数组 (包含 {id, uid} 等简略信息的对象)
 * @param {string} myOpenId - 当前登录用户的 openId
 * @param {string} currentOpenId - 正在处理的手牌所属用户的 openId
 * @param {Set} selectedUids - 当前本地已选中的卡片 UID 集合 (用于保持选中状态不被刷新覆盖)
 * @returns {Array} - 处理后的手牌数组
 */
const enrichHand = (
  hand,
  myOpenId,
  currentOpenId,
  selectedUids = new Set()
) => {
  if (!hand || !Array.isArray(hand)) return [];
  return hand.map((card) => {
    const enriched = enrichCard(card);
    // 保持当前玩家的选中状态：只有当前用户自己的手牌，且在 selectedUids 中才标记为 selected
    const isSelected = currentOpenId === myOpenId && selectedUids.has(card.uid);
    return {
      ...enriched,
      selected: isSelected,
    };
  });
};

/**
 * 处理森林区域数组
 * 兼容旧数据格式（直接是 Card 对象）和新数据格式（TreeGroup 对象）
 * 为森林中的 树木中心(center) 和 插槽(slots) 中的卡片补充详细信息
 * @param {Array} forest - 森林数据数组
 * @returns {Array} - 处理后的森林结构数组
 */
const enrichForest = (forest) => {
  if (!forest || !Array.isArray(forest)) return [];
  return forest.map((treeNode) => {
    // 兼容处理：如果 treeNode 直接是卡片对象（旧数据），则作为 center
    if (treeNode.id && !treeNode.center) {
      return {
        _id: treeNode.uid || Math.random().toString(36),
        center: enrichCard(treeNode),
        slots: { top: null, bottom: null, left: null, right: null },
      };
    }

    return {
      _id: treeNode._id,
      center: enrichCard(treeNode.center),
      slots: {
        top: enrichCard(treeNode.slots?.top),
        bottom: enrichCard(treeNode.slots?.bottom),
        left: enrichCard(treeNode.slots?.left),
        right: enrichCard(treeNode.slots?.right),
      },
    };
  });
};

/**
 * 切换手牌选中状态 (核心交互)
 * 区分“主牌”(Primary) 和 “副牌”(Secondary, 即其他选中牌)
 * 逻辑：
 * 1. 第一次选中的牌自动成为主牌。
 * 2. 如果主牌被取消选中，自动将下一张已选中的牌提升为主牌。
 * 3. 支持多选，但始终保持有且仅有一张主牌（除非未选中任何牌）。
 *
 * @param {Array} hand - 当前手牌数组
 * @param {string} uid - 被点击卡片的 UID
 * @param {string} currentPrimary - 当前的主牌 UID
 * @returns {Object} { newHand, newPrimary } - 更新后的手牌数组和新的主牌 UID
 */
const toggleHandSelection = (hand, uid, currentPrimary) => {
  let nextPrimary = currentPrimary;
  const newHand = hand.map((card) => {
    if (card.uid === uid) {
      const newSelected = !card.selected;

      // 更新主牌逻辑：
      // 1. 如果新选中且当前无主牌 -> 设为主牌
      // 2. 如果取消选中且它是主牌 -> 清空主牌 (稍后兜底逻辑会重选)
      if (newSelected && !nextPrimary) {
        nextPrimary = uid;
      } else if (!newSelected && nextPrimary === uid) {
        nextPrimary = "";
      }

      return { ...card, selected: newSelected };
    }
    return card;
  });

  // 兜底逻辑：如果原本的主牌被取消了，尝试将其他第一张选中的牌设为主牌
  if (!nextPrimary) {
    const fallback = newHand.find((c) => c.selected);
    if (fallback) nextPrimary = fallback.uid;
  }

  return { newHand, newPrimary: nextPrimary };
};

/**
 * 处理整个游戏数据（核心业务逻辑）
 * 1. 接收服务器返回的原始数据 (res) 和 本地当前数据 (currentData)
 * 2. 提取本地选中状态，防止刷新导致选中丢失
 * 3. 遍历所有玩家手牌进行 enrich (补充详情)
 * 4. 根据当前查看的玩家 ID，准备对应的森林显示数据
 * 5. 返回所有可以直接 setData 渲染的完整数据对象
 *
 * @param {Object} res - 云函数/数据库返回的原始数据结果
 * @param {Object} currentData - Page 的 this.data，用于获取当前状态 (selectedUids, viewingId 等)
 * @returns {Object} - 包含 players, deck, clearing, playerStates, myForest/**
 * 计算当前的游戏指引文案和状态
 * 根据当前的主牌选择、选中数量、剩余空位等信息提示玩家下一步操作
 * @param {Object} data - 当前游戏数据 (包含 openId, primarySelection, playerStates 等)
 * @returns {Object} { instructionState, instructionText }
 */
const computeInstruction = (data) => {
  const { openId, primarySelection, playerStates, selectedSlot } = data; // Added selectedSlot

  if (!playerStates || !playerStates[openId]) {
    return { instructionState: "normal", instructionText: "加载中..." };
  }

  const myHand = playerStates[openId].hand || [];
  const selectedCount = myHand.filter((c) => c.selected).length;

  // 1. 无主牌：提示选择
  if (!primarySelection) {
    return {
      instructionState: selectedCount === 0 ? "normal" : "warning",
      instructionText: selectedCount === 0 ? "摸牌 / 出牌" : "请确认主牌选择",
    };
  }

  // 2. 有主牌：计算花费和当前支付
  const primaryCard = myHand.find((c) => c.uid === primarySelection);
  if (!primaryCard) {
    return { instructionState: "error", instructionText: "主牌数据异常" };
  }

  // Debug Log
  console.log("[Debug] ComputeInstruction - PrimaryCard:", primaryCard);

  const payment = selectedCount - 1; // 扣除主牌本身
  let costs = [];
  const type = primaryCard.type;

  // 根据类型获取可能的费用
  if (type === "Tree") {
    costs = [getCardCost(primaryCard, "center")];
    // 如果是双树卡（如灌木/树木分割），添加第二种树的费用选项
    if (primaryCard.species && primaryCard.species.length > 1) {
      costs.push(getCardCost(primaryCard, "center_2"));
    }
  } else if (type === "hCard") {
    // 水平卡 (左右)
    if (selectedSlot && selectedSlot.side === "left") {
      costs = [getCardCost(primaryCard, "left")];
    } else if (selectedSlot && selectedSlot.side === "right") {
      costs = [getCardCost(primaryCard, "right")];
    } else {
      costs = [
        getCardCost(primaryCard, "left"),
        getCardCost(primaryCard, "right"),
      ];
    }
  } else if (type === "vCard") {
    // 垂直卡 (上下)
    if (selectedSlot && selectedSlot.side === "top") {
      costs = [getCardCost(primaryCard, "top")];
    } else if (selectedSlot && selectedSlot.side === "bottom") {
      costs = [getCardCost(primaryCard, "bottom")];
    } else {
      costs = [
        getCardCost(primaryCard, "top"),
        getCardCost(primaryCard, "bottom"),
      ];
    }
  }

  // 去重
  costs = [...new Set(costs)];

  // 3. 特殊逻辑：附属卡必须先选插槽才能确定费用
  // 如果是附属卡且未选择插槽，强制提示选择插槽，隐藏多义的费用
  if ((type === "hCard" || type === "vCard") && !selectedSlot) {
    return {
      instructionState: "warning",
      instructionText: "请选择森林空位",
    };
  }

  // 4. 如果已选插槽，进行合法性校验 (方向 & 占用)
  if (selectedSlot) {
    if (type === "hCard" && !["left", "right"].includes(selectedSlot.side)) {
      return {
        instructionState: "error",
        instructionText: "卡牌需放置在左右槽位",
      };
    }
    if (type === "vCard" && !["top", "bottom"].includes(selectedSlot.side)) {
      return {
        instructionState: "error",
        instructionText: "卡牌需放置在上下槽位",
      };
    }

    // 检查被占用
    // 需要获取森林数据来判断
    const myForest = playerStates[openId].forest || [];
    // 注意：这里的数据可能是 raw 或 enriched。统一按 enriched 处理 (有 _id)
    // 如果是 raw (BGA style), 结构可能是 { id, top, bottom... } ?
    // 假设是 enriched 结构或者 raw 结构都包含 uid/_id
    const targetTree = myForest.find(
      (t) => (t._id || t.uid) === selectedSlot.treeId
    );

    if (targetTree) {
      // 检查该位置是否有卡
      const slotContent = targetTree.slots
        ? targetTree.slots[selectedSlot.side]
        : targetTree[selectedSlot.side];
      // slotContent 可能是 null, ID string, 或 Card Object
      if (slotContent) {
        return { instructionState: "error", instructionText: "该位置已有卡牌" };
      }
    }
  }

  // 检查是否满足任意一种费用
  const isSatisfied = costs.some((cost) => payment === cost);

  if (isSatisfied) {
    let text = `费用已满足 (支付: ${payment})`;

    // Check Reward
    try {
      const paymentCards = myHand.filter(
        (c) => c.selected && c.uid !== primarySelection
      );
      const reward = RewardUtils.calculateColorReward(
        primaryCard,
        selectedSlot,
        paymentCards
      );

      if (reward.bonusText) {
        text = `费用已满足 [奖励: ${reward.bonusText}]`;
      } else if (reward.drawCount > 0) {
        text = `费用已满足 [奖励: 摸${reward.drawCount}张]`;
      }
    } catch (e) {
      console.error("Bonus check failed", e);
    }

    return {
      instructionState: "success",
      instructionText: text,
    };
  }

  const costStr = costs.join(" 或 ");
  return {
    instructionState: "error",
    instructionText: `需支付: ${costStr} (已付: ${payment})`,
  };
};

/**
 * 处理点击手牌事件的完整业务逻辑
 * 封装了从数据提取、权限校验、状态切换到生成 setData 更新对象的全过程
 * @param {string} uid - 被点击卡片的 UID
 * @param {Object} currentData - Page 的 this.data，用于获取当前状态
 * @returns {Object|null} - 用于 setData 的更新对象，如果操作无法执行(如非本人手牌)则返回 null
 */
const handleHandTap = (uid, currentData) => {
  const openId = currentData.openId;
  const playerStates = currentData.playerStates;

  // 安全校验：只能操作自己的手牌状态 (确保 playerStates 中有该用户数据)
  if (!playerStates || !playerStates[openId]) {
    console.warn("无法操作：找不到玩家状态或非本人轮次");
    return null;
  }

  const myHand = playerStates[openId].hand || [];
  const currentPrimary = currentData.primarySelection;

  // 调用核心计算逻辑
  const { newHand, newPrimary } = toggleHandSelection(
    myHand,
    uid,
    currentPrimary
  );

  // 模拟新的数据状态以计算指引
  const nextData = {
    ...currentData,
    primarySelection: newPrimary,
    playerStates: {
      ...playerStates,
      [openId]: {
        ...playerStates[openId],
        hand: newHand,
      },
    },
  };
  const { instructionState, instructionText } = computeInstruction(nextData);

  // 返回可以直接传给 setData 的对象
  // 使用动态属性名更新特定字段，避免全量更新 playerStates
  return {
    [`playerStates.${openId}.hand`]: newHand,
    primarySelection: newPrimary,
    instructionState, // 更新指引状态
    instructionText, // 更新指引文案
  };
};

// 处理整个游戏数据（包含玩家手牌和森林显示）
const processGameData = (res, currentData) => {
  const myOpenId = currentData.openId;
  const viewingId = currentData.selectedPlayerOpenId || myOpenId;

  // 提取当前选中状态：为了在数据更新时保持用户的选中操作
  const currentHand = currentData.playerStates?.[myOpenId]?.hand || [];
  const selectedUids = new Set(
    currentHand.filter((c) => c.selected).map((c) => c.uid)
  );

  const gameState = res.data.gameState || {};
  const playerStates = gameState.playerStates;

  if (playerStates) {
    Object.keys(playerStates).forEach((openId) => {
      const playerState = playerStates[openId];
      if (playerState.hand) {
        // 调用 enrichHand 补充手牌详情并恢复选中状态
        playerState.hand = enrichHand(
          playerState.hand,
          myOpenId,
          openId,
          selectedUids
        );
      }
    });
  }

  // 准备显示用的森林数据：根据 viewingId 获取对应玩家的森林
  const viewingPlayerState = playerStates ? playerStates[viewingId] : null;
  const displayForest =
    viewingPlayerState && viewingPlayerState.forest
      ? enrichForest(viewingPlayerState.forest)
      : [];

  // 查找被查看玩家的昵称
  const viewingPlayer = (res.data.players || []).find(
    (p) => p.openId === viewingId
  );

  // 丰富玩家列表信息 (添加手牌数和得分)
  const users = res.data.players || [];
  const enrichedPlayers = users
    .map((p) => {
      if (!p) return null; // 过滤无效玩家数据

      const pState = playerStates ? playerStates[p.openId] : null;

      // 计算得分
      const scoreData = calculateScore(pState);
      const score = scoreData.total || 0;

      // 计算手牌数
      const handCount = pState && pState.hand ? pState.hand.length : 0;

      return {
        ...p,
        score,
        handCount,
      };
    })
    .filter(Boolean); // 移除 map 产生的 null

  // 重新计算指引（基于最新数据）
  // 构造这里需要的临时数据对象
  const nextData = {
    ...currentData,
    playerStates,
    primarySelection: currentData.primarySelection, // 这里假设主牌选中未变(因为 selectedUids 恢复了状态)
    // 注意：如果 data.primarySelection 在 selectedUids 里不存在了，应该被清除，这里暂简化
  };
  const { instructionState, instructionText } = computeInstruction(nextData);

  // 计算是否轮到自己
  const activePlayerId = gameState.activePlayer || res.data.activePlayer;
  const isMyTurn = activePlayerId ? activePlayerId === myOpenId : true;

  // --- Log Processing ---
  const logs = gameState.logs || [];
  const displayLogs = logs
    .map((log) => {
      // Find operator nick
      const user = users.find((u) => u.openId === log.operator);
      const nick = user ? user.nickName : "未知玩家";
      // Format time HH:MM:SS
      const date = new Date(log.timestamp);
      const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;

      return {
        ...log,
        nick,
        time: timeStr,
        text: `${nick}: ${log.action}`
      };
    })
    .reverse(); // Newest first

  return {
    players: enrichedPlayers,
    deck: gameState.deck,
    deckVisual: getSaplingVisual(),
    clearing: (gameState.clearing || []).map(enrichCard), // 必须 enrich 才有 bgImg
    playerStates: playerStates,
    myForest: displayForest, // 前端绑定的森林数据
    viewingPlayerNick: viewingPlayer ? viewingPlayer.nickName : "玩家",
    isViewingSelf: viewingId === myOpenId,
    isMyTurn, // 控制按钮显示
    instructionState, // 更新指引状态
    instructionText, // 更新指引文案
    // Logs
    logs, // Raw logs for game.js logic
    displayLogs, // Processed logs for UI
  };
};

export default {
  getCardInfoById,
  enrichHand,
  enrichForest,
  toggleHandSelection,
  computeInstruction,
  handleHandTap,
  processGameData,
};
