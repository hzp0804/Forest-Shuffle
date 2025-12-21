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

    // 执行状态清理和最终结算
    await finalizeAction(page, updates, logMsg);

  } catch (e) {
    console.error(e);
    wx.hideLoading();
  }
}

/**
 * 结束特殊行动模式，执行累积奖励并可能切换回合
 * @param {Page} page 页面实例
 * @param {Object} actionUpdates - 本次行动产生的状态更新
 * @param {String} logMsg - 日志
 */
async function finalizeAction(page, actionUpdates = {}, logMsg = "") {
  const { gameState, openId, playerStates } = page.data;
  const myState = playerStates[openId];

  const updates = { ...actionUpdates };

  // 1. 清理特殊行动状态
  updates['gameState.actionMode'] = null;
  updates['gameState.actionText'] = null;
  updates['gameState.pendingActions'] = [];

  // 2. 处理累积奖励 (drawCount, extraTurn)
  // 优先使用 actionUpdates 中的 accumulatedRewards（如果是棕熊自动触发的情况）
  const rewards = actionUpdates['gameState.accumulatedRewards'] || gameState.accumulatedRewards || { drawCount: 0, extraTurn: false };
  const baseDraw = rewards.drawCount || 0;
  const pendingDraw = page.pendingDrawCount || 0;
  const totalDraw = baseDraw + pendingDraw;
  page.pendingDrawCount = 0; // 重置

  console.log('📊 finalizeAction 统计:', {
    累积奖励摸牌: baseDraw,
    待处理摸牌: pendingDraw,
    总计摸牌: totalDraw,
    是否获得额外回合: rewards.extraTurn
  });

  let newHand = actionUpdates[`gameState.playerStates.${openId}.hand`] ?
    [...actionUpdates[`gameState.playerStates.${openId}.hand`]] :
    [...(myState.hand || [])];

  let newDeck = [...page.data.deck];
  const currentSize = newHand.length;
  const maxCanDraw = 10 - currentSize;
  const actualDraw = Math.min(totalDraw, maxCanDraw);

  let currentWinterCount = gameState.winterCardCount || 0;
  let allEvents = [];

  // 2.1 执行奖励摸牌 (使用带冬季卡检测的逻辑)
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

  console.log(`✅ 实际摸牌: ${actualDraw} 张 (手牌: ${currentSize} -> ${newHand.length})`);

  updates[`gameState.playerStates.${openId}.hand`] = DbHelper.cleanHand(newHand);
  updates[`gameState.deck`] = DbHelper.cleanDeck(newDeck);
  updates[`gameState.winterCardCount`] = currentWinterCount;

  // 创建奖励抽牌事件（仅包含实际摸到的普通牌）
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
    // 添加到事件列表
    allEvents.push(rewardDrawEvent);
  }

  // === 处理累积的翻牌 (回合结束时统一翻牌) ===
  const pendingReveal = Math.max(page.pendingRevealCount || 0, rewards.revealCount || 0);

  if (pendingReveal > 0) {
    console.log(`🎴 回合结束，开始翻牌: ${pendingReveal} 张`);

    const isFreshUpdate = !!actionUpdates[`gameState.clearing`];
    let newClearing = isFreshUpdate ?
      [...actionUpdates[`gameState.clearing`]] :
      [...(page.data.clearing || [])];

    // 2.2 执行翻牌 (使用带冬季卡检测的逻辑)
    const revealRes = processDrawWithWinter(page, newDeck, pendingReveal, currentWinterCount);
    newDeck = revealRes.newDeck; // 更新牌堆
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
  console.log('🔄 翻牌计数器已重置为 0');

  // 2.5. 检查空地是否需要清空（达到10张时清空）
  const currentClearing = updates['gameState.clearing'] || page.data.clearing || [];
  if (currentClearing.length >= 10) {
    console.log(`🧹 空地达到 ${currentClearing.length} 张，触发清空`);
    updates['gameState.clearing'] = [];
    updates['gameState.notificationEvent'] = db.command.set(createClearingNotification());
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
    // 有额外回合，继续是当前玩家，但也视为新的回合(turnCount + 1)
    updates["gameState.turnCount"] = db.command.inc(1);
    updates["gameState.turnAction"] = { drawnCount: 0, takenCount: 0 };

    // 添加额外回合提示
    updates['gameState.notificationEvent'] = db.command.set(createExtraTurnEvent(page));
  }

  // 4. 重置累积奖励数据
  updates['gameState.accumulatedRewards'] = { drawCount: 0, extraTurn: false };

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
