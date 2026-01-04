const Utils = require("../../../utils/utils");
const { CARD_TYPES } = require("../../../data/constants");
const { validatePlay } = require("../../../utils/validate.js");
const RoundUtils = require("../../../utils/round.js");
const DbHelper = require("../../../utils/dbHelper.js");
const { calculatePlayRewards, processRewardDraw } = require("./playReward.js");
const {
  submitGameUpdate,
  createExtraTurnEvent,
  createClearingNotification,
} = require("./core.js");
const db = wx.cloud.database();

/**
 * 准备出牌数据
 * 从手牌中提取主牌和支付牌,并进行基础校验
 */
function preparePlayData(page) {
  const {
    gameState,
    primarySelection,
    playerStates,
    openId,
    clearing,
    selectedSlot,
  } = page.data;

  const myState = playerStates[openId];
  const hand = [...(myState.hand || [])];
  const forest = [...(myState.forest || [])];
  const newClearing = [...(clearing || [])];
  const deck = [...(page.data.deck || [])]; // Get deck too

  const primaryIdx = hand.findIndex((c) => c.uid === primarySelection);
  if (primaryIdx === -1) {
    console.error("Selected card not in hand");
    return null;
  }

  const primaryCardRaw = hand[primaryIdx];
  const isTree = (primaryCardRaw.type || "").toLowerCase() === "tree";

  // 确定当前出牌的物理位置（侧边），用于富化双属性卡片数据
  let activeSide = "center";
  if (!isTree && selectedSlot) activeSide = selectedSlot.side;
  let primaryCard = Utils.enrichCardWithSpecies(primaryCardRaw, activeSide);

  // 特殊模式修正：如果是树苗模式，强制打出为树苗
  if (gameState.actionMode === "ACTION_PLAY_SAPLINGS") {
    primaryCard = {
      ...primaryCard,
      name: "树苗",
      type: CARD_TYPES.TREE,
      species: [{ type: CARD_TYPES.TREE, cost: 0 }],
      effect: "树苗：仅作为一棵树木计算",
      bonus: "",
      scoreConfig: null,
      effectConfig: null,
      bonusConfig: null,
      isSapling: true,
    };
  }

  const paymentCards = hand.filter(
    (c) => c.selected && c.uid !== primarySelection
  );
  const cardsToRemove = new Set([
    primarySelection,
    ...paymentCards.map((c) => c.uid),
  ]);
  const newHand = hand.filter((c) => !cardsToRemove.has(c.uid));

  return {
    hand,
    forest,
    newClearing,
    newHand,
    primaryCard,
    primaryCardRaw,
    paymentCards,
    isTree,
    activeSide,
    deck,
    cardsToRemove,
  };
}

/**
 * 将卡片放入森林
 * 处理树木和槽位卡片的放置逻辑,包括堆叠
 */
