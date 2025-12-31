const { getCardInfoById } = require("./getCardInfoById");
const { getCardCost } = require("./cost");
const { calculateTotalScore } = require("./score/index");
const { CARD_TYPES, IMG_URLS } = require("../data/constants");
const { SAPLING_DATA } = require("../data/speciesData");
const { calculateReward } = require("./reward.js");

const { getCardColors, isColorMatched } = require("./colorMatcher");
const { checkInstruction } = require("./instructionHelper");

const LOCAL_AVATARS = [
  "oN71F16b4hwLLo7_EMo_SMh6hSfE",
  "oN71F18ODPCKs9SzUJKilLyCKwYo",
  "oN71F1yhDUhpwDC2daqzdbx5VHFk",
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

  // 树苗的特殊处理已经在 getCardInfoById 中完成，这里直接使用
  if (id === "sapling") {
    return {
      ...card,
      ...info, // info 已经包含了所有树苗的信息（包括视觉）
      id,
    };
  }

  const { speciesDetails: _, ...cardWithoutSpeciesDetails } = card;

  const enriched = {
    ...info,
    ...cardWithoutSpeciesDetails,
    id,
  };

  // 只有当 list 存在时才递归富化
  if (card.list && Array.isArray(card.list)) {
    enriched.list = card.list.map((c) => enrichCard(c));
  }

  return enriched;
};

const enrichCardWithSpecies = (card, side) => {
  if (!card) return null;
  const enriched = enrichCard(card);
  if (!enriched.speciesDetails || enriched.speciesDetails.length === 0)
    return enriched;

  let index = 0;
  if (enriched.type === "hCard" || enriched.type === "h_card") {
    // Ensure loose type check
    if (side === "right") index = 1;
  } else if (enriched.type === "vCard" || enriched.type === "v_card") {
    if (side === "bottom") index = 1;
  }

  let speciesData = enriched.speciesDetails[index];

  // Robustness Fallback: If targeted species data is missing (e.g. data error),
  // try using the first species. This handles cases like "Double Hare" where
  // maybe only one species entry exists or the second one failed lookup.
  if (!speciesData && enriched.speciesDetails.length > 0) {
    speciesData = enriched.speciesDetails[0];
  }

  let specificTreeSymbol = enriched.tree_symbol;
  if (
    Array.isArray(enriched.tree_symbol) &&
    enriched.tree_symbol.length > index
  ) {
    specificTreeSymbol = [enriched.tree_symbol[index]];
  } else if (!Array.isArray(enriched.tree_symbol)) {
    specificTreeSymbol = [enriched.tree_symbol];
  }

  let finalCard;
  if (speciesData) {
    finalCard = {
      ...enriched,
      ...speciesData,
      tree_symbol: specificTreeSymbol,
      id: enriched.id,
      uid: enriched.uid,
    };
  } else {
    finalCard = {
      ...enriched,
      tree_symbol: specificTreeSymbol,
    };
  }

  // 递归处理堆叠卡片的 list 字段
  // 堆叠的卡片也需要根据所在槽位的 side 提取对应物种的信息
  if (card.list && Array.isArray(card.list)) {
    finalCard.list = card.list.map((c) => enrichCardWithSpecies(c, side));
  }

  return finalCard;
};

const enrichHand = (
  hand,
  myOpenId,
  currentOpenId,
  selectedUids = new Set()
) => {
  if (!Array.isArray(hand)) return [];
  return hand.map((card) => ({
    ...enrichCard(card),
    selected: currentOpenId === myOpenId && selectedUids.has(card.uid),
  }));
};

