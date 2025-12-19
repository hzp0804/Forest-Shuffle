# 游戏页面实时推送优化方案

## 当前问题

- 游戏页面使用 1 秒轮询,消耗资源且有延迟
- Lobby 页面已经实现了实时推送,但游戏页面没有

## 优化方案

### 1. 在 game.js 中添加实时监听

```javascript
// 在 onLoad 或 onShow 中初始化
initGameWatcher(roomId) {
  if (this.gameWatcher) return;
  console.log("开始监听游戏数据:", roomId);

  const db = wx.cloud.database();
  this.gameWatcher = db
    .collection("rooms")
    .doc(roomId)
    .watch({
      onChange: (snapshot) => {
        if (!snapshot.docs || snapshot.docs.length === 0) {
          wx.showToast({ title: "房间已解散", icon: "none" });
          wx.navigateBack();
          return;
        }

        const serverData = snapshot.docs[0];
        const gameState = serverData.gameState || {};

        // 复用现有的数据处理逻辑
        this.processGameUpdate(serverData);
      },
      onError: (err) => {
        console.error("监听错误:", err);
        // 降级到轮询
        this.startPolling();
      },
    });
}

// 处理游戏更新的统一方法
processGameUpdate(serverData) {
  const gameState = serverData.gameState || {};
  const processedData = Utils.processGameData({ data: serverData }, this.data);

  // ... 现有的事件队列、回合切换逻辑
  // (从 queryGameData 中提取出来)

  this.setData(processedData, () => {
    // 处理事件队列
    if (added || processedData.pendingTurnToast) {
      this.processNextEvent();
    }
  });
}

// 修改 onShow
onShow() {
  this.initGameWatcher(this.data.roomId);
  // 保留轮询作为降级方案
  // this.startPolling();
}

// 修改 onHide
onHide() {
  if (this.gameWatcher) {
    this.gameWatcher.close();
    this.gameWatcher = null;
  }
  this.stopPolling();
}
```

### 2. 混合模式:实时推送 + 定期校验

```javascript
// 使用实时推送作为主要方式
initGameWatcher(roomId) {
  // ... 同上
}

// 使用轻量级轮询作为校验(降低频率到 5-10 秒)
startVerifyPolling() {
  this.stopPolling();
  if (!this.data.roomId) return;

  this.pollingTimer = setInterval(() => {
    // 只做数据校验,不触发动画
    this.verifyGameData(this.data.roomId);
  }, 5000); // 5秒校验一次
}

verifyGameData(roomId) {
  db.collection("rooms").doc(roomId).get().then(res => {
    // 对比本地和服务器数据
    // 如果发现不一致,触发一次完整同步
    if (this.detectDataMismatch(res.data)) {
      console.warn("检测到数据不一致,执行完整同步");
      this.processGameUpdate(res.data);
    }
  });
}
```

### 3. 优化轮询频率(如果必须使用轮询)

```javascript
// 根据游戏状态动态调整轮询频率
startPolling() {
  this.stopPolling();
  if (!this.data.roomId) return;

  // 根据是否是自己的回合调整频率
  const interval = this.data.isMyTurn ? 1000 : 2000;

  this.queryGameData(this.data.roomId);
  this.pollingTimer = setInterval(() => {
    this.queryGameData(this.data.roomId);
  }, interval);
}

// 在回合切换时重新调整
onTurnChange() {
  this.startPolling(); // 重新设置间隔
}
```

## 优缺点对比

### 实时推送

✅ 优点:

- 延迟低,实时性好
- 节省资源,不需要频繁请求
- 微信官方推荐方式

❌ 缺点:

- 有并发连接数限制
- 可能存在推送丢失
- 需要处理断线重连

### 轮询

✅ 优点:

- 实现简单,逻辑清晰
- 保证数据完整性
- 不受连接数限制

❌ 缺点:

- 延迟较高(1 秒)
- 消耗资源(频繁请求)
- 可能造成数据库压力

### 混合模式(推荐)

✅ 优点:

- 结合两者优势
- 实时推送 + 定期校验
- 可靠性最高

❌ 缺点:

- 实现复杂度较高
- 需要处理数据去重

## 实施建议

1. **短期**: 优化轮询频率,根据游戏状态动态调整
2. **中期**: 实现实时推送,保留轮询作为降级方案
3. **长期**: 使用混合模式,确保数据一致性

## 注意事项

1. 实时推送需要处理断线重连
2. 需要做好数据去重(避免重复触发动画)
3. 考虑网络不稳定的情况
4. 监控推送延迟和丢失率