function placeCardInForest(forest, primaryCard, selectedSlot, isTree) {
  if (isTree) {
    // 打出树木
    forest.push({
      _id: Math.random().toString(36).substr(2, 9),
      center: primaryCard,
      slots: { top: null, bottom: null, left: null, right: null },
    });
    return forest;
  }

  // 打出槽位卡片
  const tIdx = forest.findIndex((t) => t._id === selectedSlot.treeId);
  const tTree = { ...forest[tIdx] };
  tTree.slots = tTree.slots || {
    top: null,
    bottom: null,
    left: null,
    right: null,
  };

  const existingCard = tTree.slots[selectedSlot.side];

  // 检查是否有共享槽位效果 (如刺荨麻)
  const allSlots = Object.values(tTree.slots || {});
  const enabler = allSlots.find(
    (c) => c && c.effectConfig && c.effectConfig.type === "CAPACITY_SHARE_SLOT"
  );
  const isStackMode =
    enabler &&
    enabler.effectConfig.tag &&
    primaryCard.tags &&
    primaryCard.tags.includes(enabler.effectConfig.tag);

  if (existingCard) {
    // 槽位已有卡片 - 堆叠逻辑
    const ec = existingCard.effectConfig;
    const targetName = primaryCard.name;
    const isCapacityIncrease =
      ec && ec.type === "CAPACITY_INCREASE" && ec.target === targetName;
    const isCapacityUnlimited =
      ec && ec.type === "CAPACITY_UNLIMITED" && ec.target === targetName;
    const isSelfStacking = isCapacityIncrease || isCapacityUnlimited;

    if (existingCard.max || isStackMode || isSelfStacking) {
      // 堆叠模式
      const currentList = existingCard.list || [];
      const currentMax = existingCard.max || 1;

      if (currentList.length >= currentMax) {
        wx.hideLoading();
        wx.showToast({
          title: `该插槽最多容纳${currentMax}张卡牌`,
          icon: "none",
        });
        return null;
      }

      const newList = [...currentList, primaryCard];

      let newSlotConfig = null;
      if (existingCard.slotConfig) {
        newSlotConfig = existingCard.slotConfig;
      } else if (isStackMode) {
        newSlotConfig = {
          accepts: { tags: [enabler.effectConfig.tag] },
          capacity: 99,
        };
      }

      tTree.slots[selectedSlot.side] = {
        ...primaryCard,
        list: newList,
        max: currentMax,
        slotConfig: newSlotConfig,
      };
    } else {
      wx.hideLoading();
      wx.showToast({ title: "该插槽已有卡片", icon: "none" });
      return null;
    }
  } else {
    // 槽位为空
    const pec = primaryCard.effectConfig;
    const pTargetName = primaryCard.name;
    const isPrimarySelfStacking =
      pec &&
      (pec.type === "CAPACITY_INCREASE" || pec.type === "CAPACITY_UNLIMITED") &&
      pec.target === pTargetName;

    if (isStackMode) {
      tTree.slots[selectedSlot.side] = {
        ...primaryCard,
        list: [primaryCard],
        max: 99,
        slotConfig: {
          accepts: { tags: [enabler.effectConfig.tag] },
          capacity: 99,
        },
      };
    } else if (isPrimarySelfStacking) {
      const maxCapacity =
        pec.type === "CAPACITY_UNLIMITED" ? 99 : pec.value || 1;
      tTree.slots[selectedSlot.side] = {
        ...primaryCard,
        list: [primaryCard],
        max: maxCapacity,
        slotConfig: null,
      };
    } else {
      tTree.slots[selectedSlot.side] = primaryCard;
    }
  }

  // 处理刺荨麻效果：将同树其他槽位中符合条件的卡片转换为堆叠模式
  if (
    primaryCard.effectConfig &&
    primaryCard.effectConfig.type === "CAPACITY_SHARE_SLOT"
  ) {
    const targetTag = primaryCard.effectConfig.tag;
    const slotsToConvert =
      targetTag === "BUTTERFLY" ? ["top"] : ["top", "bottom", "left", "right"];

    slotsToConvert.forEach((side) => {
      if (side !== selectedSlot.side && tTree.slots[side]) {
        const card = tTree.slots[side];
        if (card.tags && card.tags.includes(targetTag) && !card.max) {
          tTree.slots[side] = {
            ...card,
            list: [card],
            max: 99,
            slotConfig: {
              accepts: { tags: [targetTag] },
              capacity: 99,
            },
          };
        }
      }
    });
  }

  forest[tIdx] = tTree;
  return forest;
}

/**
 * 处理普通出牌的完整逻辑
 */
