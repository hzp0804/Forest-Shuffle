const Utils = require("../../../utils/utils");
const db = wx.cloud.database();

/**
 * 处理玩家头像点击
 */
function onPlayerTap(page, e) {
  const opid = e.currentTarget.dataset.openid;
  if (!opid) return;

  // 纯本地操作:只更新查看的玩家ID,重新计算显示的森林
  const viewingPlayerState = page.data.playerStates?.[opid];
  const displayForest = viewingPlayerState?.forest || [];
  const viewingPlayer = page.data.players.find(p => p && p.openId === opid);

  const targetState = page.data.playerStates?.[opid];
  // 关键修复：无论切到谁（包括自己），都从 playerStates 中获取最新的同步状态
  // 这样即使离开后再回来，也能看到最新的选中插槽
  const syncedSlot = targetState?.selectedSlot || null;

  // 计算目标玩家在 players 数组中的索引，用于控制 swiper
  const targetIndex = page.data.players.findIndex(p => p && p.openId === opid);

  page.setData({
    selectedPlayerOpenId: opid,
    myForest: displayForest,
    viewingPlayerNick: viewingPlayer?.nickName || '玩家',
    isViewingSelf: opid === page.data.openId,
    forestScrollTop: 0,
    // 始终使用从云端同步的最新状态
    selectedSlot: syncedSlot,
    // 更新 swiper 索引，触发页面切换
    currentForestIndex: targetIndex >= 0 ? targetIndex : 0
  });
}

/**
 * 处理手牌点击
 */
function onHandTap(page, e) {
  // 只有在自己的回合才能点击手牌
  if (!page.data.isMyTurn) {
    wx.showToast({ title: "不是你的回合", icon: "none", duration: 1000 });
    return;
  }
  // 如果已经摸了一张牌，禁止选手牌，强制继续摸牌
  if (page.data.turnAction?.drawnCount === 1) {
    wx.showToast({ title: "请再摸一张牌或结束回合", icon: "none", duration: 1500 });
    return;
  }
  const updates = Utils.handleHandTap(e.currentTarget.dataset.uid, page.data);
  if (updates) page.setData(updates);
}

/**
 * 处理森林槽位点击
 */
