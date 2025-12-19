const Utils = require("../../utils/utils");
const { calculateReward, calculateTriggerEffects } = require("../../utils/reward.js");
const RoundUtils = require("../../utils/round.js");
const DbHelper = require("../../utils/dbHelper.js");
const SpecialActionUtils = require("../../utils/specialAction.js");
const ClearingUtils = require("../../utils/clearing.js");
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

  onShow() {
    this.initGameWatcher();
  },
  onHide() {
    this.stopWatcher();
  },
  onUnload() {
    this.stopWatcher();
  },

  /**
   * 初始化游戏数据实时监听
   * 使用微信云数据库的 watch API 实现实时推送
   */
  initGameWatcher() {
    if (this.gameWatcher) return; // 避免重复监听
    if (!this.data.roomId) return;

    console.log("🔔 开始实时监听游戏数据:", this.data.roomId);

    const db = wx.cloud.database();
    this.gameWatcher = db
      .collection("rooms")
      .doc(this.data.roomId)
      .watch({
        onChange: (snapshot) => {
          console.log("📡 收到实时推送:", snapshot);

          // 房间被删除
          if (!snapshot.docs || snapshot.docs.length === 0) {
            wx.showToast({ title: "房间已解散", icon: "none" });
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
            return;
          }

          const serverData = snapshot.docs[0];

          // 房间被关闭
          if (serverData.status === "closed") {
            wx.showToast({ title: "房间已关闭", icon: "none" });
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
            return;
          }

          // 处理游戏数据更新
          this.processGameUpdate(serverData);
        },
        onError: (err) => {
          console.error("❌ 实时监听错误:", err);

          // 尝试重新连接
          this.stopWatcher();

          wx.showToast({
            title: "连接断开,正在重连...",
            icon: "none",
            duration: 2000
          });

          // 3秒后尝试重新建立连接
          setTimeout(() => {
            console.log("🔄 尝试重新连接...");
            this.initGameWatcher();
          }, 3000);
        },
      });
  },

  /**
   * 停止实时监听
   */
  stopWatcher() {
    if (this.gameWatcher) {
      console.log("🔕 停止实时监听");
      this.gameWatcher.close();
      this.gameWatcher = null;
    }
  },



  /**
   * 处理游戏数据更新
   * 处理实时推送获取的数据
   * @param {Object} serverData - 服务器数据
   */
  processGameUpdate(serverData) {
    try {
      const gameState = serverData.gameState || {};
      const processedData = Utils.processGameData({ data: serverData }, this.data);

      const currentActive = gameState.activePlayer || serverData.activePlayer;
      const currentTurnCount = gameState.turnCount || 0;
      const lastTurnCount = typeof this.data.lastTurnCount === "number" ? this.data.lastTurnCount : -1;

      // 1. 回合切换逻辑 (标记待提示)
      if (currentActive === this.data.openId && this.data.lastNotifiedTurnCount !== currentTurnCount) {
        processedData.pendingTurnToast = true;
        processedData.lastNotifiedTurnCount = currentTurnCount;
      }

      // 2. 事件队列处理 (全场大图展示)
      const lastEvent = gameState.lastEvent;
      const deckRevealEvent = gameState.deckRevealEvent;
      const rewardDrawEvent = gameState.rewardDrawEvent;
      const extraTurnEvent = gameState.extraTurnEvent;

      let nextLastEventTime = this.data.lastEventTime || 0;
      let added = false;

      // 辅助函数：尝试添加事件
      const tryAddEvent = (evt) => {
        if (evt && evt.timestamp > nextLastEventTime) {
          this.addToEventQueue(evt);
          nextLastEventTime = Math.max(nextLastEventTime, evt.timestamp);
          added = true;
        }
      };

      // 按逻辑顺序添加事件
      tryAddEvent(lastEvent);
      tryAddEvent(deckRevealEvent);
      tryAddEvent(rewardDrawEvent);
      tryAddEvent(extraTurnEvent);

      processedData.lastEventTime = nextLastEventTime;

      // 3. 空地滚动处理
      const targetScrollId = ClearingUtils.getScrollTarget(this.data.clearing, processedData.clearing);
      this.setData(processedData, () => {
        if (targetScrollId) {
          ClearingUtils.executeScroll(this, targetScrollId);
        }
        if (added || processedData.pendingTurnToast) this.processNextEvent();
      });
    } catch (e) {
      console.error("处理游戏更新失败:", e);
    }
  },



  addToEventQueue(event) {
    this.setData({ eventQueue: [...this.data.eventQueue, event] });
  },

  // 4. 事件处理
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

  onStackTap(e) {
    const { treeid, side } = e.currentTarget.dataset;
    const myForest = this.data.playerStates[this.data.openId].forest;
    const tree = myForest.find(t => t._id === treeid);
    if (!tree) return;

    const slotCard = tree.slots[side];
    if (!slotCard) return;
    console.log(slotCard.stackedCards);
    this.setData({
      stackModalVisible: true,
      stackModalCards: slotCard.stackedCards
    });
  },

  closeStackModal() {
    this.setData({ stackModalVisible: false });
  },

  onSlotTap(e) {
    const { treeid, side } = e.currentTarget.dataset;
    const { selectedSlot, primarySelection } = this.data;

    // 1. 处理取消选中 (点击已选中的槽位)
    if (selectedSlot?.treeId === treeid && selectedSlot?.side === side) {
      const nextData = { ...this.data, selectedSlot: null };
      const res = Utils.computeInstruction(nextData);
      this.setData({
        selectedSlot: null,
        instructionState: res.instructionState,
        instructionText: res.instructionText,
        instructionSegments: res.instructionSegments || null,
        instructionLines: res.instructionLines || null
      });
      return;
    }

    // 2. 准备新槽位
    const nextSlot = { treeId: treeid, side, isValid: true };

    // 3. 验证槽位可用性
    if (primarySelection) {
      // 已选牌：使用 instructionHelper 验证规则
      const nextData = { ...this.data, selectedSlot: nextSlot };
      const res = Utils.computeInstruction(nextData);

      if (res.instructionState === 'error') {
        wx.showToast({ title: res.instructionText || "无法放置在此处", icon: "none" });
        return;
      }

      this.setData({
        selectedSlot: nextSlot,
        instructionState: res.instructionState,
        instructionText: res.instructionText,
        instructionSegments: res.instructionSegments || null,
        instructionLines: res.instructionLines || null
      });
    } else {
      // 未选牌：使用槽位状态严格验证 (占用/满载)
      const myState = this.data.playerStates[this.data.openId];
      if (myState && myState.forest) {
        const tree = myState.forest.find(t => t._id === treeid);
        if (tree && tree.slots && tree.slots[side]) {
          const slotCard = tree.slots[side];
          if (slotCard) {
            const ec = slotCard.effectConfig;
            const hasSlotConfig = !!slotCard.slotConfig;
            const isUnlimited = ec && ec.type === 'CAPACITY_UNLIMITED';
            const isIncrease = ec && ec.type === 'CAPACITY_INCREASE';

            // 既无 slotConfig (来自刺荨麻/已转换)，也无 effectConfig (来自自身)，则视为普通占用
            if (!hasSlotConfig && !isUnlimited && !isIncrease) {
              return;
            }

            // 检查容量
            const currentCount = slotCard.stackedCards ? slotCard.stackedCards.length : 1;

            if (hasSlotConfig) {
              const cap = slotCard.slotConfig.capacity || 0;
              if (currentCount >= cap) {
                wx.showToast({ title: "该插槽堆叠已满", icon: "none" });
                return;
              }
            } else if (isIncrease) {
              const val = ec.value || 1;
              if (currentCount >= val) {
                wx.showToast({ title: "该插槽堆叠已满", icon: "none" });
                return;
              }
            }
          }
        }
      }

      // 验证通过，允许选中
      const nextData = { ...this.data, selectedSlot: nextSlot };
      const res = Utils.computeInstruction(nextData);
      this.setData({
        selectedSlot: nextSlot,
        instructionState: res.instructionState,
        instructionText: res.instructionText,
        instructionSegments: res.instructionSegments || null,
        instructionLines: res.instructionLines || null
      });
    }
  },

  // source: 'PLAYER_ACTION' | 'MOLE_EFFECT' | 'FREE_PLAY' | ...
  // 注意：当从 wxml 调用时，第一个参数是事件对象 e
  async onConfirmPlay(e) {
    // 判断是事件对象还是 source 字符串
    const source = (typeof e === 'string') ? e : 'PLAYER_ACTION';

    const { gameState, primarySelection, playerStates, openId, clearing, selectedSlot, instructionState, turnAction } = this.data;

    // Handle Tuck Action (Common Toad)
    if (gameState && gameState.actionMode === 'ACTION_TUCK_HAND_CARD') {
      const myHand = playerStates[openId].hand || [];
      const selected = myHand.filter(c => c.selected);
      if (selected.length !== 1) {
        wx.showToast({ title: "请选择一张手牌", icon: "none" });
        return;
      }

      const cardToTuck = selected[0];
      const newHand = myHand.filter(c => c.uid !== cardToTuck.uid);
      const forest = [...(playerStates[openId].forest || [])];

      // Find the Toad (should be the last played card, or passed via context)
      // Relying on lastEvent might be risky if multiple events happened.
      // Better: Find the Toad that has empty stackedCards?
      // Or check lastEvent.
      let toadUid = gameState.lastEvent?.mainCard?.uid;
      // Search in forest
      let foundToad = false;

      for (let i = 0; i < forest.length; i++) {
        let group = forest[i];
        // Check slots
        if (group.slots) {
          const slots = Object.values(group.slots);
          const toad = slots.find(s => s && s.uid === toadUid);
          if (toad) {
            // Determine which slot key
            const key = Object.keys(group.slots).find(k => group.slots[k] && group.slots[k].uid === toadUid);
            // We need to modify the group deeply
            const newGroup = { ...group, slots: { ...group.slots } };
            const newToad = { ...newGroup.slots[key] };
            newToad.stackedCards = newToad.stackedCards || [];
            newToad.stackedCards.push(cardToTuck);
            newGroup.slots[key] = newToad;
            forest[i] = newGroup;
            foundToad = true;
            break;
          }
        }
      }

      if (!foundToad) {
        // Fallback scan: maybe lastEvent is missing?
        // Find any Common Toad that triggered recently?
        // For now, if not found, just discard the card (assume tucked virtually?)
        // But user expects points.
        console.error("Toad not found for tucking");
      }

      // Finish action
      const updates = {
        [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(newHand),
        [`gameState.playerStates.${openId}.forest`]: DbHelper.cleanForest(forest),
      };

      const remaining = (gameState.pendingActions || []).slice(1);
      if (remaining.length > 0) {
        updates[`gameState.pendingActions`] = remaining;
        updates[`gameState.actionMode`] = remaining[0].type;
        this.submitGameUpdate(updates, "特殊行动", `将 ${cardToTuck.name} 叠放在大蟾蜍下`);
      } else {
        updates[`gameState.pendingActions`] = [];
        updates[`gameState.actionMode`] = null;
        updates[`gameState.actionText`] = null;
        await this.finalizeAction(updates, `将 ${cardToTuck.name} 叠放在大蟾蜍下`);
      }
      return;
    }

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
    if (gameState.actionMode === 'ACTION_PLAY_SAPLINGS') {
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

      const existingCard = tTree.slots[selectedSlot.side];

      // 检查是否有共享槽位效果 (如刺荨麻)
      const allSlots = Object.values(tTree.slots || {});
      const enabler = allSlots.find(c => c && c.effectConfig && c.effectConfig.type === 'CAPACITY_SHARE_SLOT');
      const isStackMode = enabler && enabler.effectConfig.tag && primaryCard.tags && primaryCard.tags.includes(enabler.effectConfig.tag);

      if (existingCard) {
        // 槽位已有卡片
        if (isStackMode || existingCard.slotConfig) {
          // 堆叠模式: 所有卡片都在stackedCards中,插槽显示最后一张
          const newStackedCards = [...(existingCard.stackedCards || [])];
          // 将新卡片添加到堆叠数组
          newStackedCards.push(primaryCard);

          // 插槽显示最后一张卡片(即刚插入的卡片)
          tTree.slots[selectedSlot.side] = {
            ...primaryCard,
            stackedCards: newStackedCards, // 包含所有卡片
            slotConfig: {
              accepts: { tags: [enabler.effectConfig.tag] },
              capacity: 99
            }
          };
        } else {
          // 非堆叠模式,正常堆叠(如大蟾蜍)
          const newExistingCard = { ...existingCard };
          newExistingCard.stackedCards = [...(existingCard.stackedCards || [])];
          newExistingCard.stackedCards.push(primaryCard);
          tTree.slots[selectedSlot.side] = newExistingCard;
        }
      } else {
        // 槽位为空
        if (isStackMode) {
          // 第一张卡片,处于堆叠模式环境
          tTree.slots[selectedSlot.side] = {
            ...primaryCard,
            stackedCards: [primaryCard], // 第一张卡片也要放进堆里
            slotConfig: {
              accepts: { tags: [enabler.effectConfig.tag] },
              capacity: 99
            }
          };
        } else {
          // 正常放置
          tTree.slots[selectedSlot.side] = primaryCard;
        }
      }

      // 重要: 如果刚打出的卡片有 CAPACITY_SHARE_SLOT 效果(如刺荨麻)
      // 需要将同树其他槽位中符合条件的卡片转换为堆叠模式
      if (primaryCard.effectConfig && primaryCard.effectConfig.type === 'CAPACITY_SHARE_SLOT') {
        const targetTag = primaryCard.effectConfig.tag;
        const slotsToConvert = ['top', 'bottom', 'left', 'right'];

        slotsToConvert.forEach(side => {
          if (side !== selectedSlot.side && tTree.slots[side]) {
            const card = tTree.slots[side];
            // 检查该卡片是否符合标签要求,且还没有堆叠配置
            if (card.tags && card.tags.includes(targetTag) && !card.slotConfig) {
              // 转换为堆叠模式:将原卡片放入堆叠数组
              tTree.slots[side] = {
                ...card,
                stackedCards: [card], // 原卡片也要放进堆里
                slotConfig: {
                  accepts: { tags: [targetTag] },
                  capacity: 99
                }
              };
            }
          }
        });
      }

      forest[tIdx] = tTree;
    }

    // 根据打牌来源决定是否计算 Bonus 和 Effect
    // 效果触发的打牌不会触发该卡片自身的 Bonus 和 Effect
    let bonus = { drawCount: 0, extraTurn: false, actions: [] };
    let effect = { drawCount: 0, extraTurn: false, actions: [] };

    const isSpecialPlayMode = ['ACTION_MOLE', 'ACTION_PLAY_SAPLINGS', 'PLAY_FREE'].includes(gameState.actionMode);

    if (source === 'PLAYER_ACTION') {
      // 在特殊模式下打牌，不重新触发该牌自身的 Bonus 和 Effect (防止无限循环)
      if (!isSpecialPlayMode) {
        console.log('奖励计算中....')
        // bonus: 需要颜色匹配 (isBonus = true)
        bonus = calculateReward(primaryCard, selectedSlot, paymentCards, {}, true);
        // effect: 不需要颜色匹配 (isBonus = false)
        effect = calculateReward(primaryCard, null, paymentCards, { forest }, false);
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
      // 1. 基础更新：手牌、森林、空地、事件
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
      if (reward.extraTurn) updates[`gameState.accumulatedRewards.extraTurn`] = true;

      // 2. 处理 Pending Actions (移除当前执行的，添加新产生的)
      const currentPending = [...(gameState.pendingActions || [])];

      const executingAction = currentPending[0];
      // 如果是“免费打出蝙蝠”这种可以无限打直到用户跳过的模式，则不移除当前Action
      // 只有当用户显式点击“跳过”时（onEndTurn逻辑），才移除
      if (executingAction && !executingAction.isInfinite) {
        currentPending.shift(); // 移除当前已完成的行动
      }

      // 将新产生的行动加到末尾（如果有）
      const nextPending = [...currentPending, ...reward.actions];

      if (nextPending.length > 0) {
        // 还有后续行动，更新状态继续
        const nextAction = nextPending[0];
        const nextMode = nextAction ? nextAction.type : null;
        updates[`gameState.pendingActions`] = nextPending;
        updates[`gameState.actionMode`] = nextMode;
        updates[`gameState.actionText`] = null; // 重置文案，让 helper 重新生成

        wx.hideLoading();
        this.submitGameUpdate(updates, "出牌成功", `(特殊模式) 打出了 ${primaryCard.name}`);
      } else {
        // 没有后续行动了，执行最终结算
        // 注意：finalizeAction 会处理 actionMode=null, pending=[], 以及 accumulatedRewards 的结算
        wx.hideLoading();
        await this.finalizeAction(updates, `(特殊模式) 打出了 ${primaryCard.name}`);
      }
      return;
    }

    // 检查是否有待处理的特殊行动
    if (reward.actions && reward.actions.length > 0) {
      // 支付费用卡放入空地 (这是前提，因为自动效果可能要吸走这些费用卡)
      paymentCards.forEach(c => newClearing.push({ ...c, selected: false }));

      const firstAction = reward.actions[0];
      const actionMode = firstAction ? firstAction.type : 'SPECIAL_ACTION';
      const actionText = bonus.text || effect.text || "特殊行动中...";

      // 如果是全自动行动，直接执行并提交


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

    const drawnCards = []; // 记录抽到的卡片
    for (let i = 0; i < actualDraw; i++) {
      if (newDeck.length > 0) {
        const card = newDeck.shift();
        newHand.push(card);
        drawnCards.push(card);
      }
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
        drawnCards: drawnCards.map(c => Utils.enrichCard(c)), // 添加抽到的卡片信息
        timestamp: Date.now() - 50 // 确保在 PLAY_CARD 之前或紧随其后
      };
    }

    // 额外回合事件
    let extraTurnEvent = null;
    if (reward.extraTurn) {
      extraTurnEvent = {
        type: 'EXTRA_TURN',
        playerOpenId: openId,
        playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
        playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
        timestamp: Date.now() + 50
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
      [`gameState.rewardDrawEvent`]: rewardDrawEvent,
      [`gameState.extraTurnEvent`]: extraTurnEvent
    };

    this.submitGameUpdate(updates, "出牌成功", `打出了 ${primaryCard.name}`);
  },

  onDrawCard() {
    const nextIdx = this.data.selectedClearingIdx === -2 ? -1 : -2;
    this.setData({
      selectedClearingIdx: nextIdx
    });
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
    // 1. 特殊行动模式下的跳过逻辑
    if (this.data.gameState && this.data.gameState.actionMode) {
      wx.showModal({
        title: '跳过行动',
        content: '确定要跳过吗？',
        success: async (res) => {
          if (res.confirm) {
            const updates = {};
            const pending = [...(this.data.gameState.pendingActions || [])];
            // 移除当前行动（头部）
            pending.shift();

            if (pending.length > 0) {
              // 还有后续行动，更新状态
              const nextAction = pending[0];
              const nextMode = nextAction ? nextAction.type : null;
              updates['gameState.pendingActions'] = pending;
              updates['gameState.actionMode'] = nextMode;
              // 提示更新
              updates['gameState.actionText'] = null; // 让前端 instructionHelper 去生成新的提示
              this.submitGameUpdate(updates, "跳过行动", "跳过了当前特殊行动步骤");
            } else {
              // 没有后续，结束特殊行动模式
              await this.finalizeAction({}, "跳过了行动");
            }
          }
        }
      });
      return;
    }

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
      // 构建上下文
      const context = {
        gameState: gameState,
        playerState: myState,
        clearing: this.data.clearing,
        selectedClearingIdx: this.data.selectedClearingIdx,
        openId: openId,
        actionConfig: (gameState.pendingActions || [])[0]
      };

      // 调用工具类处理逻辑
      const actionResult = SpecialActionUtils.handleAction(mode, context);

      if (!actionResult.success) {
        wx.showToast({ title: actionResult.errorMsg, icon: "none" });
        wx.hideLoading();
        return;
      }

      updates = actionResult.updates || {};
      logMsg = actionResult.logMsg;
      if (actionResult.drawCount > 0) {
        this.pendingDrawCount = actionResult.drawCount;
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

    // 创建奖励抽牌事件
    let rewardDrawEvent = null;
    if (actualDraw > 0) {
      rewardDrawEvent = {
        type: 'REWARD_DRAW',
        playerOpenId: openId,
        playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
        playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
        count: actualDraw,
        timestamp: Date.now()
      };
    }
    updates['gameState.rewardDrawEvent'] = rewardDrawEvent;

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
    const localExtraTurn = updates['gameState.extraTurnEvent'];
    let nextLastEventTime = this.data.lastEventTime || 0;
    let added = false;

    // 顺序决定显示的先后：打出卡片 -> 奖励抽牌 -> 空地翻牌
    if (localLastEvent) {
      this.addToEventQueue(localLastEvent);
      nextLastEventTime = Math.max(nextLastEventTime, localLastEvent.timestamp);
      added = true;
    }
    if (localRewardDraw) {
      this.addToEventQueue(localRewardDraw);
      nextLastEventTime = Math.max(nextLastEventTime, localRewardDraw.timestamp);
      added = true;
    }
    if (localDeckReveal) {
      this.addToEventQueue(localDeckReveal);
      nextLastEventTime = Math.max(nextLastEventTime, localDeckReveal.timestamp);
      added = true;
    }
    if (localExtraTurn) {
      this.addToEventQueue(localExtraTurn);
      nextLastEventTime = Math.max(nextLastEventTime, localExtraTurn.timestamp);
      added = true;
    }

    if (added) {
      this.setData({ lastEventTime: nextLastEventTime });
      this.processNextEvent();
    }
    // ------------------------------------------

    // Fix: 使用 db.command.set 避免对象更新时的自动扁平化导致的 "Cannot create field ... in element null" 错误
    const _ = db.command;
    ['gameState.lastEvent', 'gameState.deckRevealEvent', 'gameState.rewardDrawEvent', 'gameState.extraTurnEvent', 'gameState.turnAction'].forEach(key => {
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
    const { primarySelection } = this.data;
    if (!primarySelection) {
      wx.showToast({ title: "请先选择一张手牌作为树苗", icon: "none" });
      return;
    }

    wx.showModal({
      title: '打出树苗',
      content: '将选中的手牌作为树苗打出？',
      success: (res) => {
        if (res.confirm) this.executePlaySapling();
      }
    });
  },

  async executePlaySapling() {
    wx.showLoading({ title: "种植中..." });
    const { SAPLING_DATA } = require("../../data/speciesData");
    const { playerStates, openId, clearing, deck, primarySelection } = this.data;

    const myState = playerStates[openId];
    const newHand = [...(myState.hand || [])];

    // 1. 找到并移除选中的手牌
    const cardIdx = newHand.findIndex(c => c.uid === primarySelection);
    if (cardIdx === -1) {
      wx.hideLoading();
      return;
    }
    const originalCard = newHand[cardIdx];
    newHand.splice(cardIdx, 1);

    const forest = [...(myState.forest || [])];
    const newClearing = [...(clearing || [])];
    const newDeck = [...(deck || [])];

    // 2. 将该卡转化为树苗放入森林
    // 保留原始卡的ID记录，但在视觉和逻辑上它现在是一棵树苗
    const saplingCard = {
      ...SAPLING_DATA,
      uid: originalCard.uid, // 保持 uid 为了追踪？或者用新 uid 也可以，这里保持 uid 比较好
      id: 'sapling',         // 逻辑 ID 必须是 sapling，用于识别属性
      originalId: originalCard.id // 记录原始 ID (可选)
    };
    const enriched = Utils.enrichCard(saplingCard);

    forest.push({
      _id: Math.random().toString(36).substr(2, 9),
      center: enriched,
      slots: { top: null, bottom: null, left: null, right: null }
    });

    // 3. 计算场上效果触发 (如鸡油菌：打出树木时抽牌)
    // 树苗被视为树木 (type: TREE)，且是新打出的
    const { calculateTriggerEffects } = require("../../utils/reward.js");
    const triggers = calculateTriggerEffects(forest, enriched, { slot: null });

    const reward = {
      drawCount: triggers.drawCount || 0,
      extraTurn: triggers.extraTurn || false,
      actions: triggers.actions || []
      // 树苗通常不会有 actions，除非特殊的被动效果赋予
    };

    // 4. 处理奖励抽牌
    let drawnCards = [];
    if (reward.drawCount > 0) {
      const currentSize = newHand.length;
      const maxCanDraw = 10 - currentSize;
      const actualDraw = Math.min(reward.drawCount, maxCanDraw);

      for (let i = 0; i < actualDraw; i++) {
        if (newDeck.length > 0) {
          const card = newDeck.shift();
          newHand.push(card);
          drawnCards.push(Utils.enrichCard(card));
        }
      }
    }

    // 5. 翻牌逻辑 (打出牌后通常需要从牌堆翻一张到空地)
    let deckRevealEvent = null;
    // ... (现有逻辑)
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

    // 6. 构造事件
    let rewardDrawEvent = null;
    if (drawnCards.length > 0) {
      rewardDrawEvent = {
        type: 'REWARD_DRAW',
        playerOpenId: openId,
        playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
        playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
        count: drawnCards.length,
        drawnCards: drawnCards,
        timestamp: Date.now() - 50
      };
    }

    let extraTurnEvent = null;
    if (reward.extraTurn) {
      extraTurnEvent = {
        type: 'EXTRA_TURN',
        playerOpenId: openId,
        playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
        playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
        timestamp: Date.now() + 50
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
        mainCard: enriched, subCards: [], timestamp: Date.now()
      },
      [`gameState.deckRevealEvent`]: deckRevealEvent,
      [`gameState.rewardDrawEvent`]: rewardDrawEvent,
      [`gameState.extraTurnEvent`]: extraTurnEvent
    };

    this.submitGameUpdate(updates, "种植成功", "将一张手牌作为树苗打出");
  },

  onClearingCardTap(e) {
    const idx = e.currentTarget.dataset.idx;
    this.setData({ selectedClearingIdx: this.data.selectedClearingIdx === idx ? -1 : idx });
  }
});
