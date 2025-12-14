Page({
  data: {
    gameData: null,
    myHand: [],
    roomId: ''
  },

  onLoad(options) {
    if (options.roomId) {
      this.setData({ roomId: options.roomId });
      this.initGameWatcher(options.roomId);
    }
  },

  onUnload() {
    if (this.gameWatcher) {
      this.gameWatcher.close();
    }
  },

  initGameWatcher(roomId) {
    const db = wx.cloud.database();
    this.gameWatcher = db.collection('rooms').doc(roomId).watch({
      onChange: (snapshot) => {
        if (snapshot.docs && snapshot.docs[0]) {
          const room = snapshot.docs[0];
          this.handleGameUpdate(room);
        }
      },
      onError: (err) => console.error('Game watch error', err)
    });
  },

  handleGameUpdate(room) {
    // 简单的状态同步
    // TODO: 提取自己的手牌
    const app = getApp();
    const myOpenId = app.globalData.userProfile?.openId;
    
    // 假设 gameState 结构
    const gameState = room.gameState || {};
    const myState = (gameState.playerStates || {})[myOpenId];

    this.setData({
      gameData: gameState,
      myHand: myState ? myState.hand : []
    });
  }
});
