const {
  getCardInfoById,
  getSaplingVisual
} = require("./getCardInfoById");
const {
  getCardCost
} = require("./cost");
const {
  calculateTotalScore
} = require("./score/index");
const {
  CARD_TYPES
} = require("../data/constants");
const {
  SAPLING_DATA
} = require("../data/speciesData");
const { calculateReward } = require("./reward.js");

const { getCardColors, isColorMatched } = require('./colorMatcher');
const { checkInstruction } = require('./instructionHelper');

const LOCAL_AVATARS = [
  "oN71F16b4hwLLo7_EMo_SMh6hSfE",
  "oN71F18ODPCKs9SzUJKilLyCKwYo",
  "oN71F1yhDUhpwDC2daqzdbx5VHFk"
];

const getAvatarPath = (openId, originalUrl) => {
  if (openId && LOCAL_AVATARS.includes(openId)) {
    return `/images/avatar/${openId}.jpg`;
  }
  return originalUrl || "";
};

const enrichCard = (card) => {
  if (!card) return null;
  const id = card.id || card.cardId;
  const info = getCardInfoById(id);

  if (id === 'sapling') {
    const saplingVisual = getSaplingVisual ? getSaplingVisual() : {};
    const saplingStatic = SAPLING_DATA;
    return {
      ...card,
      id,
      ...saplingStatic,
      ...saplingVisual,
      tags: card.tags || saplingStatic.tags,
    };
  }

  const {
    speciesDetails: _,
    ...cardWithoutSpeciesDetails
  } = card;
  return {
    ...info,
    ...cardWithoutSpeciesDetails,
    id,
    stackedCards: card.stackedCards ? card.stackedCards.map(c => enrichCard(c)) : undefined
  };
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

  const speciesData = enriched.speciesDetails[index];
  let specificTreeSymbol = enriched.tree_symbol;
  if (Array.isArray(enriched.tree_symbol) && enriched.tree_symbol.length > index) {
    specificTreeSymbol = [enriched.tree_symbol[index]];
  } else if (!Array.isArray(enriched.tree_symbol)) {
    specificTreeSymbol = [enriched.tree_symbol];
  }

  if (speciesData) {
    return {
      ...enriched,
      ...speciesData,
      tree_symbol: specificTreeSymbol,
      id: enriched.id,
      uid: enriched.uid
    };
  }
  return {
    ...enriched,
    tree_symbol: specificTreeSymbol
  };
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
        slots: {
          top: null,
          bottom: null,
          left: null,
          right: null
        },
      };
    }
    return {
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
      return {
        ...card,
        selected: newSelected
      };
    }
    return card;
  });

  if (!nextPrimary) {
    const fallback = newHand.find((c) => c.selected);
    if (fallback) nextPrimary = fallback.uid;
  }

  return {
    newHand,
    newPrimary: nextPrimary
  };
};

const computeInstruction = (data) => {
  const {
    openId,
    primarySelection,
    playerStates,
    selectedSlot,
    turnAction,
    gameState
  } = data;

  if (!playerStates?.[openId]) return {
    instructionState: "normal",
    instructionText: "旁观模式"
  };

  const myHand = playerStates[openId].hand || [];
  const selectedCount = myHand.filter((c) => c.selected).length;

  let primaryCard = null;
  if (primarySelection) {
    const primaryCardRaw = myHand.find((c) => c.uid === primarySelection);
    if (primaryCardRaw) {
      let activeSide = 'center';
      if (primaryCardRaw.type === CARD_TYPES.H_CARD || primaryCardRaw.type === CARD_TYPES.V_CARD) {
        activeSide = selectedSlot?.side;
      }
      primaryCard = enrichCardWithSpecies(primaryCardRaw, activeSide);
    }
  }

  return checkInstruction({
    openId,
    playerStates,
    gameState,
    turnAction,
    primarySelection,
    selectedSlot,
    primaryCard,
    myHand,
    selectedCount
  });
};

