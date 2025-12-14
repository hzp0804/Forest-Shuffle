// app.js
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }

    // 使用当前云环境，避免请求落到错误环境导致数据库看不到数据
    wx.cloud.init({
      env: wx.cloud.DYNAMIC_CURRENT_ENV,
      traceUser: true,
    });
    console.log('wx.cloud.init called with DYNAMIC_CURRENT_ENV');

    this.globalData = {};
  }
});