async function handleNormalPlay(page, source = "PLAYER_ACTION") {
  const {
    gameState,
    primarySelection,
    playerStates,
    openId,
    selectedSlot,
    turnAction,
  } = page.data;

  wx.showLoading({ title: "出牌中..." });

  // 1. 准备数据
  const playData = preparePlayData(page);
  if (!playData) {
    wx.hideLoading();
    return;
  }
  const { hand, newHand, primaryCard, paymentCards, isTree, deck } = playData;
  let { forest, newClearing } = playData;

  // 2. 校验合法性
  if (!isTree && !selectedSlot) {
    wx.hideLoading();
    wx.showToast({ title: "请选择森林中的空位", icon: "none" });
    return;
  }

  const selectedCount = hand.filter((c) => c.selected).length;
  const validation = validatePlay({
    openId,
    playerStates,
    gameState,
    turnAction,
    primarySelection,
    selectedSlot,
    primaryCard,
    myHand: hand,
    selectedCount,
  });

  if (!validation.valid) {
    wx.hideLoading();
    wx.showToast({ title: validation.error || "无法出牌", icon: "none" });
    return;
  }

  // 3. 执行出牌 (将卡片放入森林)
  const updatedForest = placeCardInForest(
    forest,
    primaryCard,
    selectedSlot,
    isTree
  );
  if (!updatedForest) {
    // placeCardInForest 如果返回 null (比如插槽已满) 会自己提示 toast
    return;
  }
  forest = updatedForest;

  // 4. 将支付的牌放入空地
  paymentCards.forEach((c) => {
    newClearing.push({ ...c, selected: false });
  });

  // 5. 计算奖励
  const { reward } = calculatePlayRewards(
    page,
    primaryCard,
    selectedSlot,
    paymentCards,
    forest,
    source,
    gameState
  );

  // 6. 处理抽牌奖励 (修改: 不立即执行,改为累积到 accumulatedRewards)
  let rewardDrawEvent = null;
  let finalHand = newHand; // 不再执行 processRewardDraw, 所以手牌不变
  let finalDeck = deck; // 牌堆也不变

  // if (reward.drawCount > 0) { ... } // 移除这段立即抽牌逻辑

  // 6.5. 打出树木时累积翻牌计数（灌木不算树木，不触发翻牌）
  // 判断逻辑：必须是树木类型(type=TREE)，且带有树木标签，且不是灌木
  const { TAGS } = require("../../../data/constants");
  const hasTreeTag =
    primaryCard.tags && primaryCard.tags.includes(CARD_TYPES.TREE);
  const isShrub = primaryCard.tags && primaryCard.tags.includes(TAGS.SHRUB);
  const isRealTree = isTree && hasTreeTag && !isShrub;

  console.log("🔍 检查是否为真正的树木:", {
    isTree,
    hasTreeTag,
    isShrub,
    isRealTree,
    cardName: primaryCard.name,
    cardType: primaryCard.type,
    tags: primaryCard.tags,
  });

  if (isRealTree) {
    const oldCount = page.pendingRevealCount || 0;
    page.pendingRevealCount = oldCount + 1;
    console.log("🌲 打出树木,累积翻牌计数:", {
      之前: oldCount,
      之后: page.pendingRevealCount,
      卡牌: primaryCard.name,
    });
  } else {
    console.log("⚠️ 不是树木(或是灌木),不累积翻牌计数");
  }

  // 7. 处理空地自动清空 (已移至 finalizeAction 统一处理，确保翻牌后再清空)
  let notificationEvent = null;


  // 8. 创建额外回合事件
  let extraTurnEvent = null;
  if (reward.extraTurn) {
    extraTurnEvent = createExtraTurnEvent(page);
  }

  // 9. 构造更新数据
  const myState = playerStates[openId];
  const allEvents = []; // 用于收集所有事件

  const updates = {
    [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(finalHand),
    [`gameState.playerStates.${openId}.forest`]: DbHelper.cleanForest(forest),
    [`gameState.playerStates.${openId}.selectedSlot`]: null, // 清除选中槽位
    [`gameState.clearing`]: DbHelper.cleanClearing(newClearing),
    [`gameState.deck`]: DbHelper.cleanDeck(finalDeck),
    [`gameState.rewardDrawEvent`]: rewardDrawEvent,
    [`gameState.extraTurnEvent`]: extraTurnEvent,
    [`gameState.notificationEvent`]: db.command.set(notificationEvent),
    [`gameState.lastEvent`]: {
      type: "PLAY_CARD",
      playerOpenId: openId,
      playerNick:
        page.data.players.find((p) => p.openId === openId)?.nickName || "玩家",
      playerAvatar:
        page.data.players.find((p) => p.openId === openId)?.avatarUrl || "",
      mainCard: Utils.enrichCard(primaryCard),
      subCards: paymentCards.map((c) => Utils.enrichCard(c)),
      triggers: reward.triggers || [],
      timestamp: Date.now(),
    },
  };

  // 10. 确定下一步: 处理行动队列

  // 10.1 识别并维护旧的行动队列
  // 如果当前是在特殊行动模式下打牌(如PLAY_FREE)，意味着消耗了一个 pendingAction
  const isSpecialPlayMode = ['ACTION_MOLE', 'ACTION_PLAY_SAPLINGS', 'PLAY_FREE'].includes(gameState.actionMode);
  let remainingActions = [];
  if (isSpecialPlayMode && gameState.pendingActions && gameState.pendingActions.length > 0) {
    // 移除头部（当前执行的这个）
    remainingActions = gameState.pendingActions.slice(1);
    console.log('🔄 检测到剩余待执行行动:', remainingActions);
  }

  // 10.2 合并新产生的行动 (新行动优先执行)
  const newActions = [...(reward.actions || []), ...remainingActions];

  // 10.3 合并累积奖励
  const oldRewards = gameState.accumulatedRewards || { drawCount: 0, extraTurn: false, removeClearingFlag: false, clearingToCaveFlag: false };

  const mergedRewards = {
    drawCount: (oldRewards.drawCount || 0) + (reward.drawCount || 0),
    extraTurn: oldRewards.extraTurn || reward.extraTurn,
    revealCount: 0,
    removeClearingFlag: oldRewards.removeClearingFlag || reward.removeClearingFlag || false,
    clearingToCaveFlag: oldRewards.clearingToCaveFlag || reward.clearingToCaveFlag || false
  };

  updates[`gameState.accumulatedRewards`] = mergedRewards;

  // 清除本地交互状态
  page.setData({
    primarySelection: null,
    selectedSlot: null,
    selectedClearingIdx: -1
  });

  if (newActions.length > 0) {
    // 还有后续行动，进入/更新 行动模式
    console.log('🎁 触发/继续行动队列:', newActions);

    updates[`gameState.pendingActions`] = newActions;
    updates[`gameState.actionMode`] = newActions[0].type;
    updates[`gameState.actionText`] = newActions[0].actionText || null;

    // 构造下个行动的通知
    const nextAction = newActions[0];
    const { openId, players } = page.data;
    const player = players.find(p => p.openId === openId);

    updates['gameState.notificationEvent'] = db.command.set({
      type: 'NOTIFICATION',
      playerOpenId: openId,
      playerNick: player?.nickName || '玩家',
      playerAvatar: player?.avatarUrl || '',
      icon: '⚡',
      message: `即将执行: ${nextAction.actionText || nextAction.text || '特殊行动'}`,
      timestamp: Date.now() + 200
    });

    submitGameUpdate(page, updates, "出牌成功", `打出了 ${primaryCard.name}`);
  } else {
    // 没有行动队列,直接结束回合
    console.log('📞 准备调用 finalizeAction, pendingRevealCount:', page.pendingRevealCount);
    const { finalizeAction } = require("./action.js");
    await finalizeAction(page, updates, `打出了 ${primaryCard.name}`);
  }
}

module.exports = {
  preparePlayData,
  placeCardInForest,
  handleNormalPlay,
};
