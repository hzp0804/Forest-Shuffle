const { getCardInfoById, getCardVisual, getSaplingVisual } = require("./getCardInfoById");
const { getCardCost } = require("./cost");
const { calculateTotalScore } = require("./score");
const { CARD_TYPES } = require("../data/constants");
const RewardUtils = require("./reward");
const { SAPLING_DATA } = require("../data/speciesData");

const enrichCard = (card) => {
  if (!card) return null;
  const id = card.id || card.cardId;
  const info = getCardInfoById(id);

  // 特殊处理树苗：树苗是动态生成的，必须保留原有的视觉属性
  // 优化：视觉属性不再存储在数据库，而是每次读取时动态生成
  if (id === 'sapling') {
    const saplingVisual = getSaplingVisual ? getSaplingVisual() : {};
    // 使用独立的 SAPLING_DATA
    const saplingStatic = SAPLING_DATA;

    return {
      ...card,
      id,
      ...saplingStatic,
      ...saplingVisual,
      tags: card.tags || saplingStatic.tags,
    };
  }

  // 关键修复：从 card 中排除 speciesDetails，使用 info 中完整的 speciesDetails
  // 因为数据库中的 speciesDetails 不包含 scoreConfig 等字段
  const { speciesDetails: _, ...cardWithoutSpeciesDetails } = card;

  return { ...info, ...cardWithoutSpeciesDetails, id };
};

const enrichCardWithSpecies = (card, side) => {
  if (!card) return null;
  const enriched = enrichCard(card);
  if (!enriched.speciesDetails || enriched.speciesDetails.length === 0) return enriched;

  let index = 0;
  if (enriched.type === CARD_TYPES.H_CARD) {
    if (side === 'right') index = 1;
  } else if (enriched.type === CARD_TYPES.V_CARD) {
    if (side === 'bottom') index = 1;
  }
  // For Tree, it's usually 0. If there are multiple species for tree, 
  // currently we default to 0 for 'center'.

  const speciesData = enriched.speciesDetails[index];

  // Update tree_symbol to be specific for this side
  let specificTreeSymbol = enriched.tree_symbol;
  if (Array.isArray(enriched.tree_symbol) && enriched.tree_symbol.length > index) {
    specificTreeSymbol = [enriched.tree_symbol[index]];
  } else if (!Array.isArray(enriched.tree_symbol)) {
    // Fallback or if it's already a single value (shouldn't happen with current data structure but for safety)
    specificTreeSymbol = [enriched.tree_symbol];
  }



  // Merge species data if available
  // We prioritize card's own id/uid but overwrite name/tags/cost etc from species
  if (speciesData) {
    return { ...enriched, ...speciesData, tree_symbol: specificTreeSymbol, id: enriched.id, uid: enriched.uid };
  }
  // Even if no species data (shouldn't happen for valid cards), we return enriched with specific tree symbol
  return { ...enriched, tree_symbol: specificTreeSymbol };
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
      _id: node._id,
      center: enrichCardWithSpecies(node.center, 'center'),
      slots: {
        top: enrichCardWithSpecies(node.slots?.top, 'top'),
        bottom: enrichCardWithSpecies(node.slots?.bottom, 'bottom'),
        left: enrichCardWithSpecies(node.slots?.left, 'left'),
        right: enrichCardWithSpecies(node.slots?.right, 'right'),
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
  const { openId, primarySelection, playerStates, selectedSlot, turnAction } = data;

  if (!playerStates?.[openId]) {
    return { instructionState: "normal", instructionText: "加载中..." };
  }

  // 1. 优先检查回合状态 (是否处于摸牌阶段)
  const drawnCount = turnAction?.drawnCount || 0;
  if (drawnCount === 1) {
    return {
      instructionState: "warning", // 使用 warning 样式引起注意
      instructionText: "请再摸一张牌",
    };
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
      // NEW: Enrich forest for everyone so score calculation works
      if (playerState?.forest) {
        playerState.forest = enrichForest(playerState.forest);
      }
    });
  }

  const viewingPlayerState = playerStates?.[viewingId];
  const displayForest = viewingPlayerState?.forest || [];
  const viewingPlayer = (res.data.players || []).find((p) => p && p.openId === viewingId);

  // 优化：统计所有玩家森林的卡片总数，只在变化时才重新计算分数
  const countForestCards = (forest) => {
    if (!Array.isArray(forest)) return 0;
    let count = 0;
    forest.forEach(group => {
      if (group.center) count++;
      if (group.slots) {
        ['top', 'bottom', 'left', 'right'].forEach(side => {
          if (group.slots[side]) {
            count++;
            // 包括堆叠卡
            if (group.slots[side].stackedCards) {
              count += group.slots[side].stackedCards.length;
            }
          }
        });
      }
    });
    return count;
  };

  // 计算所有玩家的卡片总数（用于检测变化）
  let totalCardCount = 0;
  Object.values(playerStates || {}).forEach(pState => {
    if (pState && pState.forest) {
      totalCardCount += countForestCards(pState.forest);
    }
  });

  // 检查卡片数量是否变化
  const lastCardCount = currentData.lastCardCount || 0;
  const cardsChanged = totalCardCount !== lastCardCount;

  const users = res.data.players || [];
  const enrichedPlayers = users
    .map((p) => {
      if (!p) return null;
      const pState = playerStates?.[p.openId];

      // 只在卡片数量变化时才重新计算分数
      let score = 0;
      if (cardsChanged) {
        const scoreData = calculateTotalScore(pState, p.openId, playerStates, p.nickName);
        score = scoreData.total || 0;
      } else {
        // 卡片数量未变，使用缓存的分数
        const cached = require('./score').getCachedScore(p.openId);
        score = cached?.total || 0;
      }

      return {
        ...p,
        score: score,
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
      const user = users.find((u) => u && u.openId === log.operator);
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
    turnAction: gameState.turnAction || { drawnCount: 0 },
    currentTurn: gameState.turnCount || 1, // 当前回合数
    lastCardCount: totalCardCount, // 保存卡片总数，用于下次比较
  };
};

export default {
  getCardInfoById,
  enrichCard,
  enrichHand,
  enrichForest,
  toggleHandSelection,
  computeInstruction,
  handleHandTap,
  processGameData,
};
