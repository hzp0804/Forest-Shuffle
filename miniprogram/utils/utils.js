const { getCardInfoById, getCardVisual, getSaplingVisual } = require("./getCardInfoById");
const { getCardCost } = require("./cost");
const { calculateTotalScore } = require("./score");
const { CARD_TYPES } = require("../data/constants");
const RewardUtils = require("./reward");

const enrichCard = (card) => {
  if (!card) return null;
  const id = card.id || card.cardId;
  const info = getCardInfoById(id);
  return { ...info, ...card, id };
};

const enrichHand = (hand, myOpenId, currentOpenId, selectedUids = new Set()) => {
  if (!Array.isArray(hand)) return [];
  return hand.map((card) => ({
    ...enrichCard(card),
    selected: currentOpenId === myOpenId && selectedUids.has(card.uid),
  }));
};

const enrichForest = (forest) => {
  if (!Array.isArray(forest)) return [];
  return forest.map((node) => {
    if (node.id && !node.center) {
      return {
        _id: node.uid || Math.random().toString(36),
        center: enrichCard(node),
        slots: { top: null, bottom: null, left: null, right: null },
      };
    }
    return {
      _id: node._id,
      center: enrichCard(node.center),
      slots: {
        top: enrichCard(node.slots?.top),
        bottom: enrichCard(node.slots?.bottom),
        left: enrichCard(node.slots?.left),
        right: enrichCard(node.slots?.right),
      },
    };
  });
};

const toggleHandSelection = (hand, uid, currentPrimary) => {
  let nextPrimary = currentPrimary;
  const newHand = hand.map((card) => {
    if (card.uid === uid) {
      const newSelected = !card.selected;
      if (newSelected && !nextPrimary) nextPrimary = uid;
      else if (!newSelected && nextPrimary === uid) nextPrimary = "";
      return { ...card, selected: newSelected };
    }
    return card;
  });

  if (!nextPrimary) {
    const fallback = newHand.find((c) => c.selected);
    if (fallback) nextPrimary = fallback.uid;
  }

  return { newHand, newPrimary: nextPrimary };
};

const computeInstruction = (data) => {
  const { openId, primarySelection, playerStates, selectedSlot } = data;

  if (!playerStates?.[openId]) {
    return { instructionState: "normal", instructionText: "加载中..." };
  }

  const myHand = playerStates[openId].hand || [];
  const selectedCount = myHand.filter((c) => c.selected).length;

  if (!primarySelection) {
    return {
      instructionState: selectedCount === 0 ? "normal" : "warning",
      instructionText: selectedCount === 0 ? "摸牌 / 出牌" : "请确认主牌选择",
    };
  }

  const primaryCard = myHand.find((c) => c.uid === primarySelection);
  if (!primaryCard) {
    return { instructionState: "error", instructionText: "主牌数据异常" };
  }

  const payment = selectedCount - 1;
  const type = primaryCard.type;
  let costs = [];

  if (type === CARD_TYPES.TREE) {
    costs = [getCardCost(primaryCard, "center")];
    if (primaryCard.species?.length > 1) {
      costs.push(getCardCost(primaryCard, "center_2"));
    }
  } else if (type === CARD_TYPES.H_CARD) {
    if (selectedSlot?.side === "left") {
      costs = [getCardCost(primaryCard, "left")];
    } else if (selectedSlot?.side === "right") {
      costs = [getCardCost(primaryCard, "right")];
    } else {
      costs = [getCardCost(primaryCard, "left"), getCardCost(primaryCard, "right")];
    }
  } else if (type === CARD_TYPES.V_CARD) {
    if (selectedSlot?.side === "top") {
      costs = [getCardCost(primaryCard, "top")];
    } else if (selectedSlot?.side === "bottom") {
      costs = [getCardCost(primaryCard, "bottom")];
    } else {
      costs = [getCardCost(primaryCard, "top"), getCardCost(primaryCard, "bottom")];
    }
  }

  costs = [...new Set(costs)];

  if ((type === CARD_TYPES.H_CARD || type === CARD_TYPES.V_CARD) && !selectedSlot) {
    return { instructionState: "warning", instructionText: "请选择森林空位" };
  }

  if (selectedSlot) {
    if (type === CARD_TYPES.H_CARD && !["left", "right"].includes(selectedSlot.side)) {
      return { instructionState: "error", instructionText: "卡牌需放置在左右槽位" };
    }
    if (type === CARD_TYPES.V_CARD && !["top", "bottom"].includes(selectedSlot.side)) {
      return { instructionState: "error", instructionText: "卡牌需放置在上下槽位" };
    }

    const myForest = playerStates[openId].forest || [];
    const targetTree = myForest.find((t) => (t._id || t.uid) === selectedSlot.treeId);
    if (targetTree) {
      const slotContent = targetTree.slots?.[selectedSlot.side] || targetTree[selectedSlot.side];
      if (slotContent) {
        return { instructionState: "error", instructionText: "该位置已有卡牌" };
      }
    }
  }

  const isSatisfied = costs.some((cost) => payment === cost);

  if (isSatisfied) {
    let text = `费用已满足 (支付: ${payment})`;
    try {
      const paymentCards = myHand.filter((c) => c.selected && c.uid !== primarySelection);
      const reward = RewardUtils.calculateColorReward(primaryCard, selectedSlot, paymentCards);
      if (reward.bonusText) {
        text = `费用已满足 [奖励: ${reward.bonusText}]`;
      } else if (reward.drawCount > 0) {
        text = `费用已满足 [奖励: 摸${reward.drawCount}张]`;
      }
    } catch (e) { }
    return { instructionState: "success", instructionText: text };
  }

  return {
    instructionState: "error",
    instructionText: `需支付: ${costs.join(" 或 ")} (已付: ${payment})`,
  };
};

