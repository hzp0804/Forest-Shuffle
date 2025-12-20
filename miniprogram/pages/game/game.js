const Utils = require("../../utils/utils");
const { calculateReward, calculateTriggerEffects } = require("../../utils/reward.js");
const { validatePlay } = require("../../utils/validate.js");
const RoundUtils = require("../../utils/round.js");
const DbHelper = require("../../utils/dbHelper.js");
const SpecialActionUtils = require("../../utils/specialAction.js");
const ClearingUtils = require("../../utils/clearing.js");
const { CARDS_DATA } = require("../../data/cardData.js");
const { SPECIES_DATA } = require("../../data/speciesData.js");
const { getCardInfoById } = require("../../utils/getCardInfoById");
const { DECK_TYPES, CARD_TYPES } = require("../../data/constants");
const db = wx.cloud.database();

/**
 * 构造清空空地的系统通知
 */
const createClearingNotification = () => ({
  type: 'NOTIFICATION',
  // 无玩家信息 (系统播报)
  icon: '🧹',
  message: '清空了空地！',
  timestamp: Date.now() + 100
});

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
    cheatVisible: false,
    cheatSections: [],
    allCheatSections: [],
    cheatSearchQuery: "",
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

    // 清空得分缓存,确保进入新房间时数据是干净的
    const { scoreCache } = require("../../utils/score/helpers");
    scoreCache.clear();
    console.log("🧹 进入房间,已清空得分缓存");
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

    // 清空事件队列,防止退出后还触发动画和提示
    this.setData({
      eventQueue: [],
      isProcessingEvent: false,
      currentEvent: null,
      pendingTurnToast: false,
      pendingActionToast: null
    });

    // 清空得分缓存,防止进入其他房间时带入旧数据
    const { scoreCache } = require("../../utils/score/helpers");
    scoreCache.clear();
    console.log("🧹 已清空得分缓存");
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

      // 检测回合是否切换（activePlayer 变动或 turnCount 变动）
      const turnChanged = currentActive !== this.data.lastActivePlayer || currentTurnCount !== lastTurnCount;

      // 1. 回合切换逻辑 (标记待提示 + 重置选择状态 + 初始化翻牌计数器)
      if (turnChanged) {
        // 回合切换时，重置选择状态
        processedData.primarySelection = null;
        processedData.selectedSlot = null;
        processedData.lastActivePlayer = currentActive;
        // 初始化翻牌计数器为 0（新回合开始）
        this.pendingRevealCount = 0;
        console.log('🔄 回合切换，翻牌计数器已重置为 0');
        processedData.lastTurnCount = currentTurnCount;
      }

      if (currentActive === this.data.openId && this.data.lastNotifiedTurnCount !== currentTurnCount) {
        processedData.pendingTurnToast = true;
        processedData.lastNotifiedTurnCount = currentTurnCount;
      }

      // 2. 事件队列处理 (全场大图展示)
      const lastEvent = gameState.lastEvent;
      const deckRevealEvent = gameState.deckRevealEvent;
      const rewardDrawEvent = gameState.rewardDrawEvent;
      const extraTurnEvent = gameState.extraTurnEvent;
      const notificationEvent = gameState.notificationEvent;

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
      tryAddEvent(notificationEvent);

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
    // 安全检查: 如果监听器已关闭(页面已卸载),不再处理事件
    if (!this.gameWatcher) {
      console.log("⚠️ 页面已卸载,跳过事件处理");
      return;
    }

    if (this.data.isProcessingEvent) return;

    if (this.data.eventQueue.length === 0) {
      // 特殊情况处理：虽然没有事件，但有待显示的 Toast (通常是回合切换)
      if (this.data.pendingTurnToast) {
        wx.vibrateShort({ type: 'medium' });
        wx.showToast({ title: "轮到你了！", icon: "none", duration: 1500 });
        this.setData({ pendingTurnToast: false, isProcessingEvent: false });
        return;
      }

      this.setData({ isProcessingEvent: false });

      // 队列结束，如果刚才有待提示的回合切换，现在触发
      // 注意：这里使用 data 中的最新状态，因为 processNextEvent 可能被多次调用
      if (this.data.pendingTurnToast) {
        wx.vibrateShort({ type: 'medium' });
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
    const { uid, idx, type, cardid, treeid, side } = e.currentTarget.dataset;
    let cardId = cardid;
    let cardData = null;
    let isInForest = false;
    let activeSide = null;

    // 根据来源获取卡片 ID 和完整数据
    if (type === 'clearing') {
      const clearingCard = this.data.clearing[idx];
      cardId = clearingCard?.id;
      cardData = clearingCard;
      isInForest = false;
    } else if (type === 'hand') {
      const handCard = this.data.playerStates[this.data.openId]?.hand?.find(c => c.uid === uid);
      cardId = handCard?.id;
      cardData = handCard;
      isInForest = false;
    } else if (treeid && side) {
      // 森林中的槽位卡片（通过 treeid 和 side 定位）
      const myForest = this.data.myForest;
      const tree = myForest?.find(t => t._id === treeid);
      const slotCard = tree?.slots?.[side];
      cardId = slotCard?.id;
      cardData = slotCard;
      isInForest = true;
      activeSide = side; // 记录生效的物种侧
    } else if (treeid && !side) {
      // 森林中的树木中心（只有 treeid，没有 side）
      const myForest = this.data.myForest;
      const tree = myForest?.find(t => t._id === treeid);
      const centerCard = tree?.center;
      cardId = centerCard?.id;
      cardData = centerCard;
      isInForest = true;
      activeSide = 'center'; // 树木中心
    }

    if (cardId) {
      // 只有森林中的卡片才准备游戏上下文（用于计分）
      const gameContext = isInForest ? {
        forest: this.data.playerStates[this.data.openId]?.forest || []
      } : null;

      this.setData({
        detailCardId: cardId,
        detailCardData: cardData,
        detailGameContext: gameContext,
        detailInGame: isInForest,
        detailActiveSide: activeSide
      });
    }
  },
  onCloseDetail() {
    this.setData({
      detailCardId: null,
      detailCardData: null,
      detailGameContext: null,
      detailInGame: false,
      detailActiveSide: null
    });
  },
  onCloseDrawing() { /* 不需要了，现在统一走 eventQueue */ },

  onStackTap(e) {
    const { treeid, side } = e.currentTarget.dataset;
    const myForest = this.data.playerStates[this.data.openId].forest;
    const tree = myForest.find(t => t._id === treeid);
    if (!tree) return;

    const slotCard = tree.slots[side];
    if (!slotCard) return;

    // 显示 list 中的所有卡片
    const cardsToShow = slotCard.list || [];

    this.setData({
      stackModalVisible: true,
      stackModalCards: cardsToShow
    });
  },

  closeStackModal() {
    this.setData({ stackModalVisible: false });
  },

  onSlotTap(e) {
    const { treeid, side } = e.currentTarget.dataset;
    const { selectedSlot, primarySelection, gameState } = this.data;

    // 浣熊行动模式下，不需要选择插槽
    if (gameState?.actionMode === 'ACTION_RACCOON') {
      wx.showToast({ title: "请选择手牌放入洞穴", icon: "none" });
      return;
    }

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
    // 3. 验证槽位可用性
    if (primarySelection) {
      const { playerStates, openId } = this.data;
      const myState = playerStates[openId];
      if (!myState) return;

      const hand = myState.hand || [];
      let primaryCardRaw = hand.find(c => c.uid === primarySelection);
      if (!primaryCardRaw) return;

      // 富化卡片数据以获取完整信息（包括 tags）
      const { enrichCard } = require('../../utils/utils');
      primaryCardRaw = enrichCard(primaryCardRaw);

      const cardType = (primaryCardRaw.type || '').toLowerCase();

      // A. 单物种卡不需要插槽
      if (cardType === 'tree') return;

      // B. 卡片类型与方向校验
      const isH = cardType.includes('hcard') || cardType.includes('h_card');
      const isV = cardType.includes('vcard') || cardType.includes('v_card');
      if (isH && (side !== 'left' && side !== 'right')) return;
      if (isV && (side !== 'top' && side !== 'bottom')) return;

      // C. 堆叠校验 (Capacity & Compatibility)
      // 使用 this.data.myForest (已富化数据) 以获取完整的 effectConfig 和 name
      const myForest = this.data.myForest;
      if (myForest) {
        const tree = myForest.find(t => String(t._id) === String(treeid));
        if (!tree) return;

        const existingCard = tree.slots?.[side];

        if (existingCard) {
          let allowStack = false;
          let capacity = 1;

          let checkName = primaryCardRaw.name;
          let checkTags = primaryCardRaw.tags; // 单面卡的 tags

          // 根据插槽方向获取手牌对应侧的物种名称和 tags
          if (primaryCardRaw.speciesDetails && primaryCardRaw.speciesDetails.length > 0) {
            let idx = 0;
            if (isH && side === 'right') idx = 1;
            if (isV && side === 'bottom') idx = 1;

            // Try specific index, fallback to 0 if missing (e.g. Double Hare defined as single species)
            let targetSpecies = primaryCardRaw.speciesDetails[idx];
            if (!targetSpecies) {
              targetSpecies = primaryCardRaw.speciesDetails[0];
            }

            if (targetSpecies && targetSpecies.name) {
              checkName = targetSpecies.name;
              checkTags = targetSpecies.tags; // 双面卡的 tags
            }
          }

          // 处理 "视为" 效果 (e.g. 雪兔视为欧洲野兔)
          if (primaryCardRaw.effectConfig?.type === 'TREATED_AS' && primaryCardRaw.effectConfig.target) {
            checkName = primaryCardRaw.effectConfig.target;
          }

          // (1) 同名堆叠
          if (existingCard.name === checkName) {
            if (existingCard.effectConfig?.type === 'CAPACITY_INCREASE') {
              allowStack = true;
              capacity = existingCard.effectConfig.value;
            } else if (existingCard.effectConfig?.type === 'CAPACITY_UNLIMITED') {
              allowStack = true;
              capacity = 999;
            }
          }

          // (2) 宿主堆叠 (刺荨麻等) 或有 max 字段的堆叠槽位
          if (existingCard.slotConfig || existingCard.max) {
            // 如果有 slotConfig，检查 tag 匹配
            if (existingCard.slotConfig) {
              const accepts = existingCard.slotConfig.accepts;
              if (accepts?.tags?.length > 0 && checkTags) {
                if (checkTags.some(t => accepts.tags.includes(t))) {
                  allowStack = true;
                  capacity = existingCard.slotConfig.capacity || existingCard.max || 999;
                }
              }
            } else if (existingCard.max) {
              // 如果只有 max 字段（没有 slotConfig），也允许堆叠
              // 这种情况下需要检查是否是同类型的卡片
              // 通过检查树上是否有 CAPACITY_SHARE_SLOT 效果来判断
              const myForestRaw = this.data.playerStates[this.data.openId].forest;
              const treeRaw = myForestRaw.find(t => String(t._id) === String(treeid));
              if (treeRaw && treeRaw.slots) {
                const allSlots = Object.values(treeRaw.slots);
                const enabler = allSlots.find(c => c && c.effectConfig && c.effectConfig.type === 'CAPACITY_SHARE_SLOT');
                if (enabler && enabler.effectConfig.tag && checkTags && checkTags.includes(enabler.effectConfig.tag)) {
                  allowStack = true;
                  capacity = existingCard.max;
                }
              }
            }
          }

          if (!allowStack) {
            wx.showToast({ title: "该插槽已有卡片", icon: "none" });
            return;
          }

          const currentCount = existingCard.list ? existingCard.list.length : 1;
          if (currentCount >= capacity) {
            wx.showToast({ title: "插槽已满", icon: "none" });
            return;
          }
        }
      }

      // 已选牌且需要插槽：使用 instructionHelper 验证规则
      const nextData = { ...this.data, selectedSlot: nextSlot };
      const res = Utils.computeInstruction(nextData);

      // 允许选择插槽，即使费用未满足（error 状态）
      // 只在出牌时才真正校验
      this.setData({
        selectedSlot: nextSlot,
        instructionState: res.instructionState,
        instructionText: res.instructionText,
        instructionSegments: res.instructionSegments || null,
        instructionLines: res.instructionLines || null
      });
    } else {
      // 未选主牌：不允许选择插槽，直接返回
      return;
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
      // Better: Find the Toad that has list initialized
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
            // 使用 list 替代 stackedCards
            newToad.list = newToad.list || [];
            newToad.list.push(cardToTuck);
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

    // Handle Raccoon Action
    if (gameState && gameState.actionMode === 'ACTION_RACCOON') {
      const { playerStates, openId, clearing, selectedSlot, gameState } = this.data;
      const myState = playerStates[openId];

      const context = {
        gameState,
        playerStates, // handleAction internally might access it via context or just use passed playerState
        playerState: myState,
        clearing,
        selectedClearingIdx: -1, // Not used for Raccoon
        openId,
        actionConfig: gameState.actionConfig // if any
      };

      const result = SpecialActionUtils.handleAction('ACTION_RACCOON', context);

      if (!result.success) {
        wx.showToast({ title: result.errorMsg || "操作失败", icon: "none" });
        return;
      }

      console.log('🦝 浣熊行动完成:', {
        放入洞穴: result.drawCount,
        将摸牌: result.drawCount
      });

      // 构造更新
      const updates = { ...result.updates };

      // 创建放入洞穴的动画事件
      if (result.cavedCards && result.cavedCards.length > 0) {
        updates['gameState.lastEvent'] = {
          type: 'CAVE_CARDS',
          playerOpenId: openId,
          playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
          playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
          cavedCards: result.cavedCards.map(c => Utils.enrichCard(c)),
          count: result.cavedCards.length,
          timestamp: Date.now()
        };
      }

      // 将浣熊的摸牌数量保存到本地变量和数据库
      if (result.drawCount > 0) {
        // 保存到本地变量，供 finalizeAction 使用
        this.pendingDrawCount = (this.pendingDrawCount || 0) + result.drawCount;

        // 计算新的累积值
        const currentAccumulated = gameState.accumulatedRewards || { drawCount: 0, extraTurn: false };
        const newDrawCount = (currentAccumulated.drawCount || 0) + result.drawCount;

        // 直接设置新值
        updates[`gameState.accumulatedRewards.drawCount`] = newDrawCount;

        console.log(`🦝 累积摸牌数量: ${currentAccumulated.drawCount} + ${result.drawCount} = ${newDrawCount}`);
        console.log(`🦝 本地待处理摸牌: ${this.pendingDrawCount}`);
      }

      // 浣熊行动是单次行动，完成后清理 pendingActions
      const remaining = (gameState.pendingActions || []).slice(1);
      if (remaining.length > 0) {
        updates[`gameState.pendingActions`] = remaining;
        updates[`gameState.actionMode`] = remaining[0].type; // 进入下一个行动
        this.submitGameUpdate(updates, "特殊行动", result.logMsg);
      } else {
        updates[`gameState.pendingActions`] = [];
        updates[`gameState.actionMode`] = null;
        updates[`gameState.actionText`] = null;
        console.log('🦝 浣熊行动结束，准备摸牌');
        await this.finalizeAction(updates, result.logMsg);
      }
      return;
    }

    // Handle Clearing Pick Actions (European Wildcat, Mosquito, etc.)
    if (gameState && (gameState.actionMode === 'ACTION_PICK_FROM_CLEARING' || gameState.actionMode === 'PICK_FROM_CLEARING_TO_HAND')) {
      const { playerStates, openId, clearing, selectedClearingIdx, gameState } = this.data;
      const myState = playerStates[openId];

      const context = {
        gameState,
        playerState: myState,
        clearing,
        selectedClearingIdx, // Must be set by onClearingCardTap
        openId,
        actionConfig: gameState.actionConfig
      };

      const result = SpecialActionUtils.handleAction(gameState.actionMode, context);

      if (!result.success) {
        wx.showToast({ title: result.errorMsg || "请选择空地牌", icon: "none" });
        return;
      }

      const updates = { ...result.updates };

      // Clear local selection
      this.setData({ selectedClearingIdx: -1 });

      const remaining = (gameState.pendingActions || []).slice(1);
      if (remaining.length > 0) {
        updates[`gameState.pendingActions`] = remaining;
        updates[`gameState.actionMode`] = remaining[0].type;
        this.submitGameUpdate(updates, "特殊行动", result.logMsg);
      } else {
        updates[`gameState.pendingActions`] = [];
        updates[`gameState.actionMode`] = null;
        updates[`gameState.actionText`] = null;
        await this.finalizeAction(updates, result.logMsg);
      }
      return;
    }

    if (turnAction?.drawnCount > 0 || turnAction?.takenCount > 0) {
      wx.showToast({ title: "已摸牌，本回合只能继续摸牌", icon: "none" });
      return;
    }

    wx.showLoading({ title: "出牌中..." });
    const myState = playerStates[openId];
    const hand = [...(myState.hand || [])];
    const forest = [...(myState.forest || [])];
    const newClearing = [...(clearing || [])];

    const primaryIdx = hand.findIndex(c => c.uid === primarySelection);
    if (primaryIdx === -1) {
      console.error("Selected card not in hand");
      wx.hideLoading();
      return;
    }
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

    // 统一校验：调用 validate.validatePlay() 进行完整校验
    const myHand = hand;
    const selectedCount = myHand.filter(c => c.selected).length;
    const validation = validatePlay({
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

    // 如果校验失败，阻止出牌并显示错误信息
    if (!validation.valid) {
      wx.hideLoading();
      wx.showToast({ title: validation.error || "无法出牌", icon: "none" });
      return;
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
        const ec = existingCard.effectConfig;
        // 修复：effectConfig.target 存储的是物种名称（如"大蟾蜍"），需要与 name 比较
        const targetName = primaryCard.name;
        const isCapacityIncrease = ec && ec.type === 'CAPACITY_INCREASE' && ec.target === targetName;
        const isCapacityUnlimited = ec && ec.type === 'CAPACITY_UNLIMITED' && ec.target === targetName;
        const isSelfStacking = isCapacityIncrease || isCapacityUnlimited;

        // 判断是否允许堆叠：有 max 字段、或处于堆叠模式、或自我堆叠
        if (existingCard.max || isStackMode || isSelfStacking) {
          // 堆叠模式：使用 list 和 max 字段管理堆叠

          // 获取当前堆叠列表和最大容量
          const currentList = existingCard.list || [];
          const currentMax = existingCard.max || 1;

          // 检查堆叠数量限制
          if (currentList.length >= currentMax) {
            wx.hideLoading();
            wx.showToast({ title: `该插槽最多容纳${currentMax}张卡牌`, icon: "none" });
            return;
          }

          // 将新卡片推入 list
          const newList = [...currentList, primaryCard];

          // 继承或初始化 slotConfig
          let newSlotConfig = null;
          if (existingCard.slotConfig) {
            newSlotConfig = existingCard.slotConfig;
          } else if (isStackMode) {
            newSlotConfig = {
              accepts: { tags: [enabler.effectConfig.tag] },
              capacity: 99
            };
          }

          // 用新卡片数据覆盖槽位（显示最新的卡片）
          tTree.slots[selectedSlot.side] = {
            ...primaryCard,
            list: newList,           // 所有堆叠的卡片（包括当前显示的）
            max: currentMax,         // 继承最大容量
            slotConfig: newSlotConfig
          };
        } else {
          // 非堆叠模式：不允许在已有卡片的槽位上打牌
          wx.hideLoading();
          wx.showToast({ title: "该插槽已有卡片", icon: "none" });
          return;
        }
      } else {
        // 槽位为空
        // 预先判断当前打出的牌是否自带堆叠属性(大蟾蜍/野兔)
        const pec = primaryCard.effectConfig;
        const pTargetName = primaryCard.name;
        const isPrimarySelfStacking = pec && (pec.type === 'CAPACITY_INCREASE' || pec.type === 'CAPACITY_UNLIMITED') && pec.target === pTargetName;

        if (isStackMode) {
          // 第一张卡片,处于堆叠模式环境 (如刺荨麻下的蝴蝶)
          tTree.slots[selectedSlot.side] = {
            ...primaryCard,
            list: [primaryCard],  // 初始化 list，包含当前卡片
            max: 99,              // 共享槽位默认无限堆叠
            slotConfig: {
              accepts: { tags: [enabler.effectConfig.tag] },
              capacity: 99
            }
          };
        } else if (isPrimarySelfStacking) {
          // 大蟾蜍/野兔的第一张：初始化堆叠属性
          const maxCapacity = pec.type === 'CAPACITY_UNLIMITED' ? 99 : (pec.value || 1);
          tTree.slots[selectedSlot.side] = {
            ...primaryCard,
            list: [primaryCard],  // 初始化 list，包含当前卡片
            max: maxCapacity,     // 根据效果配置设置最大容量
            slotConfig: null
          };
        } else {
          // 正常放置 (无堆叠属性)
          tTree.slots[selectedSlot.side] = primaryCard;
        }
      }

      // 重要: 如果刚打出的卡片有 CAPACITY_SHARE_SLOT 效果(如刺荨麻)
      // 需要将同树其他槽位中符合条件的卡片转换为堆叠模式
      if (primaryCard.effectConfig && primaryCard.effectConfig.type === 'CAPACITY_SHARE_SLOT') {
        const targetTag = primaryCard.effectConfig.tag;
        // 优化：蝴蝶(BUTTERFLY)只能出现在上方插槽(top)
        const slotsToConvert = targetTag === 'BUTTERFLY' ? ['top'] : ['top', 'bottom', 'left', 'right'];

        slotsToConvert.forEach(side => {
          if (side !== selectedSlot.side && tTree.slots[side]) {
            const card = tTree.slots[side];
            // 检查该卡片是否符合标签要求,且还没有堆叠配置（没有 max 字段）
            if (card.tags && card.tags.includes(targetTag) && !card.max) {
              // 转换为堆叠模式：赋予堆叠效果
              tTree.slots[side] = {
                ...card,
                list: [card],  // 初始化 list，包含原卡片
                max: 99,       // 共享槽位默认无限堆叠
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
      // 统计翻牌数量（合并到回合结束处理）
      // 增强判定：同时检查 type 和 tags
      const { TAGS } = require("../../data/constants");
      const isTreeType = (primaryCard.type || '').toLowerCase() === 'tree';
      const hasTreeTag = primaryCard.tags && primaryCard.tags.includes(TAGS.TREE);
      const isPlayedAsTree = isTreeType || hasTreeTag;

      // 1. 基础更新：手牌、森林、空地、事件
      const updates = {
        [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(newHand),
        [`gameState.playerStates.${openId}.forest`]: DbHelper.cleanForest(forest),
        // [`gameState.clearing`]: DbHelper.cleanClearing(newClearing), // 移除默认全量更新
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
      // 如果打出的是树木，累加翻牌计数器
      // 这里包括奖励行动中打出的树木（如鼼鼠、蝙蝠等效果触发的免费打牌）
      if (isPlayedAsTree) {
        updates[`gameState.accumulatedRewards.revealCount`] = db.command.inc(1);
        this.pendingRevealCount = (this.pendingRevealCount || 0) + 1;
        console.log('🌳 特殊模式打出树木，计数器+1。当前总计:', this.pendingRevealCount);
      } else {
        console.warn('⚠️ 非树木卡牌，未增加计数');
      }

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

      // 自动处理不需要交互的行动 (如清空空地)
      // 这确保了 ACTION_REMOVE_CLEARING 在 Squeaker 之后执行，且不卡住流程
      let cleared = false;
      while (nextPending.length > 0 && nextPending[0].type === 'ACTION_REMOVE_CLEARING') {
        newClearing.length = 0;
        cleared = true;
        nextPending.shift();
      }
      // 如果触发了清空，需要更新 updates 中的 clearing 数据 (全量更新)
      if (cleared) {
        updates[`gameState.clearing`] = DbHelper.cleanClearing(newClearing);
        updates[`gameState.notificationEvent`] = db.command.set(createClearingNotification());
      }

      if (nextPending.length > 0) {
        // 还有后续行动，更新状态继续
        const nextAction = nextPending[0];
        const nextMode = nextAction ? nextAction.type : null;
        const nextText = nextAction?.actionText || null;
        updates[`gameState.pendingActions`] = nextPending;
        updates[`gameState.actionMode`] = nextMode;
        // 使用action自带的actionText，如果没有则设为null
        updates[`gameState.actionText`] = nextText;

        // 清除本地选择状态
        this.setData({
          primarySelection: null,
          selectedSlot: null
        });

        wx.hideLoading();
        this.submitGameUpdate(updates, "出牌成功", `(特殊模式) 打出了 ${primaryCard.name}`);
      } else {
        // 没有后续行动了，执行最终结算
        // 注意：finalizeAction 会处理 actionMode=null, pending=[], 以及 accumulatedRewards 的结算

        // 清除本地选择状态
        this.setData({
          primarySelection: null,
          selectedSlot: null
        });

        wx.hideLoading();
        await this.finalizeAction(updates, `(特殊模式) 打出了 ${primaryCard.name}`);
      }
      return;
    }

    // 检查是否有待处理的特殊行动
    const pendingActions = [...(reward.actions || [])];
    let isRemoveClearingEffect = false;

    // ⚠️ 重要：在进入特殊行动模式之前，先累加翻牌计数器
    // 无论是否有后续行动，只要打出了树木，都要计数
    const { TAGS } = require("../../data/constants");
    const isTreeType = (primaryCard.type || '').toLowerCase() === 'tree';
    const hasTreeTag = primaryCard.tags && primaryCard.tags.includes(TAGS.TREE);
    const isPlayedAsTree = isTreeType || hasTreeTag;

    if (isPlayedAsTree) {
      this.pendingRevealCount = (this.pendingRevealCount || 0) + 1;
      console.log('🌳 普通模式打出树木，计数器+1。当前总计:', this.pendingRevealCount);
    }

    // Auto-Resolve Loop (For actions at start of chain)
    while (pendingActions.length > 0 && pendingActions[0].type === 'ACTION_REMOVE_CLEARING') {
      isRemoveClearingEffect = true;
      newClearing.length = 0;
      pendingActions.shift();
    }

    if (pendingActions.length > 0) {
      // 支付费用卡放入空地 (这是前提，因为自动效果可能要吸走这些费用卡)
      paymentCards.forEach(c => newClearing.push({ ...c, selected: false }));

      const firstAction = pendingActions[0];
      const actionMode = firstAction ? firstAction.type : 'SPECIAL_ACTION';
      const actionText = firstAction?.actionText || bonus.text || effect.text || "特殊行动中...";

      // 如果是全自动行动，直接执行并提交


      // 非自动行动，进入特殊行动模式
      const updates = {
        [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(newHand),
        [`gameState.playerStates.${openId}.forest`]: DbHelper.cleanForest(forest),
        [`gameState.clearing`]: DbHelper.cleanClearing(newClearing),
        [`gameState.pendingActions`]: pendingActions,
        [`gameState.actionMode`]: actionMode,
        [`gameState.actionText`]: actionText,
        [`gameState.accumulatedRewards`]: {
          drawCount: reward.drawCount,
          extraTurn: reward.extraTurn,
          revealCount: isPlayedAsTree ? 1 : 0  // 如果打出了树木，初始化为 1
        },
        [`gameState.lastEvent`]: {
          type: 'PLAY_CARD', playerOpenId: openId,
          playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
          playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
          mainCard: primaryCard, subCards: paymentCards.map(c => Utils.enrichCard(c)),
          timestamp: Date.now()
        }
      };

      // 清除本地选择状态，新行动的提示会自动显示
      this.setData({
        primarySelection: null,
        selectedSlot: null
      });

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

    const isShrub = primaryCard.tags && primaryCard.tags.includes(TAGS.SHRUB);

    // === 翻牌逻辑：回合内累加计数，回合结束时统一翻牌 ===
    let deckRevealEvent = null; // 翻牌事件（用于动画展示）
    // 注意：树木判断和计数逻辑已经在前面（第 1112-1118 行）处理了
    // 这里只需要判断是否立即翻牌还是推迟到回合结束

    const hasNextSteps = (reward.actions && reward.actions.length > 0) || reward.extraTurn;
    const shouldDeferReveal = hasNextSteps;

    // 决定是否立即翻牌还是推迟到回合结束
    if (shouldDeferReveal) {
      console.log('🕒 有后续行动（奖励或额外回合），翻牌推迟到回合结束');
    } else {
      // 立即结算所有累积的翻牌（无后续行动，回合结束）
      const totalReveal = this.pendingRevealCount || 0;
      this.pendingRevealCount = 0; // Reset

      if (totalReveal > 0) {
        let revealedCards = [];
        for (let i = 0; i < totalReveal; i++) {
          if (newDeck.length > 0) {
            const top = newDeck.shift();
            revealedCards.push(top);
            newClearing.push({ ...top, selected: false });
          }
        }

        if (revealedCards.length > 0) {
          const mainCard = revealedCards[revealedCards.length - 1];
          deckRevealEvent = {
            type: 'DECK_TO_CLEARING',
            playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
            playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
            mainCard: Utils.enrichCard(mainCard),
            count: revealedCards.length,
            timestamp: Date.now() + 100
          };
        }
      }
    }
    // 检查空地是否已满
    let notificationEvent = null;
    if (newClearing.length >= 10) {
      newClearing.length = 0;
      notificationEvent = createClearingNotification();
    }

    // 雌性野猪效果：清空空地
    if (isRemoveClearingEffect) {
      newClearing.length = 0;
      notificationEvent = createClearingNotification();
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
      [`gameState.deckRevealEvent`]: deckRevealEvent, // 如果是Immediate模式，会有值；否则为null
      [`gameState.rewardDrawEvent`]: rewardDrawEvent,
      [`gameState.extraTurnEvent`]: extraTurnEvent,
      [`gameState.notificationEvent`]: db.command.set(notificationEvent)
    };

    if (shouldDeferReveal && isPlayedAsTree) {
      updates[`gameState.accumulatedRewards.revealCount`] = db.command.inc(1);
    }

    // 清除本地选择状态，提示会在数据更新后自动计算
    this.setData({
      primarySelection: null,
      selectedSlot: null
    });

    this.submitGameUpdate(updates, "出牌成功", `打出了 ${primaryCard.name}`);
  },

  onClearingCardTap(e) {
    const idx = e.currentTarget.dataset.idx;
    // Toggle selection
    this.setData({
      selectedClearingIdx: this.data.selectedClearingIdx === idx ? -1 : idx
    });
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
            const pending = [...(this.data.gameState.pendingActions || [])];
            // 移除当前行动（头部）
            pending.shift();

            // 自动处理清空空地等不需要交互的行动
            let newClearing = [...(this.data.clearing || [])];
            let clearingChanged = false;
            while (pending.length > 0 && pending[0].type === 'ACTION_REMOVE_CLEARING') {
              newClearing.length = 0;
              clearingChanged = true;
              pending.shift();
            }

            const updates = {};
            if (clearingChanged) {
              updates['gameState.clearing'] = DbHelper.cleanClearing(newClearing);
              updates[`gameState.notificationEvent`] = db.command.set(createClearingNotification());
            }

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
              await this.finalizeAction(updates, "跳过了行动");
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

    console.log('📊 finalizeAction 摸牌统计:', {
      累积奖励摸牌: baseDraw,
      待处理摸牌: pendingDraw,
      总计摸牌: totalDraw
    });

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

    console.log(`✅ 实际摸牌: ${actualDraw} 张 (手牌: ${currentSize} -> ${newHand.length})`);

    updates[`gameState.playerStates.${openId}.hand`] = DbHelper.cleanHand(newHand);
    updates[`gameState.deck`] = newDeck;

    // 创建奖励抽牌事件
    let rewardDrawEvent = null;
    if (actualDraw > 0) {
      // 获取实际摸到的卡牌（newHand 的最后 actualDraw 张）
      const drawnCards = newHand.slice(-actualDraw);

      rewardDrawEvent = {
        type: 'REWARD_DRAW',
        playerOpenId: openId,
        playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
        playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
        count: actualDraw,
        drawnCards: drawnCards.map(c => Utils.enrichCard(c)), // 添加具体摸到的卡牌
        timestamp: Date.now()
      };
    }
    updates['gameState.rewardDrawEvent'] = rewardDrawEvent;

    // === 处理累积的翻牌 (回合结束时统一翻牌) ===
    // 使用本地计数器 pendingRevealCount，该计数器在回合开始时初始化为 0
    // 每次打出树木时累加，包括奖励行动中打出的树木
    console.log('📊 回合结束翻牌统计:', {
      本回合打出树木数: this.pendingRevealCount || 0,
      数据库累积计数: rewards.revealCount || 0
    });

    // 优先使用本地计数器（更准确），数据库计数作为备份（断线重连场景）
    const pendingReveal = Math.max(this.pendingRevealCount || 0, rewards.revealCount || 0);

    if (pendingReveal > 0) {
      console.log(`🎴 回合结束，开始翻牌: ${pendingReveal} 张`);

      const isFreshUpdate = !!actionUpdates[`gameState.clearing`];
      let newClearing = isFreshUpdate ?
        [...actionUpdates[`gameState.clearing`]] :
        [...(this.data.clearing || [])];

      let revealedCards = [];
      for (let i = 0; i < pendingReveal; i++) {
        if (newDeck.length > 0) {
          const top = newDeck.shift();
          revealedCards.push(top);
          // 确保ID存在，cleanClearing能处理
          newClearing.push({ ...top, selected: false });
        }
      }

      if (revealedCards.length > 0) {
        if (isFreshUpdate) {
          // 如果当前Action已经全量更新了clearing（例如包含支付卡或已清空），则追加到该状态
          updates[`gameState.clearing`] = DbHelper.cleanClearing(newClearing);
        } else {
          // 否则，使用原子操作 push，防止覆盖其他并发更新（Race Condition修复核心）
          updates[`gameState.clearing`] = db.command.push({
            each: DbHelper.cleanClearing(revealedCards)
          });
        }

        updates[`gameState.deck`] = newDeck; // 更新牌堆

        const mainCard = revealedCards[revealedCards.length - 1]; // 事件展示最后一张
        updates['gameState.deckRevealEvent'] = {
          type: 'DECK_TO_CLEARING',
          playerNick: this.data.players.find(p => p.openId === openId)?.nickName || '玩家',
          playerAvatar: this.data.players.find(p => p.openId === openId)?.avatarUrl || '',
          mainCard: Utils.enrichCard(mainCard),
          revealedCards: revealedCards.map(c => Utils.enrichCard(c)), // 添加所有翻出的卡片
          count: revealedCards.length,
          timestamp: Date.now() + 100
        };
        console.log(`✅ 翻牌完成: ${revealedCards.length} 张卡牌已放入空地`);
      }
    }

    // 重置翻牌计数器（回合结束后清零，等待下一回合开始时重新初始化）
    // 注意：实际的初始化在回合切换时进行（processGameUpdate 中的 turnChanged 逻辑）
    this.pendingRevealCount = 0;
    console.log('🔄 翻牌计数器已重置为 0');

    // 2.5. 检查空地是否需要清空（达到10张时清空）
    const currentClearing = updates['gameState.clearing'] || this.data.clearing || [];
    if (currentClearing.length >= 10) {
      console.log(`🧹 空地达到 ${currentClearing.length} 张，触发清空`);
      updates['gameState.clearing'] = [];
      updates['gameState.notificationEvent'] = db.command.set({
        type: 'NOTIFICATION',
        icon: '🧹',
        message: `空地达到 ${currentClearing.length} 张，已清空！`,
        timestamp: Date.now() + 200
      });
    }

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

      // 判断是否回合结束 (activePlayer 或 turnCount 发生变化)
      const isTurnEnding = updates['gameState.activePlayer'] !== undefined || updates['gameState.turnCount'] !== undefined;

      // 只有选中牌堆(-2)且回合未结束时才保留，否则重置
      // 空地牌(-1 或 >=0)拿走后不再保留选中
      const shouldKeepSelection = !isTurnEnding && this.data.selectedClearingIdx === -2;

      // 准备本地更新的数据
      const nextLocalData = {
        selectedClearingIdx: shouldKeepSelection ? -2 : -1,
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

  /**
   * 显示森林中的常驻效果(Buff)
   * 只统计带有触发效果的卡片,不包括得分效果
   */
  onShowBuffs() {
    const { playerStates, openId } = this.data;
    const forest = playerStates[openId]?.forest || [];
    const { TRIGGER_TYPES } = require("../../data/enums");

    let buffs = [];

    forest.forEach(group => {
      // 检查所有卡片(中心+四个槽位)
      [group.center, group.slots?.top, group.slots?.bottom, group.slots?.left, group.slots?.right].forEach(card => {
        if (!card) return;

        // 只统计有 effectConfig 且类型为 TRIGGER 的卡片
        if (card.effectConfig && card.effectConfig.type) {
          const effectType = card.effectConfig.type;

          // 检查是否是触发类型的效果
          const isTriggerEffect = Object.values(TRIGGER_TYPES).includes(effectType);

          if (isTriggerEffect && card.effect) {
            buffs.push({
              name: card.name,
              effect: card.effect,
              type: effectType
            });
          }
        }
      });
    });

    if (buffs.length === 0) {
      wx.showToast({ title: "当前无常驻效果", icon: "none" });
      return;
    }

    // 合并相同效果,统计数量
    const buffMap = new Map();
    buffs.forEach(buff => {
      // 使用 name + effect 作为唯一标识
      const key = `${buff.name}|${buff.effect}`;
      if (buffMap.has(key)) {
        buffMap.get(key).count++;
      } else {
        buffMap.set(key, { ...buff, count: 1 });
      }
    });

    // 格式化显示
    const buffList = Array.from(buffMap.values());
    const content = buffList.map((buff, index) => {
      const countStr = buff.count > 1 ? ` x${buff.count}` : '';
      return `${index + 1}. ${buff.name}${countStr}\n   ${buff.effect}`;
    }).join('\n\n');

    wx.showModal({
      title: `森林常驻效果 (${buffs.length}个)`,
      content: content,
      showCancel: false,
      confirmText: '知道了'
    });
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
    // 自动清空满的空地
    let notificationEvent = null;
    if (newClearing.length >= 10) {
      newClearing.length = 0;
      notificationEvent = createClearingNotification();
    }

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
      [`gameState.extraTurnEvent`]: extraTurnEvent,
      [`gameState.notificationEvent`]: db.command.set(notificationEvent)
    };

    this.submitGameUpdate(updates, "种植成功", "将一张手牌作为树苗打出");
  },

  onCheatAddCards() {
    this.setData({ cheatVisible: true });
  },

  closeCheatModal() {
    this.setData({ cheatVisible: false });
  },

  onCheatCardSelect(e) {
    const cardId = e.detail.cardId;
    const { playerStates, openId } = this.data;
    const myState = playerStates[openId];
    if (!myState) return;

    const hand = [...(myState.hand || [])];
    const rawInfo = getCardInfoById(cardId);
    if (!rawInfo) return;

    const newCard = {
      ...rawInfo,
      uid: `cheat_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      selected: false
    };

    hand.push(newCard);

    const updates = {
      [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(hand)
    };

    this.submitGameUpdate(updates, "金手指", `添加了 ${rawInfo.name}`);
    wx.showToast({ title: '已添加', icon: 'success', duration: 500 });
  },

  onCheatCardPreview(e) {
    const cardId = e.detail.cardId;
    this.setData({ detailCardId: cardId });
  },

  onClearingCardTap(e) {
    const idx = e.currentTarget.dataset.idx;
    this.setData({ selectedClearingIdx: this.data.selectedClearingIdx === idx ? -1 : idx });
  }
});
