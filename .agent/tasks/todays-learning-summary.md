# 今天学到的游戏规则和待实现功能

## 已实现 ✅

1. **TRIGGER_ON_PLAY 统一** - 已改为 TRIGGER_ON_PLAY_TAG_DRAW
2. **雌性野猪效果** - ACTION_REMOVE_CLEARING 已添加到 game.js

## 待实现功能

### 1. 插槽容量功能（高优先级）⚠️

**问题**：当前插槽只能存储单张卡片，但游戏需要支持多张卡片共享插槽

**影响的效果**：

- CAPACITY_INCREASE（大蟾蜍）：该插槽最多可容纳 2 只大蟾蜍
- CAPACITY_UNLIMITED（欧洲野兔）：无限容量
- CAPACITY_SHARE_SLOT（荨麻）：允许共享槽位

**详细计划**：`.agent/tasks/slot-capacity-refactor.md`

---

### 2. 特殊行动系统（高优先级）⚠️

**需要实现的特殊行动**：

#### 2.1 鼹鼠（ACTION_MOLE）

- 效果：支付费用打出任意数量的牌
- 流程：
  1. 打出鼹鼠 → 进入特殊行动模式
  2. 手牌区提示："🐭 鼹鼠效果：支付费用打出任意数量的牌"
  3. 玩家选择手牌 + 插槽 + 支付费用 → 打出
  4. 调用 `onConfirmPlay('MOLE_EFFECT')` → 不触发该卡的 Bonus/Effect
  5. 但会触发常驻效果
  6. 可以继续打牌，或点击"结束"
  7. 结束后 → 统一摸牌 → 进入结算

#### 2.2 蚊子（FREE_PLAY_BAT）

- 效果：免费打出任意数量的蝙蝠
- 流程：
  1. 打出蚊子 → 进入特殊行动模式
  2. 手牌区提示："🦟 蚊子效果：免费打出任意数量的蝙蝠"
  3. 只能选择带有蝙蝠标签的卡片
  4. 不需要支付费用
  5. 调用 `onConfirmPlay('FREE_PLAY_BAT')` → 不触发该卡的 Bonus/Effect
  6. 可以继续打牌，或点击"结束"

#### 2.3 水田鼠（ACTION_PLAY_SAPLINGS）

- 效果：打出任意数量的树苗
- 流程：
  1. 打出水田鼠 → 进入特殊行动模式
  2. 手牌区提示："🐭 水田鼠效果：打出任意数量的树苗"
  3. 选择手牌 → 作为树苗打出（只有树木标识，没有其他功能）
  4. 不需要支付费用
  5. 可以继续打牌，或点击"结束"

#### 2.4 浣熊（ACTION_RACCOON）

- 效果：手牌换洞穴+摸牌
- 流程：
  1. 打出浣熊 → 进入特殊行动模式
  2. 手牌区提示："🦝 浣熊效果：手牌换洞穴+摸牌"
  3. 玩家选择任意数量的手牌
  4. 点击"确认" → 弹窗展示（提示：放入洞穴）
  5. 手牌 → 洞穴
  6. 从牌库摸相同数量的牌
  7. 结束特殊行动

#### 2.5 棕熊（ACTION_BEAR）

- 效果：空地全部进洞穴
- 流程：
  1. 打出棕熊 → 自动执行（不需要玩家选择）
  2. 弹窗展示空地卡片（提示：放入洞穴）
  3. 空地全部 → 洞穴
  4. 结束

#### 2.6 蜂群（ACTION_CLEARING_TO_CAVE）

- 效果：空地中符合条件的牌进洞穴
- 流程：
  1. 打出蜂群 → 自动执行
  2. 筛选空地中带有植物、灌木或树木符号的卡片
  3. 弹窗展示这些卡片（提示：放入洞穴）
  4. 这些卡片 → 洞穴
  5. 其他卡片留在空地
  6. 结束

#### 2.7 欧洲野猫（ACTION_PICK_FROM_CLEARING）

