const ClearingUtils = require("../../../utils/clearing.js");

/**
 * 添加事件到队列
 */
function addToEventQueue(page, event) {
  page.setData({ eventQueue: [...page.data.eventQueue, event] });
}

/**
 * 处理下一个事件
 */
async function processNextEvent(page) {
  // 安全检查: 如果监听器已关闭(页面已卸载),不再处理事件
  if (!page.gameWatcher) {
    console.log("⚠️ 页面已卸载,跳过事件处理");
    return;
  }

  if (page.data.isProcessingEvent) return;

  if (page.data.eventQueue.length === 0) {
    page.setData({ isProcessingEvent: false });

    // 只处理 action toast
    if (page.data.pendingActionToast) {
      wx.showToast({
        title: page.data.pendingActionToast,
        icon: "none",
        duration: 1000,
      });
      page.setData({ pendingActionToast: null });
    }
    return;
  }

  page.setData({ isProcessingEvent: true });
  const event = page.data.eventQueue[0];
  const remaining = page.data.eventQueue.slice(1);

  page.setData({
    currentEvent: event,
    eventQueue: remaining,
    isCardFlipped: false,
  });

  // === 自动切换视角逻辑 ===
  // 只有在回合切换时才自动跟随视角，其他玩家行动（打牌、抽牌等）不再强制拉走用户视角
  const autoSwitchTypes = ["TURN_CHANGE"];
  const targetOpid = event.playerOpenId;
  if (
    autoSwitchTypes.includes(event.type) &&
    targetOpid &&
    targetOpid !== page.data.selectedPlayerOpenId
  ) {
    const viewingPlayerState = page.data.playerStates?.[targetOpid];
    if (viewingPlayerState) {
      const displayForest = viewingPlayerState.forest || [];
      const viewingPlayer = page.data.players.find(
        (p) => p && p.openId === targetOpid
      );

      const syncedSlot = viewingPlayerState.selectedSlot || null;
      const targetIndex = page.data.players.findIndex(
        (p) => p && p.openId === targetOpid
      );

      page.setData({
        selectedPlayerOpenId: targetOpid,
        myForest: displayForest,
        viewingPlayerNick: viewingPlayer?.nickName || "玩家",
        isViewingSelf: targetOpid === page.data.openId,
        forestScrollTop: 0,
        // 自动跳转时从 playerStates 获取最新同步状态
        selectedSlot: syncedSlot,
        currentForestIndex: targetIndex >= 0 ? targetIndex : 0,
      });
    }
  }

  // 如果是带翻页效果的事件，延迟触发翻转
  const needsFlip =
    event.type === "DRAW_CARD" ||
    event.type === "DECK_TO_CLEARING" ||
    event.type === "REWARD_DRAW";
  if (needsFlip) {
    setTimeout(() => {
      page.setData({ isCardFlipped: true });
    }, 50);
  } else {
    page.setData({ isCardFlipped: true });
  }

  const duration = 1000;
  setTimeout(() => {
    page.setData({ currentEvent: null, isProcessingEvent: false });
    processNextEvent(page);
  }, duration);
}

/**
 * 关闭当前事件
 */
function onCloseEvent(page) {
  page.setData({ currentEvent: null, isProcessingEvent: false });
  processNextEvent(page);
}

module.exports = {
  addToEventQueue,
  processNextEvent,
  onCloseEvent,
};
