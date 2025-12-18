const Utils = require("../../utils/utils");
const RewardUtils = require("../../utils/reward.js");
const RoundUtils = require("../../utils/round.js");
const AnimationUtils = require("../../utils/animation.js");
const DbHelper = require("../../utils/dbHelper.js");
const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    roomId: "", // 房间ID
    players: [], // 玩家列表
    deck: [], // 牌堆
    clearing: [], // 空地
    playerStates: {},
    openId: "", // 当前登录的openId
    selectedPlayerOpenId: "", // 当前选中的玩家openId
    primarySelection: "", // 当前选中的主牌UID
    instructionState: "normal", // 指引状态 (normal, error, warning, success)
    instructionText: "", // 指引文案
    lastActivePlayer: "", // 上一个激活的玩家，用于判断轮次切换
    lastTurnCount: -1,
    lastNotifiedTurnCount: -1,
    enableAnimation: true, // 动画开关
    eventQueue: [], // 事件队列
    isProcessingEvent: false, // 是否正在处理事件动画
    lastEventTime: 0, // 上一个处理完成的事件时间戳
    currentEvent: null, // 当前正在展示的事件
    isCardFlipped: false, // 专门为 3D 翻转准备的本地状态
    pendingTurnToast: false, // 是否有待触发的回合提示
    pendingActionToast: null, // 是否有待触发的操作提示 (如: 还可以再拿一张)
  },

  onLoad(options) {
    const app = getApp();
    let profile = app.globalData.userProfile;
    if (!profile) {
      try {
        profile = wx.getStorageSync("userProfile");
        if (profile) app.globalData.userProfile = profile;
      } catch (e) { }
    }
    if (!profile || (!profile.openId && !profile.uid)) {
      wx.showToast({ title: "请先登录", icon: "none" });
      setTimeout(() => { wx.reLaunch({ url: "/pages/index/index" }); }, 1500);
      return;
    }
    const openId = profile.openId || profile.uid;
    this.setData({ roomId: options.roomId, openId, selectedPlayerOpenId: openId });
  },

  onShow() { this.startPolling(); },
  onHide() { this.stopPolling(); },
  onUnload() { this.stopPolling(); },

  startPolling() {
    this.stopPolling();
    if (!this.data.roomId) return;
    this.queryGameData(this.data.roomId);
    this.pollingTimer = setInterval(() => { this.queryGameData(this.data.roomId); }, 1000);
  },

  stopPolling() {
    if (this.pollingTimer) { clearInterval(this.pollingTimer); this.pollingTimer = null; }
    if (this.turnToastTimer) { clearTimeout(this.turnToastTimer); this.turnToastTimer = null; }
  },

  async queryGameData(roomId) {
    try {
      const res = await db.collection("rooms").doc(roomId).get();
      const serverData = res.data;
      const gameState = serverData.gameState || {};
      const processedData = Utils.processGameData(res, this.data);

      const currentActive = gameState.activePlayer || serverData.activePlayer;
      const currentTurnCount = gameState.turnCount || 0;
      const lastTurnCount = typeof this.data.lastTurnCount === "number" ? this.data.lastTurnCount : -1;

      // 1. 回合切换逻辑 (标记待提示)
      if (lastTurnCount !== -1 && currentTurnCount > lastTurnCount && currentActive === this.data.openId) {
        if (this.data.lastNotifiedTurnCount !== currentTurnCount) {
          processedData.pendingTurnToast = true;
          processedData.lastNotifiedTurnCount = currentTurnCount;
        }
      }

      // 2. 事件队列处理 (全场大图展示)
      const lastEvent = gameState.lastEvent;
      const deckRevealEvent = gameState.deckRevealEvent;
      let nextLastEventTime = this.data.lastEventTime || 0;
      let added = false;

      if (lastEvent && lastEvent.timestamp > nextLastEventTime) {
        this.addToEventQueue(lastEvent);
        nextLastEventTime = Math.max(nextLastEventTime, lastEvent.timestamp);
        added = true;
      }
      if (deckRevealEvent && deckRevealEvent.timestamp > nextLastEventTime) {
        this.addToEventQueue(deckRevealEvent);
        nextLastEventTime = Math.max(nextLastEventTime, deckRevealEvent.timestamp);
        added = true;
      }

      processedData.lastEventTime = nextLastEventTime;
      processedData.lastActivePlayer = currentActive || '';
      processedData.lastTurnCount = currentTurnCount;

      this.setData(processedData);
      if (added) this.processNextEvent();
    } catch (e) { console.error("Query Failed", e); }
  },

  addToEventQueue(event) {
    this.setData({ eventQueue: [...this.data.eventQueue, event] });
  },

  async processNextEvent() {
    if (this.data.isProcessingEvent) return;

    if (this.data.eventQueue.length === 0) {
      this.setData({ isProcessingEvent: false });
      // 队列结束，如果刚才有待提示的回合切换，现在触发
      if (this.data.pendingTurnToast) {
        wx.showToast({ title: "轮到你了！", icon: "none" });
        this.setData({ pendingTurnToast: false });
      }
      if (this.data.pendingActionToast) {
        wx.showToast({ title: this.data.pendingActionToast, icon: "none" });
        this.setData({ pendingActionToast: null });
      }
      return;
    }

    this.setData({ isProcessingEvent: true });
    const event = this.data.eventQueue[0];
    const remaining = this.data.eventQueue.slice(1);

    this.setData({ currentEvent: event, eventQueue: remaining, isCardFlipped: false });

    // 如果是带翻页效果的事件，延迟触发翻转
    if (event.type === 'DRAW_CARD' || event.type === 'DECK_TO_CLEARING') {
      setTimeout(() => { this.setData({ isCardFlipped: true }); }, 50);
    } else {
      this.setData({ isCardFlipped: true });
    }

    const duration = 1000;
    setTimeout(() => {
      this.setData({ currentEvent: null, isProcessingEvent: false });
      this.processNextEvent();
    }, duration);
  },

  onCloseEvent() {
    this.setData({ currentEvent: null, isProcessingEvent: false });
    this.processNextEvent();
  },

  onPlayerTap(e) {
    const opid = e.currentTarget.dataset.openid;
    if (opid) {
      this.setData({ selectedPlayerOpenId: opid });
      this.queryGameData(this.data.roomId);
    }
  },

  onHandTap(e) {
    const updates = Utils.handleHandTap(e.currentTarget.dataset.uid, this.data);
    if (updates) this.setData(updates);
  },

  onShowDetail(e) {
    const { uid, idx, type, cardid } = e.currentTarget.dataset;
    let cardId = cardid;
    if (type === 'clearing') cardId = this.data.clearing[idx]?.id;
    else if (type === 'hand') cardId = this.data.playerStates[this.data.openId]?.hand?.find(c => c.uid === uid)?.id;
    if (cardId) this.setData({ detailCardId: cardId });
  },
  onCloseDetail() { this.setData({ detailCardId: null }); },
  onCloseDrawing() { /* 不需要了，现在统一走 eventQueue */ },

  onSlotTap(e) {
    const { treeid, side } = e.currentTarget.dataset;
    if (this.data.selectedSlot?.treeId === treeid && this.data.selectedSlot?.side === side) {
      this.setData({ selectedSlot: null });
      return;
    }
    const slot = { treeId: treeid, side, isValid: true };
    const nextData = { ...this.data, selectedSlot: slot };
    const { instructionState, instructionText } = Utils.computeInstruction(nextData);
    this.setData({ selectedSlot: slot, instructionState, instructionText });
  },

  onConfirmPlay() {
    const { primarySelection, playerStates, openId, clearing, selectedSlot, instructionState, turnAction } = this.data;
    if (turnAction?.drawnCount > 0 || turnAction?.takenCount > 0) {
      wx.showToast({ title: "已摸牌，本回合只能继续摸牌", icon: "none" });
      return;
    }
    if (!primarySelection || instructionState === 'error') {
      wx.showToast({ title: !primarySelection ? "请先选择主牌" : "费用未满足", icon: "none" });
      return;
    }
    if (this.data.turnAction?.drawnCount > 0) {
      wx.showToast({ title: "已摸牌，本回合只能继续摸牌", icon: "none" });
      return;
    }

    wx.showLoading({ title: "出牌中..." });
    const myState = playerStates[openId];
    const hand = [...(myState.hand || [])];
    const forest = [...(myState.forest || [])];
    const newClearing = [...(clearing || [])];

    const primaryIdx = hand.findIndex(c => c.uid === primarySelection);
    const primaryCard = Utils.enrichCard(hand[primaryIdx]);
    const isTree = primaryCard.type.toLowerCase() === 'tree';

    if (!isTree && !selectedSlot) {
      wx.hideLoading();
      wx.showToast({ title: "请选择森林中的空位", icon: "none" });
      return;
    }

    const paymentCards = hand.filter(c => c.selected && c.uid !== primarySelection);
    const cardsToRemove = new Set([primarySelection, ...paymentCards.map(c => c.uid)]);
    const newHand = hand.filter(c => !cardsToRemove.has(c.uid));

    if (isTree) {
      forest.push({
        _id: Math.random().toString(36).substr(2, 9),
        center: primaryCard,
        slots: { top: null, bottom: null, left: null, right: null }
      });
    } else {
      const tIdx = forest.findIndex(t => t._id === selectedSlot.treeId);
      const tTree = { ...forest[tIdx] };
      tTree.slots = tTree.slots || { top: null, bottom: null, left: null, right: null };
      tTree.slots[selectedSlot.side] = primaryCard;
      forest[tIdx] = tTree;
    }

    // 计算奖励
    const bonus = RewardUtils.calculateColorReward(primaryCard, selectedSlot, paymentCards);
    const effect = RewardUtils.calculateEffect(primaryCard, { forest });
    const reward = {
      drawCount: (bonus.drawCount || 0) + (effect.drawCount || 0),
      extraTurn: bonus.extraTurn || effect.extraTurn
    };

    let newDeck = [...this.data.deck];
    for (let i = 0; i < reward.drawCount; i++) {
      if (newDeck.length > 0) newHand.push(newDeck.shift());
    }

    paymentCards.forEach(c => newClearing.push({ ...c, selected: false }));

    let deckRevealEvent = null;
    if (isTree && newDeck.length > 0) {
      const top = newDeck.shift();
      newClearing.push({ ...top, selected: false });
      deckRevealEvent = {
        type: 'DECK_TO_CLEARING',
        playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
        playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
        mainCard: Utils.enrichCard(top),
        timestamp: Date.now() + 100
      };
    }
    if (newClearing.length >= 10) newClearing.length = 0;

    const nextPlayer = RoundUtils.getNextPlayer(openId, this.data.players, reward.extraTurn);
    const updates = {
      [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(newHand),
      [`gameState.playerStates.${openId}.forest`]: DbHelper.cleanForest(forest),
      [`gameState.clearing`]: DbHelper.cleanClearing(newClearing),
      [`gameState.deck`]: DbHelper.cleanDeck(newDeck),
      [`gameState.activePlayer`]: nextPlayer,
      [`gameState.turnAction`]: { drawnCount: 0, takenCount: 0 },
      [`gameState.turnCount`]: db.command.inc(1),
      [`gameState.turnReason`]: reward.extraTurn ? "extra" : "normal",
      [`gameState.lastEvent`]: {
        type: 'PLAY_CARD', playerOpenId: openId,
        playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
        playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
        mainCard: primaryCard, subCards: paymentCards.map(c => Utils.enrichCard(c)),
        timestamp: Date.now()
      },
      [`gameState.deckRevealEvent`]: deckRevealEvent
    };

    this.submitGameUpdate(updates, "出牌成功", `打出了 ${primaryCard.name}`);
  },

  onDrawCard() {
    if (this.data.selectedClearingIdx === -2) this.setData({ selectedClearingIdx: -1 });
    else this.setData({ selectedClearingIdx: -2 });
  },

  onConfirmTake() {
    const { selectedClearingIdx, clearing, playerStates, openId, turnAction } = this.data;
    if (selectedClearingIdx === -1 || selectedClearingIdx === undefined) return;
    if (selectedClearingIdx === -2) { this.executeDrawFromDeck(); return; }

    const curTotal = (turnAction?.drawnCount || 0) + (turnAction?.takenCount || 0);
    if (curTotal >= 2) { wx.showToast({ title: "步数已用完", icon: "none" }); return; }
    if (playerStates[openId].hand.length >= 10) { wx.showToast({ title: "手牌已满", icon: "none" }); return; }

    const newClearing = [...clearing];
    const newHand = [...playerStates[openId].hand];
    const [card] = newClearing.splice(selectedClearingIdx, 1);
    newHand.push(card);

    const isEnd = (curTotal + 1) >= 2;
    const nextPlayer = RoundUtils.getNextPlayer(openId, this.data.players, false);

    const updates = {
      [`gameState.clearing`]: DbHelper.cleanClearing(newClearing),
      [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(newHand),
      [`gameState.turnAction`]: { ...turnAction, takenCount: (turnAction.takenCount || 0) + 1 },
      [`gameState.lastEvent`]: {
        type: 'TAKE_CARD', playerOpenId: openId,
        playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
        playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
        mainCard: Utils.enrichCard(card), timestamp: Date.now()
      }
    };
    if (isEnd) {
      updates[`gameState.activePlayer`] = nextPlayer;
      updates[`gameState.turnAction`] = { drawnCount: 0, takenCount: 0 };
      updates[`gameState.turnCount`] = db.command.inc(1);
    } else {
      this.setData({ pendingActionToast: "还可以再拿一张牌" });
    }
    this.submitGameUpdate(updates, null, `从空地拿了 ${card.name}`);
  },

  executeDrawFromDeck() {
    const { deck, playerStates, openId, turnAction } = this.data;
    const curTotal = (turnAction?.drawnCount || 0) + (turnAction?.takenCount || 0);
    if (curTotal >= 2 || playerStates[openId].hand.length >= 10 || deck.length === 0) return;

    const newDeck = [...deck];
    const newHand = [...playerStates[openId].hand];
    const card = newDeck.shift();
    newHand.push(card);

    const isEnd = (curTotal + 1) >= 2;
    const nextPlayer = RoundUtils.getNextPlayer(openId, this.data.players, false);
    const updates = {
      [`gameState.deck`]: DbHelper.cleanDeck(newDeck),
      [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(newHand),
      [`gameState.turnAction`]: { ...turnAction, drawnCount: (turnAction.drawnCount || 0) + 1 },
      [`gameState.lastEvent`]: {
        type: 'DRAW_CARD', playerOpenId: openId,
        playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
        playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
        mainCard: Utils.enrichCard(card), timestamp: Date.now()
      }
    };
    if (isEnd) {
      updates[`gameState.activePlayer`] = nextPlayer;
      updates[`gameState.turnAction`] = { drawnCount: 0, takenCount: 0 };
      updates[`gameState.turnCount`] = db.command.inc(1);
    } else {
      this.setData({ pendingActionToast: "还可以再摸一张牌" });
    }
    this.submitGameUpdate(updates, null, `从牌堆摸了一张牌`);
  },

  onEndTurn() {
    const next = RoundUtils.getNextPlayer(this.data.openId, this.data.players, false);
    this.submitGameUpdate({
      [`gameState.activePlayer`]: next,
      [`gameState.turnCount`]: db.command.inc(1),
      [`gameState.turnAction`]: { drawnCount: 0, takenCount: 0 }
    }, "回合结束", "主动结束了回合");
  },

  async submitGameUpdate(updates, successMsg, logMsg) {
    if (logMsg) updates["gameState.logs"] = db.command.push({ operator: this.data.openId, action: logMsg, timestamp: Date.now() });

    // --- 性能优化：本地立即触发动画，不再等待轮询 ---
    const localLastEvent = updates['gameState.lastEvent'];
    const localDeckReveal = updates['gameState.deckRevealEvent'];
    let nextLastEventTime = this.data.lastEventTime || 0;
    let added = false;

    if (localLastEvent) {
      this.addToEventQueue(localLastEvent);
      nextLastEventTime = Math.max(nextLastEventTime, localLastEvent.timestamp);
      added = true;
    }
    if (localDeckReveal) {
      this.addToEventQueue(localDeckReveal);
      nextLastEventTime = Math.max(nextLastEventTime, localDeckReveal.timestamp);
      added = true;
    }

    if (added) {
      this.setData({ lastEventTime: nextLastEventTime });
      this.processNextEvent();
    }
    // ------------------------------------------

    try {
      await db.collection("rooms").doc(this.data.roomId).update({ data: updates });
      wx.hideLoading();

      // 彻底清空手牌的选择状态
      const { openId, playerStates } = this.data;
      if (playerStates[openId] && playerStates[openId].hand) {
        playerStates[openId].hand.forEach(c => c.selected = false);
      }

      this.setData({
        selectedClearingIdx: -1,
        primarySelection: null,
        selectedSlot: null,
        [`playerStates.${openId}.hand`]: playerStates[openId].hand || []
      });
    } catch (e) { wx.hideLoading(); console.error(e); }
  },

  onShowBuffs() {
    const { playerStates, openId } = this.data;
    const forest = playerStates[openId]?.forest || [];
    let triggers = [];
    forest.forEach(group => {
      [group.center, group.slots?.top, group.slots?.bottom, group.slots?.left, group.slots?.right].forEach(card => {
        if (card && (card.effect || card.points)) {
          triggers.push(`${card.name}: ${card.effect || card.points}`);
        }
      });
    });

    if (triggers.length === 0) {
      wx.showToast({ title: "当前无生效Buff", icon: "none" });
    } else {
      wx.showModal({ title: '森林Buff一览', content: triggers.join('\n'), showCancel: false });
    }
  },

  onPlaySapling() {
    if (this.data.turnAction?.drawnCount > 0 || this.data.turnAction?.takenCount > 0) {
      wx.showToast({ title: "已摸牌，本回合只能继续摸牌", icon: "none" });
      return;
    }
    const { SAPLING_DATA } = require("../../data/speciesData");
    wx.showModal({
      title: '打出树苗',
      content: '树苗不消耗手牌，费用为0。确定种植一颗树苗吗？',
      success: (res) => {
        if (res.confirm) this.executePlaySapling(SAPLING_DATA);
      }
    });
  },

  async executePlaySapling(saplingData) {
    wx.showLoading({ title: "种植中..." });
    const { playerStates, openId, clearing, deck } = this.data;
    const myState = playerStates[openId];
    const forest = [...(myState.forest || [])];
    const newClearing = [...(clearing || [])];
    const newDeck = [...(deck || [])];

    const saplingCard = {
      ...saplingData,
      uid: 'sapling_' + Math.random().toString(36).substr(2, 9),
      id: 'sapling'
    };
    const enriched = Utils.enrichCard(saplingCard);

    forest.push({
      _id: Math.random().toString(36).substr(2, 9),
      center: enriched,
      slots: { top: null, bottom: null, left: null, right: null }
    });

    let deckRevealEvent = null;
    if (newDeck.length > 0) {
      const top = newDeck.shift();
      newClearing.push({ ...top, selected: false });
      deckRevealEvent = {
        type: 'DECK_TO_CLEARING',
        playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
        playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
        mainCard: Utils.enrichCard(top),
        timestamp: Date.now() + 100
      };
    }
    if (newClearing.length >= 10) newClearing.length = 0;

    const nextPlayer = RoundUtils.getNextPlayer(openId, this.data.players, false);
    const updates = {
      [`gameState.playerStates.${openId}.forest`]: DbHelper.cleanForest(forest),
      [`gameState.clearing`]: DbHelper.cleanClearing(newClearing),
      [`gameState.deck`]: DbHelper.cleanDeck(newDeck),
      [`gameState.activePlayer`]: nextPlayer,
      [`gameState.turnAction`]: { drawnCount: 0, takenCount: 0 },
      [`gameState.turnCount`]: db.command.inc(1),
      [`gameState.lastEvent`]: {
        type: 'PLAY_CARD', playerOpenId: openId,
        playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
        playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
        mainCard: enriched, subCards: [], timestamp: Date.now()
      },
      [`gameState.deckRevealEvent`]: deckRevealEvent
    };

    this.submitGameUpdate(updates, "种植成功", "种植了一棵树苗");
  },

  onClearingCardTap(e) {
    const idx = e.currentTarget.dataset.idx;
    this.setData({ selectedClearingIdx: this.data.selectedClearingIdx === idx ? -1 : idx });
  }
});