const enrichForest = (forest) => {
  if (!Array.isArray(forest)) return [];

  // 先富化数据
  const enrichedForest = forest.map((node) => {
    if (node.id && !node.center) {
      return {
        _id: node.uid || Math.random().toString(36),
        center: enrichCard(node),
        slots: {
          top: null,
          bottom: null,
          left: null,
          right: null,
        },
      };
    }
    return {
      _id: node._id,
      center: enrichCardWithSpecies(node.center, "center"),
      slots: {
        top: enrichCardWithSpecies(node.slots?.top, "top"),
        bottom: enrichCardWithSpecies(node.slots?.bottom, "bottom"),
        left: enrichCardWithSpecies(node.slots?.left, "left"),
        right: enrichCardWithSpecies(node.slots?.right, "right"),
      },
    };
  });

  // 按树木名称排序,相同的树木排在一起，灌木放在后面，树苗放到最后
  enrichedForest.sort((a, b) => {
    const nameA = a.center?.name || "";
    const nameB = b.center?.name || "";

    // 定义特殊类型的优先级 (0: 普通树木, 1: 灌木, 2: 树苗)
    const getPriority = (name) => {
      if (name === "树苗") return 2;
      if (name === "灌木") return 1;
      return 0;
    };

    const priorityA = getPriority(nameA);
    const priorityB = getPriority(nameB);

    // 优先按类型排序
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // 同类型按名称排序
    return nameA.localeCompare(nameB, "zh-CN");
  });

  return enrichedForest;
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
        selected: newSelected,
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
    newPrimary: nextPrimary,
  };
};

const computeInstruction = (data) => {
  const {
    openId,
    primarySelection,
    playerStates,
    selectedSlot,
    turnAction,
    gameState,
    selectedClearingIdx, // 选中的空地卡牌索引
  } = data;

  if (!playerStates?.[openId])
    return {
      instructionState: "normal",
      instructionText: "旁观模式",
    };

  const myHand = playerStates[openId].hand || [];
  const selectedCount = myHand.filter((c) => c.selected).length;

  let primaryCard = null;
  if (primarySelection) {
    const primaryCardRaw = myHand.find((c) => c.uid === primarySelection);
    if (primaryCardRaw) {
      let activeSide = "center";
      if (
        primaryCardRaw.type === CARD_TYPES.H_CARD ||
        primaryCardRaw.type === CARD_TYPES.V_CARD
      ) {
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
    selectedCount,
    selectedClearingIdx, // 传递选中的空地卡牌索引
  });
};

const handleHandTap = (uid, currentData) => {
  const { openId, playerStates, primarySelection } = currentData;
  if (!playerStates?.[openId]) return null;

  const myHand = playerStates[openId].hand || [];
  const { newHand, newPrimary } = toggleHandSelection(
    myHand,
    uid,
    primarySelection
  );

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
        hand: newHand,
      },
    },
  };

  const {
    instructionState,
    instructionText,
    instructionSegments, // 确保从 checkInstruction 接收这些额外字段
    instructionLines,
  } = computeInstruction(nextData);

  // 计算是否满足奖励条件
  let bonusActive = false;
  if (
    instructionLines &&
    instructionLines.bonus &&
    instructionLines.bonus.class === "text-success"
  ) {
    bonusActive = true;
    console.log("🎉 奖励条件已满足:", instructionLines.bonus.text);
  }

  const updates = {
    [`playerStates.${openId}.hand`]: newHand,
    [`playerStates.${openId}.bonusActive`]: bonusActive, // 将状态暴露给前端
    primarySelection: newPrimary,
    instructionState,
    instructionText,
    instructionSegments: instructionSegments || null,
    instructionLines: instructionLines || null,
  };

  if (primaryChanged) {
    updates.selectedSlot = null;
  }

  return updates;
};