const handleHandTap = (uid, currentData) => {
  const {
    openId,
    playerStates,
    primarySelection
  } = currentData;
  if (!playerStates?.[openId]) return null;

  const myHand = playerStates[openId].hand || [];
  const {
    newHand,
    newPrimary
  } = toggleHandSelection(myHand, uid, primarySelection);

  // 检测主牌是否变动
  const primaryChanged = newPrimary !== primarySelection;

  const nextData = {
    ...currentData,
    primarySelection: newPrimary,
    selectedSlot: primaryChanged ? null : currentData.selectedSlot, // 主牌变动时清除插槽
    playerStates: {
      ...playerStates,
      [openId]: {
        ...playerStates[openId],
        hand: newHand
      },
    },
  };

  const {
    instructionState,
    instructionText,
    instructionSegments, // 确保从 checkInstruction 接收这些额外字段
    instructionLines
  } = computeInstruction(nextData);

  return {
    [`playerStates.${openId}.hand`]: newHand,
    primarySelection: newPrimary,
    selectedSlot: primaryChanged ? null : undefined, // 主牌变动时清除插槽
    instructionState,
    instructionText,
    instructionSegments: instructionSegments || null,
    instructionLines: instructionLines || null
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
        playerState.hand = enrichHand(playerState.hand, myOpenId, playerState._openid || openId, selectedUids);
      }
      if (playerState?.forest) {
        playerState.forest = enrichForest(playerState.forest);
      }
    });
  }

  const viewingPlayerState = playerStates?.[viewingId];
  const displayForest = viewingPlayerState?.forest || [];
  const viewingPlayer = (res.data.players || []).find((p) => p && p.openId === viewingId);

  const countForestCards = (forest) => {
    if (!Array.isArray(forest)) return 0;
    let count = 0;
    forest.forEach(group => {
      if (group.center) count++;
      if (group.slots) {
        ['top', 'bottom', 'left', 'right'].forEach(side => {
          if (group.slots[side]) {
            count++;
            if (group.slots[side].stackedCards) count += group.slots[side].stackedCards.length;
          }
        });
      }
    });
    return count;
  };

  let totalCardCount = 0;
  Object.values(playerStates || {}).forEach(pState => {
    if (pState && pState.forest) totalCardCount += countForestCards(pState.forest);
  });

  const cardsChanged = totalCardCount !== (currentData.lastCardCount || 0);
  const users = res.data.players || [];
  const enrichedPlayers = users.map((p) => {
    if (!p) return null;
    const pState = playerStates?.[p.openId];
    let score = 0;
    if (cardsChanged) {
      const scoreData = calculateTotalScore(pState, p.openId, playerStates, p.nickName);
      score = scoreData.total || 0;
    } else {
      const cached = require('./score/index').getCachedScore(p.openId);
      score = cached?.total || 0;
    }
    return {
      ...p,
      avatarUrl: getAvatarPath(p.openId, p.avatarUrl),
      score: score,
      handCount: pState?.hand?.length || 0,
    };
  }).filter(Boolean);

  const nextData = {
    ...currentData,
    playerStates,
    gameState,
    primarySelection: currentData.primarySelection
  };
  const activePlayerId = gameState.activePlayer || res.data.activePlayer;
  const isMyTurn = activePlayerId ? activePlayerId === myOpenId : true;

  // 优化：如果是我正在操作（已选主牌），轮询不应该重算指引（避免覆盖本地交互结果，也避免昂贵的费用计算）
  // 除非轮次发生了变化（不再是我的回合），才强制刷新
  let instructionState = currentData.instructionState;
  let instructionText = currentData.instructionText;
  let instructionSegments = currentData.instructionSegments;
  let instructionLines = currentData.instructionLines;

  // 只有在“非操作中”状态，或者是“被动状态变化”（如回合切换）时，才由轮询更新指引
  // 如果 primarySelection 有值且依然是我的回合，保持原样
  const shouldSkipCompute = isMyTurn && currentData.primarySelection;

  if (!shouldSkipCompute) {
    const computed = computeInstruction(nextData);
    instructionState = computed.instructionState;
    instructionText = computed.instructionText;
    instructionSegments = computed.instructionSegments;
    instructionLines = computed.instructionLines;
  }

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
    instructionSegments: instructionSegments || null,
    instructionLines: instructionLines || null,
    turnAction: gameState.turnAction || {
      drawnCount: 0
    },
    currentTurn: gameState.turnCount || 1,
    lastCardCount: totalCardCount,
    gameState: gameState,
    isSpectator: !playerStates?.[myOpenId],
  };
};

module.exports = {
  getCardInfoById,
  enrichCard,
  enrichHand,
  enrichForest,
  enrichCardWithSpecies,
  toggleHandSelection,
  computeInstruction,
  handleHandTap,
  processGameData,
  getCardColors,
  isColorMatched,
  getAvatarPath
};
