const { CARDS_DATA, getCardVisual } = require("../../data/cardData.js");

Page({
  data: {
    card: null,
  },

  onLoad: function (options) {
    const cardId = options.id;
    if (cardId && CARDS_DATA[cardId]) {
      const c = CARDS_DATA[cardId];
      const visual = getCardVisual(c);

      this.setData({
        card: {
          ...c,
          id: cardId,
          bgImg: visual.bgImg,
          bgSize: visual.bgSize,
          cssClass: `card-${cardId}`,
        },
      });

      wx.setNavigationBarTitle({
        title: `Card #${cardId}`,
      });
    }
  },
});
