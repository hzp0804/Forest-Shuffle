// pages/score/score.js
Page({
  data: {
    scores: {
      trees: '',
      top: '',
      bottom: '',
      side: '',
      bonus: ''
    },
    totalScore: 0
  },

  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    this.setData({
      [`scores.${field}`]: value
    });

    this.calculateTotal();
  },

  calculateTotal() {
    const s = this.data.scores;
    // Helper to safely parse int
    const v = (val) => parseInt(val) || 0;
    
    const total = v(s.trees) + v(s.top) + v(s.bottom) + v(s.side) + v(s.bonus);
    
    this.setData({ totalScore: total });
  },

  onReset() {
    this.setData({
      scores: {
        trees: '',
        top: '',
        bottom: '',
        side: '',
        bonus: ''
      },
      totalScore: 0
    });
  }
})
