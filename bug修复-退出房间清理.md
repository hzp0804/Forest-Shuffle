# Bug 修复: 退出房间后的清理问题

## 问题描述

1. **退出房间后还在提示回合开始** - 页面卸载后,事件队列和提示仍在触发
2. **进入其他房间时带入了上个房间的得分数据** - 得分缓存没有被清理

## 修复方案

### 1. 增强 `stopWatcher()` 函数 (game.js 第 148-172 行)

**修复内容:**

- ✅ 清空事件队列 (`eventQueue`)
- ✅ 重置事件处理状态 (`isProcessingEvent`, `currentEvent`)
- ✅ 清除待触发的提示 (`pendingTurnToast`, `pendingActionToast`)
- ✅ 清空得分缓存 (`scoreCache.clear()`)

**代码:**

```javascript
stopWatcher() {
  if (this.gameWatcher) {
    console.log("🔕 停止实时监听");
    this.gameWatcher.close();
    this.gameWatcher = null;
  }

  // 清空事件队列,防止退出后还触发动画和提示
  this.setData({
    eventQueue: [],
    isProcessingEvent: false,
    currentEvent: null,
    pendingTurnToast: false,
    pendingActionToast: null
  });

  // 清空得分缓存,防止进入其他房间时带入旧数据
  const { scoreCache } = require("../../utils/score/helpers");
  scoreCache.clear();
  console.log("🧹 已清空得分缓存");
}
```

### 2. 在 `onLoad()` 时清空缓存 (game.js 第 55-76 行)

**修复内容:**

- ✅ 进入新房间时主动清空得分缓存
- ✅ 确保每次进入房间都是干净的状态

**代码:**

```javascript
onLoad(options) {
  // ... 原有逻辑 ...

  // 清空得分缓存,确保进入新房间时数据是干净的
  const { scoreCache } = require("../../utils/score/helpers");
  scoreCache.clear();
  console.log("🧹 进入房间,已清空得分缓存");
}
```

### 3. 在 `processNextEvent()` 添加安全检查 (game.js 第 257-263 行)

**修复内容:**

- ✅ 检查 `gameWatcher` 是否存在
- ✅ 如果页面已卸载,直接返回,不处理事件
- ✅ 防止退出后异步事件仍然触发提示

**代码:**

```javascript
async processNextEvent() {
  // 安全检查: 如果监听器已关闭(页面已卸载),不再处理事件
  if (!this.gameWatcher) {
    console.log("⚠️ 页面已卸载,跳过事件处理");
    return;
  }

  // ... 原有逻辑 ...
}
```

## 测试验证

### 测试场景 1: 退出房间

1. 进入房间 A
2. 等待轮到自己的回合
3. 点击返回退出房间
4. **预期结果**: 不再收到"轮到你了"的提示 ✅

### 测试场景 2: 切换房间

1. 进入房间 A,游戏进行中
2. 退出房间 A
3. 进入房间 B (新房间)
4. **预期结果**: 房间 B 的得分从 0 开始,不会显示房间 A 的得分数据 ✅

### 测试场景 3: 重新进入同一房间

1. 进入房间 A
2. 退出
3. 再次进入房间 A
4. **预期结果**: 得分缓存被清空,会重新计算 ✅

## 关键改进

1. **生命周期管理**: 在 `onHide` 和 `onUnload` 时都调用 `stopWatcher()`
2. **状态清理**: 清空所有可能导致异步操作的状态标志
3. **缓存管理**: 主动清空得分缓存,避免跨房间污染
4. **防御性编程**: 在事件处理前检查页面状态,避免已卸载页面的操作

## 影响范围

- ✅ 不影响正常游戏流程
- ✅ 不影响实时监听功能
- ✅ 提升用户体验,避免退出后的干扰
- ✅ 确保数据隔离,每个房间独立计分