- 效果：从空地拿 1 张牌到洞穴
- 流程：
  1. 打出欧洲野猫 → 进入特殊行动模式
  2. 玩家选择空地中的 1 张牌
  3. 弹窗展示（提示：从空地拿牌放入洞穴）
  4. 该卡 → 洞穴
  5. 结束

**详细计划**：`.agent/tasks/special-actions-implementation.md`

---

### 3. 计分逻辑补充（中优先级）

#### 3.1 SPECIES_ALIAS（雪兔）

- **规则**：雪兔在**计分时**视为欧洲野兔，但在**效果触发时**不算
- **实现位置**：`score.js`
- **实现**：

```javascript
// 计算欧洲野兔数量（用于计分）
function countEuropeanHare(forest, forScoring = false) {
  let count = 0;
  forest.forEach((group) => {
    [group.center, ...Object.values(group.slots)].forEach((card) => {
      if (!card) return;

      // 真正的欧洲野兔
      if (card.name === SPECIES_NAMES.EUROPEAN_HARE) {
        count += 1;
      }

      // 雪兔（只在计分时算）
      if (
        forScoring &&
        card.effectConfig?.type === EFFECT_TYPES.SPECIES_ALIAS &&
        card.effectConfig?.target === SPECIES_NAMES.EUROPEAN_HARE
      ) {
        count += 1;
      }
    });
  });
  return count;
}
```

#### 3.2 TREE_MULTIPLIER（紫木蜂）

- **规则**：紫木蜂在左右插槽时，该树算 2 棵
- **实现位置**：`score.js`
- **实现**：

```javascript
// 计算欧洲七叶树数量（用于计分）
function countHorseChestnut(forest) {
  let count = 0;
  forest.forEach((group) => {
    if (group.center?.name === SPECIES_NAMES.HORSE_CHESTNUT) {
      count += 1;

      // 检查左右插槽是否有紫木蜂
      if (
        group.slots?.left?.name === SPECIES_NAMES.VIOLET_CARPENTER_BEE ||
        group.slots?.right?.name === SPECIES_NAMES.VIOLET_CARPENTER_BEE
      ) {
        count += 1; // 额外算1棵
      }
    }
  });
  return count;
}
```

---

### 4. 洞穴 UI 显示（中优先级）

**需要添加**：

- 洞穴卡片数量显示（例如："洞穴：5 张"）
- 点击查看洞穴详情（可选）
- 洞穴计分显示

**实现位置**：`game.wxml` 和 `game.wxss`

---

### 5. 待确认的 BONUS_TYPES（低优先级）

以下 Bonus 类型还需要确认具体规则：

1. PLAY_FREE - 免费打出特定类型牌
2. PLAY_FREE_AND_DRAW - 免费打牌+摸牌
3. PICK_FROM_CLEARING_TO_HAND - 空地拿回手牌
4. CLEARING_TO_CAVE（Bonus）- 空地进洞穴

---

## 实施优先级

### 第一阶段（必须）

1. ✅ 雌性野猪效果（已完成）
2. 特殊行动基础框架
   - 游戏状态扩展（pendingActions, actionMode, accumulatedRewards）
   - onEndSpecialAction 函数
   - UI 提示系统

### 第二阶段（重要）

1. 插槽容量功能重构
2. 计分逻辑补充（SPECIES_ALIAS, TREE_MULTIPLIER）
3. 洞穴 UI 显示

### 第三阶段（完善）

1. 实现所有特殊行动的具体逻辑
2. 确认并实现剩余的 BONUS_TYPES
3. 全面测试

---

## 今天的成果总结

1. ✅ 修复了黑刺李同色判断问题
2. ✅ 重构了代码结构（bonus.js 和 effect.js）
3. ✅ 完善了 README 文档
4. ✅ 实现了特殊行动的基础框架
5. ✅ 添加了雌性野猪效果
6. ✅ 深入理解了所有游戏规则

**感谢您今天的耐心指导！** 🙏😊