function onSlotTap(page, e) {
  if (!page.data.isMyTurn) {
    wx.showToast({ title: "不是你的回合", icon: "none" });
    return;
  }
  if (!page.data.isViewingSelf) {
    wx.showToast({ title: "只能操作自己的森林", icon: "none" });
    return;
  }
  // 如果已经摸了一张牌，禁止选插槽，强制继续摸牌
  if (page.data.turnAction?.drawnCount === 1) {
    wx.showToast({ title: "请再摸一张牌或结束回合", icon: "none", duration: 1500 });
    return;
  }
  const { treeid, side } = e.currentTarget.dataset;
  const { selectedSlot, primarySelection, gameState } = page.data;

  // 浣熊行动模式下，不需要选择插槽
  if (gameState?.actionMode === 'ACTION_RACCOON') {
    wx.showToast({ title: "请选择手牌放入洞穴", icon: "none" });
    return;
  }

  // 1. 处理取消选中 (点击已选中的槽位)
  if (selectedSlot?.treeId === String(treeid) && selectedSlot?.side === side) {
    const nextData = { ...page.data, selectedSlot: null };
    const res = Utils.computeInstruction(nextData);
    page.setData({
      selectedSlot: null,
      instructionState: res.instructionState,
      instructionText: res.instructionText,
      instructionSegments: res.instructionSegments || null,
      instructionLines: res.instructionLines || null
    });
    // 同步取消选中到数据库
    db.collection("rooms").doc(page.data.roomId).update({
      data: { [`gameState.playerStates.${page.data.openId}.selectedSlot`]: null }
    });
    return;
  }

  // 2. 准备新槽位（确保 treeId 是字符串，与 forest 中的 _id 类型一致）
  const nextSlot = { treeId: String(treeid), side, isValid: true };

  // 3. 验证槽位可用性
  if (primarySelection) {
    const { playerStates, openId } = page.data;
    const myState = playerStates[openId];
    if (!myState) return;

    const hand = myState.hand || [];
    let primaryCardRaw = hand.find(c => c.uid === primarySelection);
    if (!primaryCardRaw) return;

    // 富化卡片数据以获取完整信息（包括 tags）
    const { enrichCard } = require('../../../utils/utils');
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
    // 使用 page.data.myForest (已富化数据) 以获取完整的 effectConfig 和 name
    const myForest = page.data.myForest;
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
          if (existingCard.effectConfig?.type === 'CAPACITY_INCREASE' && existingCard.effectConfig.target === checkName) {
            allowStack = true;
            capacity = existingCard.effectConfig.value;
          } else if (existingCard.effectConfig?.type === 'CAPACITY_UNLIMITED' && existingCard.effectConfig.target === checkName) {
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
            const myForestRaw = page.data.playerStates[page.data.openId].forest;
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
    const nextData = { ...page.data, selectedSlot: nextSlot };
    const res = Utils.computeInstruction(nextData);

    // 允许选择插槽，即使费用未满足（error 状态）
    // 只在出牌时才真正校验
    // 检查奖励是否激活
    let bonusActive = false;
    if (res.instructionLines && res.instructionLines.bonus && res.instructionLines.bonus.class === "text-success") {
      bonusActive = true;
      console.log("🎉 奖励条件已满足 (Slot Selected):", res.instructionLines.bonus.text);
    }

    page.setData({
      selectedSlot: nextSlot,
      instructionState: res.instructionState,
      instructionText: res.instructionText,
      instructionSegments: res.instructionSegments || null,
      instructionLines: res.instructionLines || null,
      [`playerStates.${openId}.bonusActive`]: bonusActive
    });

    // 同步选中槽位到数据库，方便观看者实时看到
    db.collection("rooms").doc(page.data.roomId).update({
      data: { [`gameState.playerStates.${openId}.selectedSlot`]: nextSlot }
    });
  } else {
    // 未选主牌：不允许选择插槽，直接返回
    return;
  }
}

/**
 * 处理堆叠卡片点击
 */
function onStackTap(page, e) {
  const { treeid, side } = e.currentTarget.dataset;
  const myForest = page.data.playerStates[page.data.openId].forest;
  const tree = myForest.find(t => t._id === treeid);
  if (!tree) return;

  const slotCard = tree.slots[side];
  if (!slotCard) return;

  // 显示 list 中的所有卡片
  const cardsToShow = slotCard.list || [];

  page.setData({
    stackModalVisible: true,
    stackModalCards: cardsToShow
  });
}

/**
 * 处理空地卡片点击
 */
function onClearingCardTap(page, e) {
  // 只有在自己的回合才能点击空地卡牌
  if (!page.data.isMyTurn) {
    wx.showToast({ title: "不是你的回合", icon: "none", duration: 1000 });
    return;
  }
  const idx = e.currentTarget.dataset.idx;
  // Toggle selection
  page.setData({
    selectedClearingIdx: page.data.selectedClearingIdx === idx ? -1 : idx
  });
}

/**
 * 处理手牌区域展开/收起切换
 */
function onToggleHandExpanded(page) {
  page.setData({ handExpanded: !page.data.handExpanded });
}

/**
 * 手牌区域触摸开始
 */
function onHandTouchStart(page, e) {
  if (e.touches.length === 1) {
    page.handTouchStartX = e.touches[0].clientX;
    page.handTouchStartY = e.touches[0].clientY;
  }
}

/**
 * 手牌区域触摸结束 (处理滑动)
 */
function onHandTouchEnd(page, e) {
  if (e.changedTouches.length === 1) {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - page.handTouchStartX;
    const deltaY = endY - page.handTouchStartY;

    // 确保是水平滑动，且滑动距离超过 50
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX < 0) {
        // 左滑 -> 展开
        if (!page.data.handExpanded) {
          page.setData({ handExpanded: true });
        }
      } else {
        // 右滑 -> 收起
        if (page.data.handExpanded) {
          page.setData({ handExpanded: false });
        }
      }
    }
  }
}

/**
 * 空地区域触摸开始
 */
function onClearingTouchStart(page, e) {
  if (e.touches.length === 1) {
    page.clearingTouchStartX = e.touches[0].clientX;
    page.clearingTouchStartY = e.touches[0].clientY;
  }
}

/**
 * 空地区域触摸结束 (处理滑动吸附)
 */
function onClearingTouchEnd(page, e) {
  if (e.changedTouches.length === 1) {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - page.clearingTouchStartX;
    const deltaY = endY - page.clearingTouchStartY;

    // 确保是水平滑动，且滑动距离超过 30 (降低阈值更灵敏)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
      if (deltaX < 0) {
        // 左滑 -> 吸附到底部 (clearing-end-anchor)
        page.setData({ clearingScrollId: 'clearing-end-anchor' });
      } else {
        // 右滑 -> 吸附到顶部 (clearing-top)
        page.setData({ clearingScrollId: 'clearing-top' });
      }
    }
  }
}

/**
 * 处理牌库点击
 */
function onDrawCard(page) {
  // 只有在自己的回合才能点击牌库
  if (!page.data.isMyTurn) {
    wx.showToast({ title: "不是你的回合", icon: "none", duration: 1000 });
    return;
  }
  const nextIdx = page.data.selectedClearingIdx === -2 ? -1 : -2;
  page.setData({
    selectedClearingIdx: nextIdx
  });
}

module.exports = {
  onPlayerTap,
  onHandTap,
  onSlotTap,
  onStackTap,
  onClearingCardTap,
  onToggleHandExpanded,
  onHandTouchStart,
  onHandTouchEnd,
  onClearingTouchStart,
  onClearingTouchEnd,
  onDrawCard
};
