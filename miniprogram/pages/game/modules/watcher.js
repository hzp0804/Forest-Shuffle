const Utils = require("../../../utils/utils");
const ClearingUtils = require("../../../utils/clearing.js");

/**
 * 初始化游戏数据实时监听
 * @param {Page} page 页面实例
 */
function initGameWatcher(page) {
  if (page.gameWatcher) return; // 避免重复监听
  if (!page.data.roomId) return;

  console.log("🔔 开始实时监听游戏数据:", page.data.roomId);

  const db = wx.cloud.database();
  page.gameWatcher = db
    .collection("rooms")
    .doc(page.data.roomId)
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
        processGameUpdate(page, serverData);
      },
      onError: (err) => {
        console.error("❌ 实时监听错误:", err);

        // 尝试重新连接
        stopWatcher(page);

        wx.showToast({
          title: "连接断开,正在重连...",
          icon: "none",
          duration: 2000,
        });

        // 3秒后尝试重新建立连接
        setTimeout(() => {
          console.log("🔄 尝试重新连接...");
          initGameWatcher(page);
        }, 3000);
      },
    });
}

/**
 * 停止实时监听
 * @param {Page} page 页面实例
 */
function stopWatcher(page) {
  if (page.gameWatcher) {
    console.log("🔕 停止实时监听");
    page.gameWatcher.close();
    page.gameWatcher = null;
  }

  // 清空事件队列,防止退出后还触发动画和提示
  page.setData({
    eventQueue: [],
    isProcessingEvent: false,
    currentEvent: null,
    pendingTurnToast: false,
    pendingActionToast: null,
  });

  // 清空得分缓存,防止进入其他房间时带入旧数据
  const { scoreCache } = require("../../../utils/score/helpers");
  scoreCache.clear();
  console.log("🧹 已清空得分缓存");
}

/**
 * 处理游戏数据更新
 * @param {Page} page 页面实例
 * @param {Object} serverData 服务器数据
 */
function processGameUpdate(page, serverData) {
  try {
    const gameState = serverData.gameState || {};
    const processedData = Utils.processGameData(
      { data: serverData },
      page.data
    );

    const currentActive = gameState.activePlayer || serverData.activePlayer;
    const currentTurnCount = gameState.turnCount || 0;

    // 使用同步的 localState 进行对比，避免 page.data 异步更新导致的重复判断
    const lastActive = page.localState ? page.localState.activePlayer : "";
    const lastTurn = page.localState ? page.localState.turnCount : -1;

    const isFirstSync = lastActive === "";
    const turnChanged =
      !isFirstSync &&
      (currentActive !== lastActive || currentTurnCount !== lastTurn);

    let turnChangeEvent = null;

    if (page.localState) {
      page.localState.activePlayer = currentActive;
      page.localState.turnCount = currentTurnCount;
    }

    // 1. 回合切换逻辑
    if (turnChanged) {
      processedData.primarySelection = null;
      processedData.selectedSlot = null;
      processedData.selectedClearingIdx = -1;
      processedData.pendingActionToast = null;
      processedData.lastActivePlayer = currentActive;

      page.pendingRevealCount = 0;
      console.log("🔄 回合切换，翻牌计数器已重置为 0");
      processedData.lastTurnCount = currentTurnCount;

      const activePlayer = page.data.players.find(
        (p) => p.openId === currentActive
      );
      if (activePlayer) {
        turnChangeEvent = {
          type: "TURN_CHANGE",
          playerOpenId: currentActive,
          playerNick: activePlayer.nickName || "玩家",
          playerAvatar: activePlayer.avatarUrl || "",
          isMyTurn: currentActive === page.data.openId,
          timestamp: Date.now() + 1000,
        };
      }
    }

    if (isFirstSync) {
      processedData.lastActivePlayer = currentActive;
      processedData.lastTurnCount = currentTurnCount;
    }

    if (
      currentActive === page.data.openId &&
      page.data.lastNotifiedTurnCount !== currentTurnCount
    ) {
      processedData.lastNotifiedTurnCount = currentTurnCount;
    }

    // 2. 事件队列处理
    const lastEvent = gameState.lastEvent;
    const deckRevealEvent = gameState.deckRevealEvent;
    const rewardDrawEvent = gameState.rewardDrawEvent;
    const extraTurnEvent = gameState.extraTurnEvent;
    const notificationEvent = gameState.notificationEvent;

    let nextLastEventTime = page.localState
      ? page.localState.lastEventTime
      : page.data.lastEventTime || 0;
    let added = false;

    const tryAddEvent = (evt) => {
      if (evt && evt.timestamp > nextLastEventTime) {
        nextLastEventTime = Math.max(nextLastEventTime, evt.timestamp);
        if (page.localState) page.localState.lastEventTime = nextLastEventTime;





        // 冬季卡事件不受播报设置影响，始终显示
        const isWinterEvent = !!evt.isWinterReveal;
        
        // 如果关闭了播报，跳过加入事件队列（但冬季卡除外）
        if (page.data.enableVoice === false && !isWinterEvent) {
          return;
        }
        
        if (isWinterEvent) {
          console.log('❄️ 冬季卡事件将被添加到队列 (不受播报设置影响)');
        }




        addToEventQueue(page, evt);
        added = true;
      }
    };

    if (lastEvent) {
      const events = Array.isArray(lastEvent) ? lastEvent : [lastEvent];
      events.forEach((evt) => tryAddEvent(evt));
    }
    tryAddEvent(deckRevealEvent);
    tryAddEvent(rewardDrawEvent);
    tryAddEvent(extraTurnEvent);
    tryAddEvent(notificationEvent);

    if (turnChangeEvent) {
      addToEventQueue(page, turnChangeEvent);
      added = true;
    }

    processedData.lastEventTime = nextLastEventTime;

    // 3. 空地滚动处理
    const targetScrollId = ClearingUtils.getScrollTarget(
      page.data.clearing,
      processedData.clearing
    );
    page.setData(processedData, () => {
      if (targetScrollId) {
        ClearingUtils.executeScroll(page, targetScrollId);
      }
      if (added || processedData.pendingTurnToast) {
        // 调用 page 上的 processNextEvent，如果它已被移出，则需要在这里引入或传递
        if (typeof page.processNextEvent === "function") {
          page.processNextEvent();
        }
      }
    });
  } catch (e) {
    console.error("处理游戏更新失败:", e);
  }
}

function addToEventQueue(page, event) {
  page.setData({ eventQueue: [...page.data.eventQueue, event] });
}

module.exports = {
  initGameWatcher,
  stopWatcher,
  processGameUpdate,
};