const handleHandTap = (uid, currentData) => {
  const { openId, playerStates, primarySelection } = currentData;

  if (!playerStates?.[openId]) return null;

  const myHand = playerStates[openId].hand || [];
  const { newHand, newPrimary } = toggleHandSelection(myHand, uid, primarySelection);

  const nextData = {
    ...currentData,
    primarySelection: newPrimary,
    playerStates: {
      ...playerStates,
      [openId]: { ...playerStates[openId], hand: newHand },
    },
  };

  const { instructionState, instructionText } = computeInstruction(nextData);

  return {
    [`playerStates.${openId}.hand`]: newHand,
    primarySelection: newPrimary,
    instructionState,
    instructionText,
  };
};

const processGameData = (res, currentData) => {
  const myOpenId = currentData.openId;
  const viewingId = currentData.selectedPlayerOpenId || myOpenId;

  const currentHand = currentData.playerStates?.[myOpenId]?.hand || [];
  const selectedUids = new Set(currentHand.filter((c) => c.selected).map((c) => c.uid));

  const gameState = res.data.gameState || {};
  const playerStates = gameState.playerStates;

  if (playerStates) {
    Object.keys(playerStates).forEach((openId) => {
      const playerState = playerStates[openId];
      if (playerState?.hand) {
        playerState.hand = enrichHand(
          playerState.hand,
          myOpenId,
          playerState._openid || openId,
          selectedUids
        );
      }
    });
  }

  const viewingPlayerState = playerStates?.[viewingId];
  const displayForest = viewingPlayerState?.forest ? enrichForest(viewingPlayerState.forest) : [];
  const viewingPlayer = (res.data.players || []).find((p) => p.openId === viewingId);

  const users = res.data.players || [];
  const enrichedPlayers = users
    .map((p) => {
      if (!p) return null;
      const pState = playerStates?.[p.openId];
      const scoreData = calculateTotalScore(pState, p.openId);
      return {
        ...p,
        score: scoreData.total || 0,
        handCount: pState?.hand?.length || 0,
      };
    })
    .filter(Boolean);

  const nextData = { ...currentData, playerStates, primarySelection: currentData.primarySelection };
  const { instructionState, instructionText } = computeInstruction(nextData);

  const activePlayerId = gameState.activePlayer || res.data.activePlayer;
  const isMyTurn = activePlayerId ? activePlayerId === myOpenId : true;

  const logs = gameState.logs || [];
  const displayLogs = logs
    .map((log) => {
      const user = users.find((u) => u.openId === log.operator);
      const nick = user?.nickName || "未知玩家";
      const date = new Date(log.timestamp);
      const timeStr = `${date.getHours().toString().padStart(2, "0")}:${date
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
      return { ...log, nick, time: timeStr, text: `${nick}: ${log.action}` };
    })
    .reverse();

  return {
    players: enrichedPlayers,
    deck: gameState.deck,
    deckVisual: getSaplingVisual(),
    clearing: (gameState.clearing || []).map(enrichCard),
    playerStates,
    myForest: displayForest,
    viewingPlayerNick: viewingPlayer?.nickName || "玩家",
    isViewingSelf: viewingId === myOpenId,
    isMyTurn,
    instructionState,
    instructionText,
    logs,
    displayLogs,
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