const processGameData = (res, currentData) => {
  const myOpenId = currentData.openId;
  const viewingId = currentData.selectedPlayerOpenId || myOpenId;

  const currentHand = currentData.playerStates?.[myOpenId]?.hand || [];
  const selectedUids = new Set(
    currentHand.filter((c) => c.selected).map((c) => c.uid)
  );

  const gameState = res.data.gameState || {};
  const playerStates = gameState.playerStates;

  if (playerStates) {
    Object.keys(playerStates).forEach((openId) => {
      const playerState = playerStates[openId];

      // 确保 cave 字段存在（兼容旧数据）
      if (!playerState.cave) {
        playerState.cave = [];
      }

      if (playerState?.hand) {
        playerState.hand = enrichHand(
          playerState.hand,
          myOpenId,
          playerState._openid || openId,
          selectedUids
        );
      }
      if (playerState?.forest) {
        // 增强森林数据富化：确保 _id 是字符串以配合 WXML 比较
        playerState.forest = enrichForest(playerState.forest).map((g) => ({
          ...g,
          _id: String(g._id),
        }));
      }
    });
  }

  const viewingPlayerState = playerStates?.[viewingId];
  const displayForest = viewingPlayerState?.forest || [];
  const viewingPlayer = (res.data.players || []).find(
    (p) => p && p.openId === viewingId
  );

  const countForestCards = (forest) => {
    if (!Array.isArray(forest)) return 0;
    let count = 0;
    forest.forEach((group) => {
      if (group.center) count++;
      if (group.slots) {
        ["top", "bottom", "left", "right"].forEach((side) => {
          if (group.slots[side]) {
            // list 包含所有卡片（包括显示的），所以直接用 list.length
            count += group.slots[side].list ? group.slots[side].list.length : 1;
          }
        });
      }
    });
    return count;
  };

  let totalCardCount = 0;
  Object.values(playerStates || {}).forEach((pState) => {
    if (pState && pState.forest)
      totalCardCount += countForestCards(pState.forest);
  });

  const cardsChanged = totalCardCount !== (currentData.lastCardCount || 0);
  const users = res.data.players || [];

  // 如果有 turnOrder，按照 turnOrder 的顺序重新排列玩家
  const turnOrder = gameState.turnOrder || [];
  const sortedUsers =
    turnOrder.length > 0
      ? turnOrder
          .map((openId) => users.find((p) => p && p.openId === openId))
          .filter(Boolean)
      : users;

  const enrichedPlayers = sortedUsers
    .map((p) => {
      if (!p) return null;
      const pState = playerStates?.[p.openId];
      let score = 0;
      if (cardsChanged) {
        const scoreData = calculateTotalScore(
          pState,
          p.openId,
          playerStates,
          p.nickName
        );
        score = scoreData.total || 0;
      } else {
        const cached = require("./score/index").getCachedScore(p.openId);
        score = cached?.total || 0;
      }
      return {
        ...p,
        avatarUrl: getAvatarPath(p.openId, p.avatarUrl),
        score: score,
        handCount: pState?.hand?.length || 0,
      };
    })
    .filter(Boolean);

  const nextData = {
    ...currentData,
    playerStates,
    gameState,
    primarySelection: currentData.primarySelection,
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
    deckVisual: {
      bgImg: IMG_URLS[CARD_TYPES.V_CARD],
      bgSize: "700% 700%",
      cssClass: "card-sapling",
    },
    clearing: (gameState.clearing || []).map(enrichCard),
    playerStates,
    myForest: displayForest,
    viewingPlayerNick: viewingPlayer?.nickName || "玩家",
    isViewingSelf: viewingId === myOpenId,
    // 同步插槽逻辑：始终从 playerStates 获取最新状态
    // 这样确保无论何时切回视角（包括切回自己），都能看到云端同步的最新选中插槽
    selectedSlot: viewingPlayerState?.selectedSlot || null,
    isMyTurn,
    instructionState,
    instructionText,
    instructionSegments: instructionSegments || null,
    instructionLines: instructionLines || null,
    turnAction: gameState.turnAction || {
      drawnCount: 0,
    },
    currentTurn: gameState.turnCount || 1,
    lastCardCount: totalCardCount,
    gameState: gameState,
    isSpectator: !playerStates?.[myOpenId],
    enableVoice: res.data.settings
      ? res.data.settings.enableVoice ?? false
      : false,
  };
};

const DbHelper = {
  cleanHand(hand) {
    if (!Array.isArray(hand)) return [];
    return hand.map((c) => {
      // 保留核心数据，移除UI状态
      // 如果原来的逻辑需要保留uid，则保留。通常手牌需要uid来唯一标识
      const { selected, speciesDetails, bgImg, bgSize, cssClass, ...rest } = c;
      return rest;
    });
  },
  cleanClearing(clearing) {
    if (!Array.isArray(clearing)) return [];
    return clearing.map((c) => {
      const { selected, speciesDetails, bgImg, bgSize, cssClass, ...rest } = c;
      return rest;
    });
  },
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
  getAvatarPath,
  DbHelper,
};
