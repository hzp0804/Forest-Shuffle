const Utils = require("../../../utils/utils");
const SpecialActionUtils = require("../../../utils/specialAction.js");
const DbHelper = require("../../../utils/dbHelper.js");
const RoundUtils = require("../../../utils/round.js");
const { processDrawWithWinter } = require("./draw.js");
const { submitGameUpdate, createExtraTurnEvent, createClearingNotification } = require("./core.js");
const db = wx.cloud.database();

/**
 * 确认执行当前模式下的特殊行动
 */
async function onConfirmSpecialAction(page) {
  const { gameState, openId, playerStates, primarySelection } = page.data;
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
      clearing: page.data.clearing,
      selectedClearingIdx: page.data.selectedClearingIdx,
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
      page.pendingDrawCount = actionResult.drawCount;
    }

    // 检查是否有后续行动
    const currentPending = page.data.gameState.pendingActions || [];
    const remainingActions = currentPending.slice(1);

    if (remainingActions.length > 0) {
      console.log('🔄 还有后续特殊行动，继续执行:', remainingActions[0]);

      const nextAction = remainingActions[0];
      updates['gameState.pendingActions'] = remainingActions;
      updates['gameState.actionMode'] = nextAction.type;
      updates['gameState.actionText'] = nextAction.actionText || null;

      // 创建通知
      updates['gameState.notificationEvent'] = db.command.set({
        type: 'NOTIFICATION',
        playerOpenId: openId,
        playerNick: myState.nickName || '玩家',
        playerAvatar: myState.avatarUrl || '',
        icon: '⚡',
        message: `即将执行: ${nextAction.actionText || nextAction.text || '下一步行动'}`,
        timestamp: Date.now()
      });

      await submitGameUpdate(page, updates, "行动步骤完成", logMsg);
    } else {
      // 执行状态清理和最终结算
      await finalizeAction(page, updates, logMsg);
    }

  } catch (e) {
    console.error(e);
    wx.hideLoading();
  }
}

/**
 * 回合结束处理函数
 * 
 * 执行固定的回合结束流程:
 * 1. 清理行动状态(actionMode, pendingActions)
 * 2. 奖励摸牌(给玩家)
 * 3. 翻牌到空地(根据树木数量)
 * 4. 清空空地(雌性野猪强制清空 或 数量≥10)
 * 5. 判断是否新回合(额外回合 或 切换玩家)
 */
