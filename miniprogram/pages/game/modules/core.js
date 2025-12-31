const Utils = require("../../../utils/utils");
const db = wx.cloud.database();

/**
 * 提交游戏数据更新
 * @param {Page} page 页面实例
 * @param {Object} updates 更新的数据对象
 * @param {String} successMsg 成功提示信息
 * @param {String} logMsg 日志信息
 */
async function submitGameUpdate(page, updates, successMsg, logMsg) {
  if (logMsg) updates["gameState.logs"] = db.command.push({ operator: page.data.openId, action: logMsg, timestamp: Date.now() });

  // [Optimistic Update] 提前捕获 nextTurnAction,用于本地立即更新指引
  const nextTurnAction = updates['gameState.turnAction'];

  // Fix: 使用 db.command.set 避免对象更新时的自动扁平化导致的 "Cannot create field ... in element null" 错误
  const _ = db.command;

  // 如果有日志消息且没有显式设置 notificationEvent,则自动生成一个通知事件
  if (logMsg && updates['gameState.notificationEvent'] === undefined) {
    const { openId, players } = page.data;
    const player = players.find(p => p.openId === openId);
    updates['gameState.notificationEvent'] = _.set({
      type: 'NOTIFICATION',
      playerOpenId: openId,
      playerNick: player?.nickName || '玩家',
      playerAvatar: player?.avatarUrl || '',
      message: logMsg.replace(`${player?.nickName || '玩家'} `, ''), // 避免名字重复
      timestamp: Date.now()
    });
  }

  ['gameState.lastEvent', 'gameState.deckRevealEvent', 'gameState.rewardDrawEvent', 'gameState.extraTurnEvent', 'gameState.notificationEvent', 'gameState.turnAction'].forEach(key => {
    if (updates[key] !== undefined) {
      updates[key] = _.set(updates[key]);
    }
  });

  try {
    // 先执行数据库更新
    await db.collection("rooms").doc(page.data.roomId).update({ data: updates });
    wx.hideLoading();

    if (successMsg) {
      // 可选：如果是重要操作，给个轻提示
      // wx.showToast({ title: successMsg, icon: "none" });
    }

    // 注意：不再手动添加 eventQueue，完全依赖 watch 推送，避免重复动画。

    // === 本地状态清理与乐观更新 ===

    // 彻底清空手牌的选择状态 (本地临时修改，等待推送覆盖)
    const { openId, playerStates } = page.data;
    if (playerStates && playerStates[openId] && playerStates[openId].hand) {
      playerStates[openId].hand.forEach(c => c.selected = false);
    }

    // 判断是否回合结束 (activePlayer 或 turnCount 发生变化)
    const isTurnEnding = updates['gameState.activePlayer'] !== undefined || updates['gameState.turnCount'] !== undefined;

    // 只有选中牌堆(-2)且回合未结束时才保留,否则重置
    // 空地牌(-1 或 >=0)拿走后不再保留选中
    const shouldKeepSelection = !isTurnEnding && page.data.selectedClearingIdx === -2;

    // 准备本地更新的数据
    const nextLocalData = {
      selectedClearingIdx: shouldKeepSelection ? -2 : -1,
      primarySelection: null,
      selectedSlot: null,
      [`playerStates.${openId}.hand`]: playerStates[openId].hand || []
    };

    // 乐观更新行动模式和提示文案
    if (updates['gameState.actionMode'] !== undefined) {
      nextLocalData['gameState.actionMode'] = updates['gameState.actionMode'];
    }
    if (updates['gameState.actionText'] !== undefined) {
      nextLocalData['gameState.actionText'] = updates['gameState.actionText'];
    }

    // 提交成功后也确保同步字段被清空 (updates 已经包含了数据库清除，这里是本地状态同步)
    nextLocalData[`gameState.playerStates.${openId}.selectedSlot`] = null;

    // 如果有 TurnAction 更新,立即应用到本地,并重算指引
    if (nextTurnAction) {
      nextLocalData.turnAction = nextTurnAction;
    }

    // 基于预测的本地状态计算指引文案
    const simulationData = { ...page.data, ...nextLocalData };
    const { instructionState, instructionText } = Utils.computeInstruction(simulationData);

    page.setData({
      ...nextLocalData,
      instructionState,
      instructionText
    });

  } catch (e) {
    console.error("更新游戏数据失败:", e);
    wx.hideLoading();
    wx.showToast({ title: "操作失败,请重试", icon: "none" });
  }
}

/**
 * 创建带用户信息的标准事件对象
 */
function createPlayerEvent(page, type, data = {}) {
  const { openId, players } = page.data;
  const player = players.find(p => p.openId === openId);
  return {
    type,
    playerOpenId: openId,
    playerNick: player?.nickName || '玩家',
    playerAvatar: player?.avatarUrl || '',
    timestamp: Date.now(),
    ...data
  };
}

/**
 * 创建标准化的额外回合事件
 */
function createExtraTurnEvent(page) {
  return createPlayerEvent(page, 'EXTRA_TURN', {
    icon: '⏳',
    message: '获得额外回合！',
    timestamp: Date.now() + 50
  });
}

/**
 * 构造清空空地的系统通知
 */
function createClearingNotification() {
  return {
    type: 'NOTIFICATION',
    // 无玩家信息 (系统播报)
    icon: '🧹',
    message: '清空了空地！',
    timestamp: Date.now() + 100
  };
}

module.exports = {
  submitGameUpdate,
  createPlayerEvent,
  createExtraTurnEvent,
  createClearingNotification
};
