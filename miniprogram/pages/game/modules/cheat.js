const { getCardInfoById } = require("../../../utils/getCardInfoById");
const DbHelper = require("../../../utils/dbHelper.js");

/**
 * 金手指相关功能
 */

/**
 * 打开金手指面板
 */
function onCheatAddCards(page) {
  page.setData({ cheatVisible: true });
}

/**
 * 关闭金手指面板
 */
function closeCheatModal(page) {
  page.setData({ cheatVisible: false });
}

/**
 * 选择金手指卡片
 */
function onCheatCardSelect(page, e) {
  const cardId = e.detail.cardId;
  const { playerStates, openId } = page.data;
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

  const { submitGameUpdate } = require("./core.js");
  const updates = {
    [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(hand)
  };

  submitGameUpdate(page, updates, "金手指", `添加了 ${rawInfo.name}`);
  wx.showToast({ title: '已添加', icon: 'success', duration: 500 });
}

/**
 * 预览金手指卡片
 */
function onCheatCardPreview(page, e) {
  const cardId = e.detail.cardId;
  page.setData({ detailCardId: cardId });
}

module.exports = {
  onCheatAddCards,
  closeCheatModal,
  onCheatCardSelect,
  onCheatCardPreview
};
