const Utils = require("../../utils/utils");
const { calculateBonus } = require("../../utils/bonus.js");
const { calculateEffect, calculateTriggerEffects } = require("../../utils/effect.js");
const RoundUtils = require("../../utils/round.js");
const AnimationUtils = require("../../utils/animation.js");
const DbHelper = require("../../utils/dbHelper.js");
const SpecialActionUtils = require("../../utils/specialAction.js");
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
    clearingScrollId: "", // 空地滚动定位ID
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
      // 只要是我的回合，且回合数变更了（说明是新回合），就提示
      if (currentActive === this.data.openId && this.data.lastNotifiedTurnCount !== currentTurnCount) {
        processedData.pendingTurnToast = true;
        processedData.lastNotifiedTurnCount = currentTurnCount;
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
      const oldLen = this.data.clearing ? this.data.clearing.length : 0;
      const newLen = processedData.clearing ? processedData.clearing.length : 0;
      let targetScrollId = null;

      // 只要卡片数量增加，就尝试滚动到最新那张卡
      // 为了让最新卡片出现在屏幕右侧，我们滚动到它前面的第3张卡片 (适配不同机型宽度)
      if (newLen > oldLen && newLen > 0) {
        const targetIndex = Math.max(0, newLen - 3);
        targetScrollId = `clearing-${targetIndex}`;
      }

      this.setData(processedData, () => {
        if (targetScrollId) {
          // 强制触发滚动：先置空，再赋值，确保 scroll-view 监听到变化
          this.setData({ clearingScrollId: '' }, () => {
            setTimeout(() => {
              this.setData({ clearingScrollId: targetScrollId });
            }, 100);
          });
        }
        // moved inside callback to ensure data is updated
        if (added || processedData.pendingTurnToast) this.processNextEvent();
      });
    } catch (e) { console.error("Query Failed", e); }
  },

  addToEventQueue(event) {
    this.setData({ eventQueue: [...this.data.eventQueue, event] });
  },

  async processNextEvent() {
    if (this.data.isProcessingEvent) return;

    if (this.data.eventQueue.length === 0) {
      // 特殊情况处理：虽然没有事件，但有待显示的 Toast (通常是回合切换)
      if (this.data.pendingTurnToast) {
        wx.showToast({ title: "轮到你了！", icon: "none", duration: 1500 });
        this.setData({ pendingTurnToast: false, isProcessingEvent: false });
        return;
      }

      this.setData({ isProcessingEvent: false });

      // 队列结束，如果刚才有待提示的回合切换，现在触发
      // 注意：这里使用 data 中的最新状态，因为 processNextEvent 可能被多次调用
      if (this.data.pendingTurnToast) {
        wx.showToast({ title: "轮到你了！", icon: "none", duration: 1500 });
        this.setData({ pendingTurnToast: false });
      } else if (this.data.pendingActionToast) {
        // action toast 优先级较低，只有没有 turn toast 时才显示
        wx.showToast({ title: this.data.pendingActionToast, icon: "none", duration: 1500 });
        this.setData({ pendingActionToast: null });
      }
      return;
    }

    this.setData({ isProcessingEvent: true });
    const event = this.data.eventQueue[0];
    const remaining = this.data.eventQueue.slice(1);

    this.setData({ currentEvent: event, eventQueue: remaining, isCardFlipped: false });

    // 如果是带翻页效果的事件，延迟触发翻转
    const needsFlip = event.type === 'DRAW_CARD' || event.type === 'DECK_TO_CLEARING' || event.type === 'REWARD_DRAW';
    if (needsFlip) {
      setTimeout(() => { this.setData({ isCardFlipped: true }); }, 50);
    } else {
      this.setData({ isCardFlipped: true });
    }

    const duration = 1500;
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

    // 逻辑修正：点击已选中的槽位应取消选中，且必须重新计算指引
    let nextSlot = { treeId: treeid, side, isValid: true };
    if (this.data.selectedSlot?.treeId === treeid && this.data.selectedSlot?.side === side) {
      nextSlot = null; // 取消选中
    }

    const nextData = { ...this.data, selectedSlot: nextSlot };
    const { instructionState, instructionText } = Utils.computeInstruction(nextData);

    this.setData({
      selectedSlot: nextSlot,
      instructionState,
      instructionText
    });
  },

  // source: 'PLAYER_ACTION' | 'MOLE_EFFECT' | 'FREE_PLAY' | ...
  async onConfirmPlay(source = 'PLAYER_ACTION') {
    const { gameState, primarySelection, playerStates, openId, clearing, selectedSlot, instructionState, turnAction } = this.data;
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
    const primaryCardRaw = hand[primaryIdx];
    const isTree = (primaryCardRaw.type || '').toLowerCase() === 'tree';

    // 确定当前出牌的物理位置（侧边），用于富化双属性卡片数据
    let activeSide = 'center';
    if (!isTree && selectedSlot) activeSide = selectedSlot.side;
    let primaryCard = Utils.enrichCardWithSpecies(primaryCardRaw, activeSide);

    // 特殊模式修正：如果是树苗模式，强制打出为树苗
    if (gameState.actionMode === 'PLAY_SAPLINGS') {
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
        isSapling: true
      };
    }

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

    // 根据打牌来源决定是否计算 Bonus 和 Effect
    // 效果触发的打牌不会触发该卡片自身的 Bonus 和 Effect
    let bonus = { drawCount: 0, extraTurn: false, actions: [] };
    let effect = { drawCount: 0, extraTurn: false, actions: [] };

    const isSpecialPlayMode = ['MOLE', 'FREE_PLAY_BAT', 'PLAY_SAPLINGS', 'PLAY_FREE', 'PLAY_FREE_SPECIFIC'].includes(gameState.actionMode);

    if (source === 'PLAYER_ACTION') {
      // 在特殊模式下打牌，不重新触发该牌自身的 Bonus 和 Effect (防止无限循环)
      if (!isSpecialPlayMode) {
        bonus = calculateBonus(primaryCard, selectedSlot, paymentCards);
        effect = calculateEffect(primaryCard, { forest }, paymentCards);
      }
    }

    // 始终计算森林中已存在的常驻效果触发 (Trigger Effects)
    const triggers = calculateTriggerEffects(forest, primaryCard, { slot: selectedSlot });

    const reward = {
      drawCount: (bonus.drawCount || 0) + (effect.drawCount || 0) + (triggers.drawCount || 0),
      extraTurn: bonus.extraTurn || effect.extraTurn,
      actions: [...(bonus.actions || []), ...(effect.actions || [])]
    };

    // 如果是处于特殊模式下打的这一张牌
    if (isSpecialPlayMode) {
      // 将这张牌打出的事件存入更新
      const updates = {
        [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(newHand),
        [`gameState.playerStates.${openId}.forest`]: DbHelper.cleanForest(forest),
        [`gameState.clearing`]: DbHelper.cleanClearing(newClearing),
        [`gameState.lastEvent`]: {
          type: 'PLAY_CARD', playerOpenId: openId,
          playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
          playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
          mainCard: primaryCard, subCards: paymentCards.map(c => Utils.enrichCard(c)),
          timestamp: Date.now()
        },
        // 特殊模式下的奖励累积
        [`gameState.accumulatedRewards.drawCount`]: db.command.inc(reward.drawCount),
      };

      // 如果触发了额外回合，累积它
      if (reward.extraTurn) updates[`gameState.accumulatedRewards.extraTurn`] = true;

      // 如果这张牌本身又带了新的特殊行动（虽然规则上极少见，但为了健壮性考虑）
      if (reward.actions.length > 0) {
        // 简单处理：将新的行动加入队列
        updates[`gameState.pendingActions`] = [...(gameState.pendingActions || []), ...reward.actions];
      }

      wx.hideLoading();
      this.submitGameUpdate(updates, "出牌成功", `(特殊模式) 打出了 ${primaryCard.name}`);
      return;
    }

    // 检查是否有待处理的特殊行动
    if (reward.actions && reward.actions.length > 0) {
      // 支付费用卡放入空地 (这是前提，因为自动效果可能要吸走这些费用卡)
      paymentCards.forEach(c => newClearing.push({ ...c, selected: false }));

      const firstAction = reward.actions[0];
      const actionMode = SpecialActionUtils.detectActionMode(firstAction);
      const actionText = bonus.text || effect.text || "特殊行动中...";

      // 如果是全自动行动，直接执行并提交
      if (SpecialActionUtils.isAutomatic(actionMode)) {
        const autoResult = this.executeAutomaticAction(actionMode, {
          hand: newHand,
          forest: forest,
          clearing: newClearing,
          playerState: myState,
          actionConfig: firstAction
        });

        const updates = {
          [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(newHand),
          [`gameState.playerStates.${openId}.forest`]: DbHelper.cleanForest(forest),
          ...autoResult.updates,
          [`gameState.accumulatedRewards`]: { drawCount: reward.drawCount, extraTurn: reward.extraTurn },
          [`gameState.lastEvent`]: {
            type: 'PLAY_CARD', playerOpenId: openId,
            playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
            playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
            mainCard: primaryCard, subCards: paymentCards.map(c => Utils.enrichCard(c)),
            timestamp: Date.now()
          }
        };

        this.pendingDrawCount = 0;
        await this.finalizeAction(updates, `触发效果: ${actionText}`);
        return;
      }

      // 非自动行动，进入特殊行动模式
      const updates = {
        [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(newHand),
        [`gameState.playerStates.${openId}.forest`]: DbHelper.cleanForest(forest),
        [`gameState.clearing`]: DbHelper.cleanClearing(newClearing),
        [`gameState.pendingActions`]: reward.actions,
        [`gameState.actionMode`]: actionMode,
        [`gameState.actionText`]: actionText,
        [`gameState.accumulatedRewards`]: {
          drawCount: reward.drawCount,
          extraTurn: reward.extraTurn
        },
        [`gameState.lastEvent`]: {
          type: 'PLAY_CARD', playerOpenId: openId,
          playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
          playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
          mainCard: primaryCard, subCards: paymentCards.map(c => Utils.enrichCard(c)),
          timestamp: Date.now()
        }
      };

      wx.hideLoading();
      this.submitGameUpdate(updates, "出牌成功", `触发效果: ${actionText}`);
      return;
    }

    // 没有特殊行动，正常流程：摸牌、翻牌、结束回合
    let newDeck = [...this.data.deck];
    // 奖励抽牌逻辑：受手牌上限 10 张限制
    // 举例：手牌8张，支付1张(剩余7张)，奖励5张 -> 7+5=12 > 10，只能抽 3 张
    const currentHandSize = newHand.length;
    const maxCanDraw = 10 - currentHandSize;
    const actualDraw = Math.max(0, Math.min(reward.drawCount, maxCanDraw));

    for (let i = 0; i < actualDraw; i++) {
      if (newDeck.length > 0) newHand.push(newDeck.shift());
    }
    // 如果 reward.drawCount > actualDraw，多余的抽牌机会作废（或者是顶掉牌堆顶的卡？通常规则是作废或不抽）
    // 根据描述"只能获得3张"，意味着剩下的就不抽了，保留在牌堆顶。上述代码符合此逻辑。

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

    // 雌性野猪效果：清空空地
    if (effect.actions && effect.actions.some(a => a.type === 'ACTION_REMOVE_CLEARING')) {
      newClearing.length = 0;
    }

    let rewardDrawEvent = null;
    if (actualDraw > 0) {
      rewardDrawEvent = {
        type: 'REWARD_DRAW',
        playerOpenId: openId,
        playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
        playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
        count: actualDraw,
        timestamp: Date.now() - 50 // 确保在 PLAY_CARD 之前或紧随其后
      };
    }

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
      [`gameState.deckRevealEvent`]: deckRevealEvent,
      [`gameState.rewardDrawEvent`]: rewardDrawEvent
    };

    this.submitGameUpdate(updates, "出牌成功", `打出了 ${primaryCard.name}`);
  },

  onDrawCard() {
    if (this.data.selectedClearingIdx === -2) this.setData({ selectedClearingIdx: -1 });
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

    const isEnd = (curTotal + 1) >= 2 || newHand.length >= 10;
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

    // Check hand limit first and show toast if full
    if (playerStates[openId].hand.length >= 10) {
      wx.showToast({ title: "手牌已满", icon: "none" });
      return;
    }

    if (curTotal >= 2 || deck.length === 0) return;

    const newDeck = [...deck];
    const newHand = [...playerStates[openId].hand];
    const card = newDeck.shift();
    newHand.push(card);

    const isEnd = (curTotal + 1) >= 2 || newHand.length >= 10;
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
    wx.showModal({
      title: '结束回合',
      content: '确定要结束本回合吗？',
      success: (res) => {
        if (res.confirm) {
          const next = RoundUtils.getNextPlayer(this.data.openId, this.data.players, false);
          this.submitGameUpdate({
            [`gameState.activePlayer`]: next,
            [`gameState.turnCount`]: db.command.inc(1),
            [`gameState.turnAction`]: { drawnCount: 0, takenCount: 0 }
          }, "回合结束", "主动结束了回合");
        }
      }
    });
  },

  /**
   * 执行自动特殊行动逻辑（无需玩家选择）
   */
  executeAutomaticAction(mode, context) {
    const { clearing, playerState, actionConfig } = context;
    const updates = {};
    const openId = this.data.openId;

    switch (mode) {
      case 'BEAR': {
        const clearingCards = [...clearing];
        if (clearingCards.length > 0) {
          const newCave = [...(playerState.cave || []), ...clearingCards.map(c => ({ ...c, selected: false }))];
          updates[`gameState.clearing`] = [];
          updates[`gameState.playerStates.${openId}.cave`] = DbHelper.cleanHand(newCave);
        }
        break;
      }
      case 'CLEARING_TO_CAVE': {
        const tags = actionConfig?.tags || [];
        const toCave = clearing.filter(c => {
          if (c.type === 'tree') return true;
          if (c.tags && c.tags.some(t => tags.includes(t))) return true;
          return false;
        });
        if (toCave.length > 0) {
          const newClearing = clearing.filter(c => !toCave.includes(c));
          const newCave = [...(playerState.cave || []), ...toCave.map(c => ({ ...c, selected: false }))];
          updates[`gameState.clearing`] = DbHelper.cleanClearing(newClearing);
          updates[`gameState.playerStates.${openId}.cave`] = DbHelper.cleanHand(newCave);
        }
        break;
      }
    }
    return { updates };
  },

  /**
   * 确认执行当前模式下的特殊行动
   */
  async onConfirmSpecialAction() {
    const { gameState, openId, playerStates, primarySelection } = this.data;
    if (!gameState || !gameState.actionMode) return;

    const mode = gameState.actionMode;
    const myState = playerStates[openId];
    if (!myState) return;

    wx.showLoading({ title: "执行行动...", mask: true });

    let updates = {};
    let logMsg = "";

    try {
      switch (mode) {
        case 'RACCOON': {
          // 浣熊效果：选择手牌放入洞穴，并摸取相同数量
          const selectedCards = myState.hand.filter(c => c.selected);
          if (selectedCards.length === 0) {
            wx.showToast({ title: "请先选择手牌", icon: "none" });
            return;
          }

          const newHand = myState.hand.filter(c => !c.selected);
          const newCave = [...(myState.cave || []), ...selectedCards.map(c => ({ ...c, selected: false }))];

          // 记录摸牌数量
          const drawCount = selectedCards.length;

          updates = {
            [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(newHand),
            [`gameState.playerStates.${openId}.cave`]: DbHelper.cleanHand(newCave), // cave 也可以用 cleanHand 处理
          };

          // 标记需要摸牌
          this.pendingDrawCount = drawCount;
          logMsg = `完成了浣熊行动：${selectedCards.length}张进洞穴，将摸${drawCount}张牌`;
          break;
        }

        case 'BEAR': {
          // 棕熊效果：将空地所有卡牌放入洞穴
          const clearingCards = [...(this.data.clearing || [])];
          if (clearingCards.length === 0) {
            // 空地没牌，直接跳过
          } else {
            const newCave = [...(myState.cave || []), ...clearingCards.map(c => ({ ...c, selected: false }))];
            updates = {
              [`gameState.clearing`]: [],
              [`gameState.playerStates.${openId}.cave`]: DbHelper.cleanHand(newCave),
            };
            logMsg = `完成了棕熊行动：${clearingCards.length}张牌进洞穴`;
          }
          break;
        }

        case 'PICK_FROM_CLEARING': {
          // 欧洲野猫：从空地选一张牌进洞穴
          const { selectedClearingIdx, clearing } = this.data;
          if (selectedClearingIdx < 0) {
            wx.showToast({ title: "请先选择空地牌", icon: "none" });
            return;
          }

          const card = clearing[selectedClearingIdx];
          const newClearing = clearing.filter((_, idx) => idx !== selectedClearingIdx);
          const newCave = [...(myState.cave || []), { ...card, selected: false }];

          updates = {
            [`gameState.clearing`]: DbHelper.cleanClearing(newClearing),
            [`gameState.playerStates.${openId}.cave`]: DbHelper.cleanHand(newCave),
          };
          logMsg = `完成了欧洲野猫行动：从空地拿走 ${card.name} 放入洞穴`;
          break;
        }

        case 'CLEARING_TO_CAVE': {
          // 蜂群效果：将符合条件的空地牌放入洞穴 (树、灌木、植物)
          const config = (gameState.pendingActions || [])[0];
          const tags = config?.tags || [];

          const clearingCards = this.data.clearing || [];
          const toCave = clearingCards.filter(c => {
            if (c.type === CARD_TYPES.TREE) return true;
            if (c.tags && c.tags.some(t => tags.includes(t))) return true;
            return false;
          });

          if (toCave.length === 0) {
            // 没有符合条件的
          } else {
            const newClearing = clearingCards.filter(c => !toCave.includes(c));
            const newCave = [...(myState.cave || []), ...toCave.map(c => ({ ...c, selected: false }))];
            updates = {
              [`gameState.clearing`]: DbHelper.cleanClearing(newClearing),
              [`gameState.playerStates.${openId}.cave`]: DbHelper.cleanHand(newCave),
            };
            logMsg = `完成了蜂群行动：${toCave.length}张符合条件的牌进洞穴`;
          }
          break;
        }

        case 'PLAY_SAPLINGS': {
          // 水田鼠模式：打出树苗的过程已经在 onConfirmPlay 中完成了物理移动
          // 这里确认只是为了统一日志。
          logMsg = `完成了水田鼠行动：打出了多棵树苗`;
          break;
        }

        case 'PICK_FROM_CLEARING_TO_HAND': {
          // 大蚊：从空地选卡进手牌 (Bonus)
          const { selectedClearingIdx, clearing } = this.data;
          if (selectedClearingIdx < 0) {
            wx.showToast({ title: "请选择空地牌", icon: "none" });
            return;
          }
          const card = clearing[selectedClearingIdx];
          if (myState.hand.length >= 10) {
            wx.showToast({ title: "手牌已满", icon: "none" });
            return;
          }
          const newHand = [...myState.hand, { ...card, selected: false }];
          const newClearing = clearing.filter((_, idx) => idx !== selectedClearingIdx);
          updates = {
            [`gameState.clearing`]: DbHelper.cleanClearing(newClearing),
            [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(newHand)
          };
          logMsg = `奖励：从空地拿走 ${card.name} 放入手牌`;
          break;
        }

        default:
          // 其他模式（如 MOLE, FREE_PLAY_BAT）是通过连续打牌完成的
          logMsg = `完成了特殊行动: ${mode}`;
          break;
      }

      // 执行状态清理和最终结算
      await this.finalizeAction(updates, logMsg);

    } catch (e) {
      console.error(e);
      wx.hideLoading();
    }
  },

  /**
   * 结束特殊行动模式，执行累积奖励并可能切换回合
   * @param {Object} actionUpdates - 本次行动产生的状态更新
   * @param {String} logMsg - 日志
   */
  async finalizeAction(actionUpdates = {}, logMsg = "") {
    const { gameState, openId, playerStates } = this.data;
    const myState = playerStates[openId];

    const updates = { ...actionUpdates };

    // 1. 清理特殊行动状态
    updates['gameState.actionMode'] = null;
    updates['gameState.actionText'] = null;
    updates['gameState.pendingActions'] = [];

    // 2. 处理累积奖励 (drawCount, extraTurn)
    const rewards = gameState.accumulatedRewards || { drawCount: 0, extraTurn: false };
    const baseDraw = rewards.drawCount || 0;
    const pendingDraw = this.pendingDrawCount || 0;
    const totalDraw = baseDraw + pendingDraw;
    this.pendingDrawCount = 0; // 重置

    let newHand = actionUpdates[`gameState.playerStates.${openId}.hand`] ?
      [...actionUpdates[`gameState.playerStates.${openId}.hand`]] :
      [...(myState.hand || [])];

    let newDeck = [...this.data.deck];
    const currentSize = newHand.length;
    const maxCanDraw = 10 - currentSize;
    const actualDraw = Math.min(totalDraw, maxCanDraw);

    for (let i = 0; i < actualDraw; i++) {
      if (newDeck.length > 0) newHand.push(newDeck.shift());
    }

    updates[`gameState.playerStates.${openId}.hand`] = DbHelper.cleanHand(newHand);
    updates[`gameState.deck`] = newDeck;

    // 3. 决定是否结束回合
    // 如果没有额外回合奖励，则切换玩家
    if (!rewards.extraTurn) {
      const turnOrder = gameState.turnOrder || [];
      const curIdx = turnOrder.indexOf(openId);
      const nextIdx = (curIdx + 1) % turnOrder.length;
      updates['gameState.activePlayer'] = turnOrder[nextIdx];
      updates["gameState.turnReason"] = "normal";
      updates["gameState.turnCount"] = db.command.inc(1);
      updates["gameState.turnAction"] = { drawnCount: 0, takenCount: 0 };
    } else {
      // 有额外回合，继续是当前玩家
      updates["gameState.turnAction"] = { drawnCount: 0, takenCount: 0 };
    }

    // 4. 重置累积奖励数据
    updates['gameState.accumulatedRewards'] = { drawCount: 0, extraTurn: false };

    await this.submitGameUpdate(updates, "行动完成", logMsg);
  },

  async submitGameUpdate(updates, successMsg, logMsg) {
    if (logMsg) updates["gameState.logs"] = db.command.push({ operator: this.data.openId, action: logMsg, timestamp: Date.now() });

    // [Optimistic Update] 提前捕获 nextTurnAction，用于本地立即更新指引
    const nextTurnAction = updates['gameState.turnAction'];

    // --- 性能优化：本地立即触发动画，不再等待轮询 ---
    const localLastEvent = updates['gameState.lastEvent'];
    const localDeckReveal = updates['gameState.deckRevealEvent'];
    const localRewardDraw = updates['gameState.rewardDrawEvent'];
    let nextLastEventTime = this.data.lastEventTime || 0;
    let added = false;

    // 顺序决定显示的先后：奖励抽牌 -> 动作事件 -> 翻开事件
    if (localRewardDraw) {
      this.addToEventQueue(localRewardDraw);
      nextLastEventTime = Math.max(nextLastEventTime, localRewardDraw.timestamp);
      added = true;
    }
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

    // Fix: 使用 db.command.set 避免对象更新时的自动扁平化导致的 "Cannot create field ... in element null" 错误
    const _ = db.command;
    ['gameState.lastEvent', 'gameState.deckRevealEvent', 'gameState.rewardDrawEvent', 'gameState.turnAction'].forEach(key => {
      if (updates[key] !== undefined) {
        updates[key] = _.set(updates[key]);
      }
    });

    try {
      await db.collection("rooms").doc(this.data.roomId).update({ data: updates });
      wx.hideLoading();

      // 彻底清空手牌的选择状态
      const { openId, playerStates } = this.data;
      if (playerStates[openId] && playerStates[openId].hand) {
        playerStates[openId].hand.forEach(c => c.selected = false);
      }

      // 准备本地更新的数据
      const nextLocalData = {
        selectedClearingIdx: -1,
        primarySelection: null,
        selectedSlot: null,
        [`playerStates.${openId}.hand`]: playerStates[openId].hand || []
      };

      // 如果有 TurnAction 更新，立即应用到本地，并重算指引
      if (nextTurnAction) {
        nextLocalData.turnAction = nextTurnAction;
      }

      // 基于预测的本地状态计算指引文案
      const simulationData = { ...this.data, ...nextLocalData };
      const { instructionState, instructionText } = Utils.computeInstruction(simulationData);

      this.setData({
        ...nextLocalData,
        instructionState,
        instructionText
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
