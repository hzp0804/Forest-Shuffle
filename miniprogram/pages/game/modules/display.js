const Utils = require("../../../utils/utils");

/**
 * 显示卡片详情
 */
function onShowDetail(page, e) {
  const { uid, idx, type, cardid, treeid, side } = e.currentTarget.dataset;
  let cardId = cardid;
  let cardData = null;
  let isInForest = false;
  let activeSide = null;

  // 根据来源获取卡片 ID 和完整数据
  if (type === 'clearing') {
    const clearingCard = page.data.clearing[idx];
    cardId = clearingCard?.id;
    cardData = clearingCard;
    isInForest = false;
  } else if (type === 'hand') {
    const handCard = page.data.playerStates[page.data.openId]?.hand?.find(c => c.uid === uid);
    cardId = handCard?.id;
    cardData = handCard;
    isInForest = false;
  } else if (treeid && side) {
    // 森林中的槽位卡片（通过 treeid 和 side 定位）
    const myForest = page.data.myForest;
    const tree = myForest?.find(t => t._id === treeid);
    const slotCard = tree?.slots?.[side];
    cardId = slotCard?.id;
    cardData = slotCard;
    isInForest = true;
    activeSide = side; // 记录生效的物种侧
  } else if (treeid && !side) {
    // 森林中的树木中心（只有 treeid，没有 side）
    const myForest = page.data.myForest;
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
      forest: page.data.playerStates[page.data.openId]?.forest || [],
      cave: page.data.playerStates[page.data.openId]?.cave || [] // 添加 cave 字段
    } : null;

    page.setData({
      detailCardId: cardId,
      detailCardData: cardData,
      detailGameContext: gameContext,
      detailInGame: isInForest,
      detailActiveSide: activeSide
    });
  }
}

/**
 * 关闭卡片详情
 */
function onCloseDetail(page) {
  page.setData({
    detailCardId: null,
    detailCardData: null,
    detailGameContext: null,
    detailInGame: false,
    detailActiveSide: null
  });
}

/**
 * 显示森林中的常驻效果(Buff)
 */
function onShowBuffs(page) {
  const { playerStates, openId, selectedPlayerOpenId } = page.data;
  const viewingId = selectedPlayerOpenId || openId;
  const forest = playerStates[viewingId]?.forest || [];
  const { TRIGGER_TYPES } = require("../../../data/enums");

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
}

/**
 * 森林区域 Swiper 切换逻辑
 */
function onForestSwiperChange(page, e) {
  const { current, source } = e.detail;

  // 只处理用户主动滑动，忽略程序设置导致的变化
  if (source !== 'touch') return;

  const { players } = page.data;
  if (!players || players.length === 0 || current >= players.length) return;

  const nextPlayer = players[current];
  const targetState = page.data.gameState.playerStates[nextPlayer.openId];
  const syncedSlot = targetState?.selectedSlot || null;

  page.setData({
    currentForestIndex: current,
    selectedPlayerOpenId: nextPlayer.openId,
    viewingPlayerNick: nextPlayer.nickName || '玩家',
    isViewingSelf: nextPlayer.openId === page.data.openId,
    forestScrollTop: 0,
    selectedSlot: syncedSlot
  });
}

module.exports = {
  onShowDetail,
  onCloseDetail,
  onShowBuffs,
  onForestSwiperChange
};