async function finalizeAction(page, actionUpdates = {}, logMsg = "") {
  const { gameState, openId, playerStates } = page.data;
  const myState = playerStates[openId];

  const updates = { ...actionUpdates };

  // ========== 步骤1: 清理行动状态 ==========
  updates['gameState.actionMode'] = null;
  updates['gameState.actionText'] = null;
  updates['gameState.pendingActions'] = [];

  // ========== 步骤2: 准备奖励摸牌 ==========
  const rewards = actionUpdates['gameState.accumulatedRewards'] || gameState.accumulatedRewards || {
    drawCount: 0,
    extraTurn: false,
    removeClearingFlag: false,
    clearingToCaveFlag: false
  };

  const baseDraw = rewards.drawCount || 0;
  const pendingDraw = page.pendingDrawCount || 0;
  const totalDraw = baseDraw + pendingDraw;
  page.pendingDrawCount = 0; // 重置

  console.log('📊 回合结束统计:', {
    奖励摸牌: baseDraw,
    待处理摸牌: pendingDraw,
    总计摸牌: totalDraw,
    额外回合: rewards.extraTurn,
    强制清空空地: rewards.removeClearingFlag
  });

  let newHand = actionUpdates[`gameState.playerStates.${openId}.hand`] ?
    [...actionUpdates[`gameState.playerStates.${openId}.hand`]] :
    [...(myState.hand || [])];

  // 优先使用 actionUpdates 中的 deck (如果已经在 playNormal 中处理过抽牌)
  let newDeck = actionUpdates[`gameState.deck`] ?
    [...actionUpdates[`gameState.deck`]] :
    [...page.data.deck];

  console.log('🎴 finalizeAction 初始化牌堆:', {
    使用actionUpdates: !!actionUpdates[`gameState.deck`],
    牌堆数量: newDeck.length
  });

  const currentSize = newHand.length;
  const maxCanDraw = 10 - currentSize;
  const actualDraw = Math.min(totalDraw, maxCanDraw);

  let currentWinterCount = gameState.winterCardCount || 0;
  let allEvents = [];

  // 如果 actionUpdates 中有 lastEvent (如 PLAY_CARD),先添加到事件列表
  if (actionUpdates['gameState.lastEvent']) {
    const playEvent = actionUpdates['gameState.lastEvent'];
    allEvents.push(playEvent);
    console.log('📢 添加打出卡牌事件到事件列表:', playEvent.type);
  }

  // ========== 步骤2: 执行奖励摸牌(给玩家) ==========
  const drawRes = processDrawWithWinter(page, newDeck, actualDraw, currentWinterCount);
  newDeck = drawRes.newDeck;
  currentWinterCount = drawRes.winterCount;
  allEvents.push(...drawRes.events);

  // 将摸到的牌加入手牌
  newHand.push(...drawRes.drawnCards);

  // 检查游戏结束
  if (drawRes.gameOver) {
    handleGameOver(page, newDeck, currentWinterCount, allEvents);
    return;
  }

  console.log(`✅ 奖励摸牌完成: ${actualDraw} 张 (手牌: ${currentSize} -> ${newHand.length})`);

  updates[`gameState.playerStates.${openId}.hand`] = DbHelper.cleanHand(newHand);
  updates[`gameState.deck`] = DbHelper.cleanDeck(newDeck);
  updates[`gameState.winterCardCount`] = currentWinterCount;

  // 创建奖励抽牌事件
  if (drawRes.drawnCards.length > 0) {
    const rewardDrawEvent = {
      type: 'REWARD_DRAW',
      playerOpenId: openId,
      playerNick: page.data.players.find(p => p.openId === openId)?.nickName || '玩家',
      playerAvatar: page.data.players.find(p => p.openId === openId)?.avatarUrl || '',
      count: drawRes.drawnCards.length,
      drawnCards: drawRes.drawnCards.map(c => Utils.enrichCard(c)),
      timestamp: Date.now()
    };
    allEvents.push(rewardDrawEvent);
  }

  // ========== 步骤3: 翻牌到空地(根据树木数量) ==========
  const pendingReveal = Math.max(page.pendingRevealCount || 0, rewards.revealCount || 0);

  if (pendingReveal > 0) {
    console.log(`🎴 开始翻牌到空地: ${pendingReveal} 张`);

    const isFreshUpdate = !!actionUpdates[`gameState.clearing`];
    let newClearing = isFreshUpdate ?
      [...actionUpdates[`gameState.clearing`]] :
      [...(page.data.clearing || [])];

    // 执行翻牌
    const revealRes = processDrawWithWinter(page, newDeck, pendingReveal, currentWinterCount);
    newDeck = revealRes.newDeck;
    currentWinterCount = revealRes.winterCount;
    allEvents.push(...revealRes.events);

    // 检查游戏结束
    if (revealRes.gameOver) {
      handleGameOver(page, newDeck, currentWinterCount, allEvents);
      return;
    }

    const revealedCards = revealRes.drawnCards;

    if (revealedCards.length > 0) {
      revealedCards.forEach(c => newClearing.push({ ...c, selected: false }));

      if (isFreshUpdate) {
        updates[`gameState.clearing`] = DbHelper.cleanClearing(newClearing);
      } else {
        updates[`gameState.clearing`] = db.command.push({
          each: DbHelper.cleanClearing(revealedCards)
        });
      }

      updates[`gameState.deck`] = DbHelper.cleanDeck(newDeck);
      updates[`gameState.winterCardCount`] = currentWinterCount;

      const mainCard = revealedCards[revealedCards.length - 1];
      const deckRevealEvent = {
        type: 'DECK_TO_CLEARING',
        playerNick: page.data.players.find(p => p.openId === openId)?.nickName || '玩家',
        playerAvatar: page.data.players.find(p => p.openId === openId)?.avatarUrl || '',
        mainCard: Utils.enrichCard(mainCard),
        revealedCards: revealedCards.map(c => Utils.enrichCard(c)),
        count: revealedCards.length,
        timestamp: Date.now() + 100
      };
      allEvents.push(deckRevealEvent);
      console.log(`✅ 翻牌完成: ${revealedCards.length} 张卡牌已放入空地`);
    }
  }

  // 统一处理事件列表
  updates['gameState.lastEvent'] = allEvents;
  updates['gameState.rewardDrawEvent'] = null;
  updates['gameState.deckRevealEvent'] = null;

  // 重置翻牌计数器
  page.pendingRevealCount = 0;

  // ========== 步骤3.5: 棕熊效果-将空地卡牌放入洞穴 ==========
  const shouldClearingToCave = rewards.clearingToCaveFlag || false;

  console.log('🐻 检查棕熊效果:', { shouldClearingToCave });

  if (shouldClearingToCave) {
    let currentClearing = [];
    if (updates['gameState.clearing'] && Array.isArray(updates['gameState.clearing'])) {
      currentClearing = updates['gameState.clearing'];
    } else {
      currentClearing = page.data.clearing || [];
    }

    if (currentClearing.length > 0) {
      // 将空地卡牌放入当前玩家的洞穴
      const currentCave = updates[`gameState.playerStates.${openId}.cave`] || myState.cave || [];
      const newCave = [...currentCave, ...currentClearing];

      updates[`gameState.playerStates.${openId}.cave`] = DbHelper.cleanHand(newCave);
      updates['gameState.clearing'] = [];

      console.log(`🐻 棕熊效果执行: 将空地上的 ${currentClearing.length} 张卡牌放入洞穴`);

      // 创建洞穴收入事件
      const caveEvent = {
        type: 'CAVE_CARDS',
        playerOpenId: openId,
        playerNick: page.data.players.find(p => p.openId === openId)?.nickName || '玩家',
        playerAvatar: page.data.players.find(p => p.openId === openId)?.avatarUrl || '',
        cards: currentClearing.map(c => Utils.enrichCard(c)),
        count: currentClearing.length,
        timestamp: Date.now() + 150
      };
      allEvents.push(caveEvent);
    } else {
      console.log('🐻 棕熊效果跳过: 空地无牌');
    }
  }

  // ========== 步骤4: 清空空地判断 ==========
  const currentClearing = updates['gameState.clearing'] || page.data.clearing || [];
  const shouldRemoveClearing = rewards.removeClearingFlag || false;

  if (shouldRemoveClearing) {
    // 雌性野猪效果:强制清空空地(不判断数量)
    console.log('🐗 雌性野猪效果:强制清空空地');
    updates['gameState.clearing'] = [];

    // 创建清空空地通知事件
    const clearEvent = createClearingNotification();
    clearEvent.timestamp = Date.now() + 200;
    allEvents.push(clearEvent);

    // updates['gameState.notificationEvent'] = db.command.set(createClearingNotification());
  } else if (currentClearing.length >= 10) {
    // 正常情况:空地达到10张时清空
    console.log(`🧹 空地达到 ${currentClearing.length} 张,触发清空`);
    updates['gameState.clearing'] = [];

    // 创建清空空地通知事件
    const clearEvent = createClearingNotification();
    clearEvent.timestamp = Date.now() + 200;
    allEvents.push(clearEvent);

    // updates['gameState.notificationEvent'] = db.command.set(createClearingNotification());
  }

  // ========== 步骤5: 判断是否新回合 ==========
  if (!rewards.extraTurn) {
    // 没有额外回合,切换到下一个玩家
    const turnOrder = gameState.turnOrder || [];
    const curIdx = turnOrder.indexOf(openId);
    const nextIdx = (curIdx + 1) % turnOrder.length;
    updates['gameState.activePlayer'] = turnOrder[nextIdx];
    updates["gameState.turnReason"] = "normal";
    updates["gameState.turnCount"] = db.command.inc(1);
    updates["gameState.turnAction"] = { drawnCount: 0, takenCount: 0 };
    console.log(`🔄 回合结束,切换到下一个玩家`);
  } else {
    // 有额外回合,继续是当前玩家
    updates["gameState.turnCount"] = db.command.inc(1);
    updates["gameState.turnAction"] = { drawnCount: 0, takenCount: 0 };

    // 添加额外回合事件到事件列表(确保时间戳晚于前面的事件)
    const extraTurnEvent = createExtraTurnEvent(page);
    extraTurnEvent.timestamp = Date.now() + 300;
    allEvents.push(extraTurnEvent);

    console.log(`🎁 获得额外回合,继续当前玩家`);
  }

  // 重置累积奖励
  updates['gameState.accumulatedRewards'] = {
    drawCount: 0,
    extraTurn: false,
    removeClearingFlag: false,
    clearingToCaveFlag: false
  };

  await submitGameUpdate(page, updates, "行动完成", logMsg);
}

