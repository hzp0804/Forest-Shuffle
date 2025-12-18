# 特殊行动实现计划

## 目标

实现游戏中的特殊行动处理逻辑，包括鼹鼠、浣熊、免费打牌等效果。

## 核心规则

1. 通过效果/奖励打出的卡片：
   - ❌ 不触发该卡片自身的 Bonus 和 Effect
   - ✅ 会触发森林中的常驻效果（Trigger Effects）
2. 所有摸牌在所有行动结束后统一执行
3. 特殊行动期间，玩家只能执行特定操作

## 需要支持的特殊行动

### 1. 鼹鼠效果 (ACTION_MOLE)

- **效果**：立即支付费用打出任意数量的牌
- **限制**：只能打牌，不能摸牌
- **结束**：玩家点击"结束"按钮

### 2. 免费打牌 Bonus (PLAY_FREE_SPECIFIC)

- **效果**：免费打出一张带有指定标签的牌
- **限制**：只能打出符合条件的牌，不需要支付费用
- **结束**：打出一张牌后自动结束，或玩家选择跳过

### 3. 浣熊效果 (ACTION_RACCOON)

- **效果**：手牌换洞穴+摸牌
- **实现**：TODO

### 4. 其他特殊行动

- ACTION_BEAR：空地牌入洞穴
- FREE_PLAY_BAT：免费打出任意数量蝙蝠
- ACTION_REMOVE_CLEARING：移除空地牌
- ACTION_CLEARING_TO_CAVE：空地牌进洞穴
- ACTION_PICK_FROM_CLEARING：从空地拿牌
- ACTION_PLAY_SAPLINGS：打出树苗

## 实现步骤

### 第一阶段：数据结构设计

#### 1. 游戏状态扩展

在 `gameState` 中添加：

```javascript
{
  pendingActions: [],  // 待处理的特殊行动队列
  actionMode: null,    // 当前行动模式：null | 'MOLE' | 'FREE_PLAY' | 'RACCOON' 等
  actionContext: {},   // 行动上下文数据
  accumulatedRewards: { // 累积的奖励（在所有行动结束后统一执行）
    drawCount: 0,
    extraTurn: false
  }
}
```

#### 2. 打牌来源标记

区分打牌的来源：

```javascript
{
  source: 'PLAYER_ACTION',  // 玩家主动打牌
  source: 'MOLE_EFFECT',    // 鼹鼠效果触发
  source: 'FREE_PLAY',      // 免费打牌 Bonus
  // ...
}
```

### 第二阶段：核心函数修改

#### 1. `onConfirmPlay` 函数修改

```javascript
onConfirmPlay(source = 'PLAYER_ACTION') {
  // 1. 根据 source 决定是否计算 Bonus/Effect
  let bonus = { drawCount: 0, actions: [] };
  let effect = { drawCount: 0, actions: [] };

  if (source === 'PLAYER_ACTION') {
    bonus = calculateBonus(...);
    effect = calculateEffect(...);
  }

  // 2. 始终计算 Trigger Effects
  const triggers = calculateTriggerEffects(...);

  // 3. 累积奖励（不立即摸牌）
  accumulatedRewards.drawCount += bonus.drawCount + effect.drawCount + triggers.drawCount;
  accumulatedRewards.extraTurn = accumulatedRewards.extraTurn || bonus.extraTurn || effect.extraTurn;

  // 4. 检查是否有新的特殊行动
  const newActions = [...bonus.actions, ...effect.actions];
  if (newActions.length > 0) {
    // 进入特殊行动模式
    gameState.pendingActions = newActions;
    gameState.actionMode = detectActionMode(newActions[0]);
    // 不结束回合
  } else if (gameState.pendingActions.length > 0) {
    // 还在特殊行动模式中，继续等待
  } else {
    // 没有待处理行动，执行结算
    this.finalizeAction();
  }
}
```

#### 2. 新增 `finalizeAction` 函数

```javascript
finalizeAction() {
  // 1. 统一执行摸牌
  const actualDraw = Math.min(accumulatedRewards.drawCount, 10 - hand.length);
  for (let i = 0; i < actualDraw; i++) {
    hand.push(deck.shift());
  }

  // 2. 翻牌到空地（如果打出了树木）
  if (playedTreeCount > 0) {
    for (let i = 0; i < playedTreeCount; i++) {
      clearing.push(deck.shift());
    }
  }

  // 3. 切换玩家
  const nextPlayer = getNextPlayer(currentPlayer, players, accumulatedRewards.extraTurn);

  // 4. 清空累积奖励和待处理行动
  gameState.accumulatedRewards = { drawCount: 0, extraTurn: false };
  gameState.pendingActions = [];
  gameState.actionMode = null;

  // 5. 更新游戏状态
  // ...
}
```

#### 3. 新增 `onEndSpecialAction` 函数

```javascript
onEndSpecialAction() {
  // 玩家点击"结束"按钮，结束特殊行动
  this.finalizeAction();
}
```

### 第三阶段：UI 状态控制

#### 1. 根据 `actionMode` 显示不同的 UI

```javascript
// 正常模式
if (!actionMode) {
  显示：摸牌按钮、打出按钮、结束回合按钮
}

// 鼹鼠模式
if (actionMode === 'MOLE') {
  显示：打出按钮、结束按钮
  隐藏：摸牌按钮
  提示："鼹鼠效果：可以继续打牌"
}

// 免费打牌模式
if (actionMode === 'FREE_PLAY') {
  显示：打出按钮（仅限符合条件的牌）、跳过按钮
  隐藏：摸牌按钮
  提示："可以免费打出一张 [标签] 牌"
}
```

### 第四阶段：测试场景

#### 场景 1：鼹鼠效果

1. 打出鼹鼠（费用 2 张）
2. 进入鼹鼠模式
3. 继续打出卡片 A（费用 1 张）
4. 继续打出卡片 B（费用 1 张）
5. 点击"结束"
6. 统一摸牌（假设触发了常驻效果，摸 3 张）
7. 回合结束

#### 场景 2：免费打牌 + 常驻效果

1. 打出接骨木（同色支付，获得 Bonus：免费打出植物）
2. 进入免费打牌模式
3. 免费打出一张植物卡
4. 触发森林中的常驻效果（假设摸 1 张）
5. 自动结束免费打牌模式
6. 统一摸牌
7. 回合结束

#### 场景 3：连续特殊行动

1. 打出卡片 A（获得免费打牌 Bonus）
2. 免费打出卡片 B（鼹鼠）
3. 鼹鼠不触发自身 Effect（所以不会进入鼹鼠模式）
4. 结束免费打牌模式
5. 统一摸牌
6. 回合结束

## 注意事项

1. **摸牌时序**：所有摸牌必须在 `finalizeAction` 中统一执行
2. **效果嵌套**：免费打出的鼹鼠不会触发鼹鼠效果
3. **手牌上限**：摸牌时要检查手牌上限（10 张）
4. **状态清理**：每次 `finalizeAction` 后要清空累积奖励和待处理行动

## 优先级

1. **高优先级**：鼹鼠效果、免费打牌 Bonus
2. **中优先级**：浣熊效果、免费打蝙蝠
3. **低优先级**：其他特殊行动

## 下一步

先实现鼹鼠效果和免费打牌 Bonus，验证整体架构是否正确。
