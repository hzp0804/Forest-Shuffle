const Utils = require("../../../utils/utils");
const DbHelper = require("../../../utils/dbHelper.js");
const SpecialActionUtils = require("../../../utils/specialAction.js");
const { submitGameUpdate } = require("./core.js");
const { finalizeAction } = require("./action.js");

/**
 * 处理大蟾蜍叠放行动
 */
async function handleTuckAction(page) {
  const { gameState, playerStates, openId } = page.data;

  const myHand = playerStates[openId].hand || [];
  const selected = myHand.filter(c => c.selected);
  if (selected.length !== 1) {
    wx.showToast({ title: "请选择一张手牌", icon: "none" });
    return false;
  }

  const cardToTuck = selected[0];
  const newHand = myHand.filter(c => c.uid !== cardToTuck.uid);
  const forest = [...(playerStates[openId].forest || [])];

  // 查找大蟾蜍
  let toadUid = gameState.lastEvent?.mainCard?.uid;
  let foundToad = false;

  for (let i = 0; i < forest.length; i++) {
    let group = forest[i];
    if (group.slots) {
      const slots = Object.values(group.slots);
      const toad = slots.find(s => s && s.uid === toadUid);
      if (toad) {
        const key = Object.keys(group.slots).find(k => group.slots[k] && group.slots[k].uid === toadUid);
        const newGroup = { ...group, slots: { ...group.slots } };
        const newToad = { ...newGroup.slots[key] };
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
    console.error("Toad not found for tucking");
  }

  const updates = {
    [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(newHand),
    [`gameState.playerStates.${openId}.forest`]: DbHelper.cleanForest(forest),
  };

  const remaining = (gameState.pendingActions || []).slice(1);
  if (remaining.length > 0) {
    updates[`gameState.pendingActions`] = remaining;
    updates[`gameState.actionMode`] = remaining[0].type;
    submitGameUpdate(page, updates, "特殊行动", `将 ${cardToTuck.name} 叠放在大蟾蜍下`);
  } else {
    updates[`gameState.pendingActions`] = [];
    updates[`gameState.actionMode`] = null;
    updates[`gameState.actionText`] = null;
    await finalizeAction(page, updates, `将 ${cardToTuck.name} 叠放在大蟾蜍下`);
  }

  return true;
}

/**
 * 处理浣熊行动
 */
async function handleRaccoonAction(page) {
  const { playerStates, openId, clearing, gameState } = page.data;
  const myState = playerStates[openId];

  const context = {
    gameState,
    playerStates,
    playerState: myState,
    clearing,
    selectedClearingIdx: -1,
    openId,
    actionConfig: gameState.actionConfig
  };

  const result = SpecialActionUtils.handleAction('ACTION_RACCOON', context);

  if (!result.success) {
    wx.showToast({ title: result.errorMsg || "操作失败", icon: "none" });
    return false;
  }

  console.log('🦝 浣熊行动完成:', {
    放入洞穴: result.drawCount,
    将摸牌: result.drawCount
  });

  const updates = { ...result.updates };

  // 创建放入洞穴的动画事件
  if (result.cavedCards && result.cavedCards.length > 0) {
    updates['gameState.lastEvent'] = {
      type: 'CAVE_CARDS',
      playerOpenId: openId,
      playerNick: page.data.players.find(p => p.openId === openId)?.nickName || '玩家',
      playerAvatar: page.data.players.find(p => p.openId === openId)?.avatarUrl || '',
      cavedCards: result.cavedCards.map(c => Utils.enrichCard(c)),
      count: result.cavedCards.length,
      timestamp: Date.now()
    };
  }

  // 将浣熊的摸牌数量保存到本地变量和数据库
  if (result.drawCount > 0) {
    page.pendingDrawCount = (page.pendingDrawCount || 0) + result.drawCount;

    const currentAccumulated = gameState.accumulatedRewards || { drawCount: 0, extraTurn: false };
    const newDrawCount = (currentAccumulated.drawCount || 0) + result.drawCount;

    updates[`gameState.accumulatedRewards.drawCount`] = newDrawCount;

    console.log(`🦝 累积摸牌数量: ${currentAccumulated.drawCount} + ${result.drawCount} = ${newDrawCount}`);
    console.log(`🦝 本地待处理摸牌: ${page.pendingDrawCount}`);
  }

  const remaining = (gameState.pendingActions || []).slice(1);
  if (remaining.length > 0) {
    updates[`gameState.pendingActions`] = remaining;
    updates[`gameState.actionMode`] = remaining[0].type;
    submitGameUpdate(page, updates, "特殊行动", result.logMsg);
  } else {
    updates[`gameState.pendingActions`] = [];
    updates[`gameState.actionMode`] = null;
    updates[`gameState.actionText`] = null;
    console.log('🦝 浣熊行动结束，准备摸牌');
    await finalizeAction(page, updates, result.logMsg);
  }

  return true;
}

/**
 * 处理从空地拿牌行动
 */
async function handleClearingPickAction(page) {
  const { playerStates, openId, clearing, selectedClearingIdx, gameState } = page.data;
  const myState = playerStates[openId];

  const context = {
    gameState,
    playerState: myState,
    clearing,
    selectedClearingIdx,
    openId,
    actionConfig: gameState.actionConfig
  };

  const result = SpecialActionUtils.handleAction(gameState.actionMode, context);

  if (!result.success) {
    wx.showToast({ title: result.errorMsg || "请选择空地牌", icon: "none" });
    return false;
  }

  const updates = { ...result.updates };

  // 清除本地选择
  page.setData({ selectedClearingIdx: -1 });

  // 如果有放入洞穴的卡片，创建动画事件
  if (result.cavedCards && result.cavedCards.length > 0) {
    updates['gameState.lastEvent'] = {
      type: 'CAVE_CARDS',
      playerOpenId: openId,
      playerNick: page.data.players.find(p => p.openId === openId)?.nickName || '玩家',
      playerAvatar: page.data.players.find(p => p.openId === openId)?.avatarUrl || '',
      cavedCards: result.cavedCards.map(c => Utils.enrichCard(c)),
      count: result.cavedCards.length,
      timestamp: Date.now()
    };
  }

  // 如果有拿入手牌的卡片，创建动画事件
  if (result.takenCards && result.takenCards.length > 0) {
    const takeEvent = {
      type: 'TAKE_CARD',
      playerOpenId: openId,
      playerNick: page.data.players.find(p => p.openId === openId)?.nickName || '玩家',
      playerAvatar: page.data.players.find(p => p.openId === openId)?.avatarUrl || '',
      mainCard: Utils.enrichCard(result.takenCards[0]), // 目前一次只拿一张
      timestamp: Date.now()
    };

    // 如果已经有 lastEvent (例如同时发生了放洞穴?), 则需要合并或者做成数组
    // 但此处 handleClearingPickAction 互斥, 要么进洞要么进手
    updates['gameState.lastEvent'] = takeEvent;
  }

  const remaining = (gameState.pendingActions || []).slice(1);
  if (remaining.length > 0) {
    updates[`gameState.pendingActions`] = remaining;
    updates[`gameState.actionMode`] = remaining[0].type;
    submitGameUpdate(page, updates, "特殊行动", result.logMsg);
  } else {
    updates[`gameState.pendingActions`] = [];
    updates[`gameState.actionMode`] = null;
    updates[`gameState.actionText`] = null;
    await finalizeAction(page, updates, result.logMsg);
  }

  return true;
}

module.exports = {
  handleTuckAction,
  handleRaccoonAction,
  handleClearingPickAction
};