/**
 * 辅助方法：处理游戏结束
 */
function handleGameOver(page, newDeck, winterCount, events) {
  const updates = {
    [`gameState.deck`]: DbHelper.cleanDeck(newDeck),
    [`gameState.winterCardCount`]: winterCount,
    [`gameState.isGameOver`]: true,
    [`gameState.gameEndReason`]: 'WINTER_CARD',
    [`gameState.gameEndTime`]: Date.now(),
    [`gameState.lastEvent`]: events
  };
  submitGameUpdate(page, updates, null, `抽到第3张冬季卡，游戏结束`);

  setTimeout(() => {
    wx.navigateTo({ url: `/pages/game-over/game-over?roomId=${page.data.roomId}` });
  }, 3000);
}

/**
 * 结束回合
 */
function onEndTurn(page) {
  // 1. 特殊行动模式下的跳过逻辑
  if (page.data.gameState && page.data.gameState.actionMode) {
    wx.showModal({
      title: '跳过行动',
      content: '确定要跳过吗？',
      success: async (res) => {
        if (res.confirm) {
          const pending = [...(page.data.gameState.pendingActions || [])];
          // 移除当前行动（头部）
          pending.shift();

          // 自动处理清空空地等不需要交互的行动
          let newClearing = [...(page.data.clearing || [])];
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
            submitGameUpdate(page, updates, "跳过行动", "跳过了当前特殊行动步骤");
          } else {
            // 没有后续，结束特殊行动模式
            await finalizeAction(page, updates, "跳过了行动");
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
        const next = RoundUtils.getNextPlayer(page.data.openId, page.data.players, false);
        submitGameUpdate(page, {
          [`gameState.activePlayer`]: next,
          [`gameState.turnCount`]: db.command.inc(1),
          [`gameState.turnAction`]: { drawnCount: 0, takenCount: 0 }
        }, "回合结束", "主动结束了回合");
      }
    }
  });
}

module.exports = {
  onConfirmSpecialAction,
  finalizeAction,
  onEndTurn
};
