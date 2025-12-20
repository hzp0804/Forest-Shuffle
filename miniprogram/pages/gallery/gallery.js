Page({
  data: {
    previewCardId: null
  },

  onCardSelect: function (e) {
    // In Gallery mode, select (tap) means preview
    const { cardId } = e.detail;
    if (cardId) {
      this.setData({ previewCardId: cardId });
    }
  },

  onClosePreview: function () {
    this.setData({ previewCardId: null });
  }
});
