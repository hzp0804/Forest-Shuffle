/**
 * 游戏主页面 - 重构版
 * 将复杂逻辑拆分到 modules 目录下的各个模块中
 */

// 导入工具类
const Utils = require("../../utils/utils");
const { validatePlay } = require("../../utils/validate.js");
const { CARD_TYPES } = require("../../data/constants");
const db = wx.cloud.database();

// 导入游戏模块
const GameModules = require("./modules/index.js");

/**
 * 将森林数据按树木名称分组
 * @param {Array} forest 
 * @returns {Array} grouped array: [{name: 'Oak', list: [tree1, tree2]}, ...]
 */
const groupForest = (forest) => {
  if (!forest || !Array.isArray(forest)) return [];
  const groups = [];
  const map = new Map();

  forest.forEach(tree => {
    if (!tree.center) return;
    const name = tree.center.name || 'Unknown';
    if (!map.has(name)) {
      const newGroup = { name, list: [] };
      map.set(name, newGroup);
      groups.push(newGroup);
    }
    map.get(name).list.push(tree);
  });

  groups.sort((a, b) => b.list.length - a.list.length);
  return groups;
};

Page({
  data: {
    roomId: "",
    players: [],
    deck: [],
    clearing: [],
    playerStates: {},
    openId: "",
    selectedPlayerOpenId: "",
    primarySelection: "",
    instructionState: "normal",
    instructionText: "",
    lastActivePlayer: "",
    lastTurnCount: -1,
    lastNotifiedTurnCount: -1,
    enableAnimation: true,
    eventQueue: [],
    isProcessingEvent: false,
    lastEventTime: 0,
    currentEvent: null,
    isCardFlipped: false,
    pendingTurnToast: false,
    pendingActionToast: null,
    clearingScrollId: "",
    cheatVisible: false,
    cheatSections: [],
    allCheatSections: [],
    cheatSearchQuery: "",
    handExpanded: false,
    forestScrollTop: 0,
    currentForestIndex: 0,
  },

  // ==================== 生命周期 ====================

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

    // 初始化本地同步状态
    this.localState = {
      lastEventTime: 0,
      activePlayer: '',
      turnCount: -1
    };

    // 清空得分缓存
    const { scoreCache } = require("../../utils/score/helpers");
    scoreCache.clear();
    console.log("🧹 进入房间,已清空得分缓存");
  },

  onShow() {
    GameModules.initGameWatcher(this);
  },

  onHide() {
    GameModules.stopWatcher(this);
  },

  onUnload() {
    GameModules.stopWatcher(this);
  },

  // ==================== 用户交互 ====================

  onPlayerTap(e) {
    GameModules.onPlayerTap(this, e);
  },

  onHandTap(e) {
    GameModules.onHandTap(this, e);
  },

  onSlotTap(e) {
    GameModules.onSlotTap(this, e);
  },

  onStackTap(e) {
    GameModules.onStackTap(this, e);
  },

  onClearingCardTap(e) {
    GameModules.onClearingCardTap(this, e);
  },

  onToggleHandExpanded() {
    GameModules.onToggleHandExpanded(this);
  },

  onHandTouchStart(e) {
    GameModules.onHandTouchStart(this, e);
  },

  onHandTouchEnd(e) {
    GameModules.onHandTouchEnd(this, e);
  },

  onDrawCard() {
    GameModules.onDrawCard(this);
  },

  onClearingTouchStart(e) {
    GameModules.onClearingTouchStart(this, e);
  },

  onClearingTouchEnd(e) {
    GameModules.onClearingTouchEnd(this, e);
  },

  // ==================== 显示功能 ====================

  onShowDetail(e) {
    GameModules.onShowDetail(this, e);
  },

  onCloseDetail() {
    GameModules.onCloseDetail(this);
  },

  onShowBuffs() {
    GameModules.onShowBuffs(this);
  },

  onForestSwiperChange(e) {
    GameModules.onForestSwiperChange(this, e);
  },

  closeStackModal() {
    this.setData({ stackModalVisible: false });
  },

  // ==================== 事件处理 ====================

  processNextEvent() {
    GameModules.processNextEvent(this);
  },

  onCloseEvent() {
    GameModules.onCloseEvent(this);
  },

  onCloseDrawing() {
    // 已废弃,现在统一走 eventQueue
  },

  // ==================== 出牌逻辑 ====================

  async onConfirmPlay(e) {
    const source = (typeof e === 'string') ? e : 'PLAYER_ACTION';
    const { gameState, turnAction } = this.data;

    // 处理特殊行动模式
    if (gameState && gameState.actionMode === 'ACTION_TUCK_HAND_CARD') {
      return await GameModules.handleTuckAction(this);
    }

    if (gameState && gameState.actionMode === 'ACTION_RACCOON') {
      return await GameModules.handleRaccoonAction(this);
    }

    if (gameState && (
      gameState.actionMode === 'ACTION_PICK_FROM_CLEARING' ||
      gameState.actionMode === 'PICK_FROM_CLEARING_TO_HAND' ||
      gameState.actionMode === 'ACTION_PICK_FROM_CLEARING_TO_CAVE'
    )) {
      return await GameModules.handleClearingPickAction(this);
    }

    // 检查是否已经摸牌
    if (turnAction?.drawnCount > 0 || turnAction?.takenCount > 0) {
      wx.showToast({ title: "已摸牌，本回合只能继续摸牌", icon: "none" });
      return;
    }

    // 执行普通出牌逻辑
    await GameModules.handleNormalPlay(this, source);
  },

  onConfirmTake() {
    GameModules.onConfirmTake(this);
  },

  onPlaySapling() {
    GameModules.onPlaySapling(this);
  },

  // ==================== 特殊行动 ====================

  async onConfirmSpecialAction() {
    await GameModules.onConfirmSpecialAction(this);
  },

  onEndTurn() {
    GameModules.onEndTurn(this);
  },

  // ==================== 金手指 ====================

  onCheatAddCards() {
    GameModules.onCheatAddCards(this);
  },

  closeCheatModal() {
    GameModules.closeCheatModal(this);
  },

  onCheatCardSelect(e) {
    GameModules.onCheatCardSelect(this, e);
  },

  onCheatCardPreview(e) {
    GameModules.onCheatCardPreview(this, e);
  },

  // ==================== 辅助方法 ====================

  /**
   * 这些方法被模块调用,需要保留在主文件中
   */

  // 由 watcher 模块调用
  initGameWatcher() {
    GameModules.initGameWatcher(this);
  },

  stopWatcher() {
    GameModules.stopWatcher(this);
  },

  processGameUpdate(serverData) {
    GameModules.processGameUpdate(this, serverData);
  },

  addToEventQueue(event) {
    GameModules.addToEventQueue(this, event);
  },

  // 由 draw 模块调用
  processDrawWithWinter(deck, count, startWinterCount) {
    return GameModules.processDrawWithWinter(this, deck, count, startWinterCount);
  },

  executeDrawFromDeck() {
    GameModules.executeDrawFromDeck(this);
  },

  // 由 action 模块调用
  async finalizeAction(actionUpdates, logMsg) {
    await GameModules.finalizeAction(this, actionUpdates, logMsg);
  },

  handleGameOver(newDeck, winterCount, events) {
    const updates = {
      [`gameState.deck`]: require("../../utils/dbHelper.js").cleanDeck(newDeck),
      [`gameState.winterCardCount`]: winterCount,
      [`gameState.isGameOver`]: true,
      [`gameState.gameEndReason`]: 'WINTER_CARD',
      [`gameState.gameEndTime`]: Date.now(),
      [`gameState.lastEvent`]: events
    };
    GameModules.submitGameUpdate(this, updates, null, `抽到第3张冬季卡，游戏结束`);

    setTimeout(() => {
      wx.navigateTo({ url: `/pages/game-over/game-over?roomId=${this.data.roomId}` });
    }, 3000);
  },

  // 由 core 模块调用
  async submitGameUpdate(updates, successMsg, logMsg) {
    await GameModules.submitGameUpdate(this, updates, successMsg, logMsg);
  },

  createPlayerEvent(type, data) {
    return GameModules.createPlayerEvent(this, type, data);
  },

  createExtraTurnEvent() {
    return GameModules.createExtraTurnEvent(this);
  }
});
