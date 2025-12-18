# 额外回合功能和手牌区文本显示修复

## 1. game.js 修改

### 在第 893 行后添加（localDeckReveal 块之后）：

```javascript
if (localExtraTurn) {
  this.addToEventQueue(localExtraTurn);
  nextLastEventTime = Math.max(nextLastEventTime, localExtraTurn.timestamp);
  added = true;
}
```

## 2. game.wxml 修改

### 在第 235 行后添加（TAKE_CARD 事件块之后）：

```xml
             <!-- 场景4: 额外回合 -->
             <block wx:if="{{currentEvent.type === 'EXTRA_TURN'}}">
                <view class="event-header">
                   <image class="p-avatar-small" src="{{currentEvent.playerAvatar || '/images/default_avatar.png'}}" />
                   <text class="event-title">🎉 {{currentEvent.playerNick}} 获得额外回合！</text>
                </view>
                <view class="extra-turn-display">
                   <view class="extra-turn-icon">🔄</view>
                   <view class="extra-turn-text">Extra Turn</view>
                </view>
             </block>
```

### 修改第 242 行（手牌区指引文本）：

将：

```xml
             <view class="instruction-tip {{instructionState}}">{{instructionText}}</view>
```

改为：

```xml
             <view wx:if="{{gameState.activePlayer === openId}}" class="instruction-tip {{instructionState}}">{{instructionText}}</view>
```

## 3. game.wxss 添加样式

在文件末尾添加：

```css
/* 额外回合显示 */
.extra-turn-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}

.extra-turn-icon {
  font-size: 120rpx;
  animation: rotate 2s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.extra-turn-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #f1c40f;
  margin-top: 20rpx;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}
```

## 修改总结：

1. ✅ game.js 已添加 extraTurnEvent 创建逻辑
2. ⚠️ game.js 需要手动添加 localExtraTurn 到事件队列
3. ⚠️ game.wxml 需要添加 EXTRA_TURN 事件显示
4. ⚠️ game.wxml 需要修改指引文本显示条件
5. ⚠️ game.wxss 需要添加额外回合样式
