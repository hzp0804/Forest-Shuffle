# 插槽容量功能重构任务

## 问题描述

当前代码不支持多张卡片共享同一个插槽，但游戏中有以下效果需要这个功能：

- **CAPACITY_INCREASE**：大蟾蜍 - 该插槽最多可容纳 2 只大蟾蜍
- **CAPACITY_UNLIMITED**：欧洲野兔 - 无限容量
- **CAPACITY_SHARE_SLOT**：荨麻 - 允许共享槽位

## 当前实现

```javascript
// 数据结构
slots: { top: card, bottom: card, left: card, right: card }

// 赋值逻辑 (game.js:281)
tTree.slots[selectedSlot.side] = primaryCard;
```

## 需要改为

```javascript
// 数据结构
slots: { top: [card1, card2], bottom: [], left: [card], right: [] }

// 赋值逻辑
// 1. 检查插槽容量限制
// 2. 检查是否允许共享（根据卡片效果）
// 3. 添加到数组
if (canAddToSlot(tTree.slots[selectedSlot.side], primaryCard)) {
  tTree.slots[selectedSlot.side].push(primaryCard);
}
```

## 影响范围

### 1. 数据结构初始化

- `game.js:275` - 创建新树时初始化插槽
- `game.js:280` - 确保插槽存在时初始化
- 需要改为：`slots: { top: [], bottom: [], left: [], right: [] }`

### 2. 读取插槽的代码

需要查找所有读取 `slots[side]` 的地方，改为处理数组：

- 显示 UI 时遍历数组
- 计算得分时遍历数组
- 触发效果时遍历数组

### 3. 容量检查逻辑

新增函数：

```javascript
function canAddToSlot(slotCards, newCard) {
  // 1. 检查插槽是否为空
  if (slotCards.length === 0) return true;

  // 2. 检查是否有容量增加效果
  const capacityEffects = slotCards.filter(
    (c) =>
      c.effectConfig?.type === EFFECT_TYPES.CAPACITY_INCREASE ||
      c.effectConfig?.type === EFFECT_TYPES.CAPACITY_UNLIMITED ||
      c.effectConfig?.type === EFFECT_TYPES.CAPACITY_SHARE_SLOT
  );

  // 3. 根据效果判断是否可以添加
  // ...
}
```

### 4. UI 显示

- 插槽显示需要支持多张卡片堆叠显示
- 可能需要特殊的视觉效果（如：2 只大蟾蜍重叠显示）

### 5. 计分逻辑

- `score.js` 中所有遍历森林卡片的地方
- 需要遍历插槽数组中的每张卡片

### 6. 常驻效果触发

- `effect.js` 中的 `calculateTriggerEffects` 函数
- 已经在遍历所有卡片，应该不受影响

## 实施步骤

1. **数据结构迁移**

   - 修改初始化逻辑，将插槽改为数组
   - 添加数据迁移逻辑（兼容旧数据）

2. **赋值逻辑修改**

   - 实现 `canAddToSlot` 函数
   - 修改 `onConfirmPlay` 中的插槽赋值逻辑

3. **读取逻辑修改**

   - 查找所有 `slots[side]` 的引用
   - 改为遍历数组处理

4. **UI 更新**

   - 修改插槽显示组件
   - 支持多张卡片堆叠显示

5. **测试**
   - 测试大蟾蜍：2 只共享插槽
   - 测试欧洲野兔：无限容量
   - 测试普通卡片：不能共享

## 优先级

**中等** - 这是一个重要功能，但不影响基本游戏流程

## 预计工作量

**4-6 小时** - 涉及多个文件的修改和测试
