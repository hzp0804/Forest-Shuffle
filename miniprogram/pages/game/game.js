import Utils from "../../utils/utils";
const RewardUtils = require("../../utils/reward.js");
const RoundUtils = require("../../utils/round.js");
const AnimationUtils = require("../../utils/animation.js");
const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    roomId: "", // 房间ID
    players: [], // 玩家列表
    deck: [], // 牌堆
    clearing: [], // 空地
    playerStates: {
      oN71F18ODPCKs9SzUJKilLyCKwYo: {
        cave: [], // 洞穴
        forest: [], // 森林
        hand: [], // 手牌
      },
    },

    openId: "", // 当前登录的openId
    openId: "", // 当前登录的openId
    selectedPlayerOpenId: "", // 当前选中的玩家openId
    primarySelection: "", // 当前选中的主牌UID
    instructionState: "normal", // 指引状态 (normal, error, warning, success)
    instructionText: "", // 指引文案
    lastActivePlayer: "", // 上一个激活的玩家，用于判断轮次切换
    lastTurnCount: -1,
    lastNotifiedTurnCount: -1,
    enableAnimation: false, // 动画开关
  },

  onLoad(options) {
    const app = getApp();
    let profile = app.globalData.userProfile;

    // 如果全局变量没有，尝试从本地缓存读取 (应对直接打开页面的情况)
    if (!profile) {
      try {
        profile = wx.getStorageSync("userProfile");
        if (profile) {
          app.globalData.userProfile = profile; // 恢复全局状态
        }
      } catch (e) { }
    }

    if (!profile || (!profile.openId && !profile.uid)) {
      wx.showToast({ title: "请先登录", icon: "none" });
      setTimeout(() => {
        wx.reLaunch({ url: "/pages/index/index" });
      }, 1500);
      return;
    }

    const openId = profile.openId || profile.uid;
    this.setData({
      roomId: options.roomId,
      openId,
      selectedPlayerOpenId: openId,
    });
  },

  onShow() {
    this.startPolling();
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  startPolling() {
    this.stopPolling();
    if (!this.data.roomId) return;
    this.queryGameData(this.data.roomId);
    this.pollingTimer = setInterval(() => {
      this.queryGameData(this.data.roomId);
    }, 2000);
  },

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    if (this.turnToastTimer) {
      clearTimeout(this.turnToastTimer);
      this.turnToastTimer = null;
    }
  },

  async queryGameData(roomId) {
    const db = wx.cloud.database();
    try {
      const res = await db.collection("rooms").doc(roomId).get();
      const serverData = res.data;
      const processedData = Utils.processGameData(res, this.data);

      // --- 1. 轮次切换提示 & 自动切视角 ---
      const currentActive =
        serverData.gameState?.activePlayer || serverData.activePlayer;

      // 使用 turnCount (回合计数) 来精确判断新回合
      // 只要 turnCount 增加了，说明上一个回合结束了（无论是换人了，还是触发了额外回合）
      const currentTurnCount = serverData.gameState?.turnCount || 0;
      const lastTurnCount =
        typeof this.data.lastTurnCount === "number" ? this.data.lastTurnCount : -1;

      let isNewTurn = false;

      // 首次加载(lastTurnCount === -1) 且当前是自己，也提示
      if (lastTurnCount === -1 && currentActive === this.data.openId) {
        isNewTurn = true;
      }
      // 只要回合数增加了，就是新回合
      else if (currentTurnCount > lastTurnCount) {
        isNewTurn = true;
      }

      const lastNotifiedTurnCount =
        typeof this.data.lastNotifiedTurnCount === "number"
          ? this.data.lastNotifiedTurnCount
          : -1;

      if (isNewTurn && currentActive === this.data.openId) {
        // 仅提示一次，避免轮询重复弹出
        if (currentTurnCount !== lastNotifiedTurnCount) {
          // 只有轮到自己才提示
          // 延迟提示，避免覆盖掉“操作成功”或“获得奖励”的 toast
          if (this.turnToastTimer) clearTimeout(this.turnToastTimer);
          this.turnToastTimer = setTimeout(() => {
            const turnReason = serverData.gameState?.turnReason;
            const tips = turnReason === "extra" ? "额外回合！" : "轮到你了！";
            // 再次检查是否仍是自己回合 (防止极速操作)
            if (this.data.playerStates && this.data.playerStates[this.data.openId]) {
              wx.showToast({ title: tips, icon: "none", duration: 2000 });
            }
          }, 1500);

          processedData.selectedPlayerOpenId = this.data.openId;
          processedData.lastNotifiedTurnCount = currentTurnCount;
        }
      }

      // 更新记录
      processedData.lastActivePlayer = currentActive || '';
      processedData.lastTurnCount = currentTurnCount;

      // --- 2. 日志弹窗 (Game Log Popup) ---
      const logs = serverData.gameState?.logs || [];
      const lastIndex = this.data.lastLogIndex || 0;

      if (logs.length > lastIndex) {
        const newLogs = logs.slice(lastIndex);

        // 过滤掉自己操作的日志，只显示别人的
        const othersLogs = newLogs.filter(
          (log) => log.operator !== this.data.openId
        );

        if (othersLogs.length > 0) {
          // 拼接显示
          const content = othersLogs
            .map((log) => {
              // 尝试根据 openId 找昵称
              const user = (serverData.players || []).find(
                (p) => p.openId === log.operator
              );
              const nick = user ? user.nickName : "对手";
              return `${nick}: ${log.action}`;
            })
            .join("\n");

          wx.showModal({
            title: "游戏记录",
            content: content,
            showCancel: false,
            confirmText: "知道了",
          });
        }
        // 更新索引
        processedData.lastLogIndex = logs.length;
      }

      this.setData(processedData);
    } catch (e) {
      console.error("Query Game Data Failed", e);
    }
  },

  onPlayerTap(e) {
    const targetOpenId = e.currentTarget.dataset.openid;
    if (targetOpenId) {
      this.setData({ selectedPlayerOpenId: targetOpenId });
      // 重新处理数据以刷新视图（因为 processGameData 依赖 selectedPlayer）
      // 简单触发一次查询即可，或者手动调用 processGameData
      this.queryGameData(this.data.roomId);
    }
  },

  onHandTap(e) {
    const uid = e.currentTarget.dataset.uid;
    const updates = Utils.handleHandTap(uid, this.data);
    if (updates) this.setData(updates);
  },

  onHandLongPress(e) {
    const uid = e.currentTarget.dataset.uid;
    const { playerStates, openId } = this.data;
    const myHand = playerStates[openId]?.hand || [];
    const card = myHand.find((c) => c.uid === uid);

    if (card && card.id) {
      this.setData({
        detailCardId: card.id,
      });
    }
  },

  onCloseDetail() {
    this.setData({ detailCardId: null });
  },



  // 6. 点击空地卡牌
  onClearingCardTap(e) {
    const idx = e.currentTarget.dataset.idx;
    if (this.data.selectedClearingIdx === idx) {
      this.setData({ selectedClearingIdx: -1 });
    } else {
      this.setData({ selectedClearingIdx: idx });
    }
  },



  // 辅助：提交更新
  async submitGameUpdate(updates, successMsg, logContent) {
    const db = wx.cloud.database();
    const _ = db.command;

    // 如果有日志内容，添加到 updates 中
    if (logContent) {
      // 构建日志对象
      const logEntry = {
        operator: this.data.openId,
        action: logContent,
        timestamp: new Date().getTime(),
      };
      // 使用数据库操作符 push
      updates["gameState.logs"] = _.push(logEntry);
    }

    try {
      await db.collection("rooms").doc(this.data.roomId).update({
        data: updates,
      });
      wx.hideLoading();
      this.setData({ selectedClearingIdx: -1, primarySelection: null });
      this.queryGameData(this.data.roomId);
      if (successMsg) wx.showToast({ title: successMsg });
    } catch (err) {
      wx.hideLoading();
      console.error("更新失败", err);
      // wx.showToast({ title: "同步失败，请重试", icon: "none" });
    }
  },

  // 点击森林槽位
  onSlotTap(e) {
    // 只有自己的回合，且选中了非树木的主牌时，才允许选择槽位
    // 或者任何时候允许选，但在打出时校验
    const { treeid, side } = e.currentTarget.dataset;
    const { selectedSlot, primarySelection, playerStates, openId } = this.data;

    // 简单校验：如果在这个槽位上再次点击，则取消
    if (
      selectedSlot &&
      selectedSlot.treeId === treeid &&
      selectedSlot.side === side
    ) {
      this.setData({ selectedSlot: null });
      return;
    }

    // 选中该槽位
    const newSelectedSlot = {
      treeId: treeid,
      side: side,
      isValid: true,
    };

    const nextData = {
      ...this.data,
      selectedSlot: newSelectedSlot,
    };

    // 重新计算指引 (费用可能根据插槽变化)
    const { instructionState, instructionText } =
      Utils.computeInstruction(nextData);

    this.setData({
      selectedSlot: newSelectedSlot,
      instructionState,
      instructionText,
    });
  },

  // 7. 确认打出
  onConfirmPlay() {
    const {
      primarySelection,
      playerStates,
      openId,
      instructionState,
      clearing,
      selectedSlot,
    } = this.data;

    if (!primarySelection) {
      wx.showToast({ title: "请先选择主牌", icon: "none" });
      return;
    }
    if (instructionState === "error") {
      wx.showToast({ title: "费用未满足", icon: "none" });
      return;
    }

    // 检查回合状态：如果已经摸过牌，则不能出牌 (必须完成摸牌动作或被跳过)
    const { turnAction } = this.data;
    if (turnAction && turnAction.drawnCount > 0) {
      wx.showToast({ title: "已摸牌，本回合只能继续摸牌", icon: "none" });
      return;
    }

    wx.showLoading({ title: "出牌中..." });

    const myState = playerStates[openId];
    if (!myState) {
      console.error("[Play Error] No state for user:", openId);
      wx.hideLoading();
      this.queryGameData(this.data.roomId);
      return;
    }

    const hand = [...(myState.hand || [])];
    const forest = [...(myState.forest || [])];
    const newClearing = [...(clearing || [])];

    // 提取主牌和支付牌
    const primaryCardIndex = hand.findIndex((c) => c.uid === primarySelection);
    if (primaryCardIndex === -1) {
      console.error("[Play Error] Primary card not in hand");
      wx.hideLoading();
      return;
    }
    const primaryCard = hand[primaryCardIndex];
    const type = primaryCard.type;
    const isTree = typeof type === "string" && type.toLowerCase() === "tree";

    console.log("打出的牌：", primaryCard); // 打印打出的手牌数据

    // --- 校验出牌目标 ---
    // 1. 如果是树木 (Tree)，不需要选槽位，直接种
    // 2. 如果是非树木 (hCard, vCard)，必须选槽位
    if (!isTree) {
      if (!selectedSlot) {
        wx.hideLoading();
        wx.showToast({ title: "请选择森林中的空位", icon: "none" });
        return;
      }
      // 校验槽位方向是否匹配
      // hCard -> left, right
      // vCard -> top, bottom
      const validSides =
        type === "hCard" ? ["left", "right"] : ["top", "bottom"];
      if (!validSides.includes(selectedSlot.side)) {
        wx.hideLoading();
        wx.showToast({ title: "卡牌方向与槽位不匹", icon: "none" });
        return;
      }
    }

    const paymentCards = hand.filter(
      (c) => c.selected && c.uid !== primarySelection
    );

    console.log("[Play Debug] Payment Cards Count:", paymentCards.length);

    // 移除主牌和支付牌
    const cardsToRemoveUid = new Set([
      primarySelection,
      ...paymentCards.map((c) => c.uid),
    ]);
    const newHand = hand.filter((c) => !cardsToRemoveUid.has(c.uid));

    // 执行打出逻辑
    // 准备动画数据
    const popAnim = AnimationUtils.playToForest(this.data.enableAnimation);
    const flyInAnim = AnimationUtils.playToClearing(this.data.enableAnimation);

    if (isTree) {
      // 树木：新建一个 TreeGroup 放入森林
      // 结构参考 utils.js enrichForest
      const newTreeGroup = {
        _id: Math.random().toString(36).substr(2, 9), // 生成个临时ID，或者直接存对象，后端处理
        center: primaryCard,
        slots: { top: null, bottom: null, left: null, right: null },
        animationData: popAnim, // 添加入场动画
      };
      forest.push(newTreeGroup);
    } else {
      // 附属卡：放入选定槽位
      const targetTreeIndex = forest.findIndex(
        (t) => t._id === selectedSlot.treeId
      );
      if (targetTreeIndex === -1) {
        wx.hideLoading();
        wx.showToast({ title: "目标树木不存在", icon: "none" });
        return;
      }

      // 更新该树木数据
      // 注意：forest 里的对象结构可能是纯数据 { center: {...}, slots: {...} }
      // 直接修改 slots
      const targetTree = { ...forest[targetTreeIndex] };
      // 确保 slots 对象存在
      if (!targetTree.slots)
        targetTree.slots = { top: null, bottom: null, left: null, right: null };

      // 检查该位置是否已有卡（虽然前端 UI 应该已限制）
      const existing = targetTree.slots[selectedSlot.side];

      if (existing) {
        // 1. 槽位已有卡：尝试堆叠 (CAPACITY_INCREASE)
        const effect = existing.effectConfig;
        let canStack = false;

        // 直接字符串判断避免各种引用问题
        if (effect) {
          if (effect.type === 'CAPACITY_INCREASE') {
            if (primaryCard.name === effect.target) {
              const currentStack = existing.stackedCards || [];
              if (1 + currentStack.length < effect.value) {
                canStack = true;
              }
            }
          } else if (effect.type === 'CAPACITY_UNLIMITED' || effect.type === 'CAPACITY_SHARE_SLOT') {
            // 无限容量或特定共享 (如: 欧洲野兔 / 荨麻-蝴蝶)
            let match = false;
            if (effect.target && primaryCard.name === effect.target) {
              match = true;
            }
            if (effect.tag && primaryCard.tags && primaryCard.tags.includes(effect.tag)) {
              match = true;
            }

            if (match) {
              canStack = true;
            }
          }
        }

        if (!canStack) {
          wx.hideLoading();
          wx.showToast({ title: "该位置已有卡牌", icon: "none" });
          return;
        }

        // 执行堆叠
        if (!existing.stackedCards) existing.stackedCards = [];
        const cardWithAnim = { ...primaryCard, animationData: popAnim };
        existing.stackedCards.push(cardWithAnim);
        // 更新现有卡对象 (引用可能已经在 slots 里，但为了保险重新赋值)
        targetTree.slots[selectedSlot.side] = existing;

      } else {
        // 2. 槽位为空：正常放置
        const cardWithAnim = { ...primaryCard, animationData: popAnim };
        targetTree.slots[selectedSlot.side] = cardWithAnim;
      }

    }

    // --- 计算奖励 (Bonus + Effect + Triggers) ---
    // 1. Color Bonus
    const bonusReward = RewardUtils.calculateColorReward(
      primaryCard,
      selectedSlot,
      paymentCards
    );

    // 2. Instant Effect (如: 获得新回合)
    // 传入 forest context 以支持 DRAW_PER_EXISTING 等依赖场面的效果
    const effectReward = RewardUtils.calculateEffect(primaryCard, { forest });

    // 3. Trigger Effects (如: 鸡油菌触发)
    // forest 此时已包含新卡，Trigger 逻辑会遍历 forest 里的卡去响应 primaryCard
    const triggerContext = { slot: selectedSlot };
    const triggerReward = RewardUtils.calculateTriggerEffects(forest, primaryCard, triggerContext);

    // 合并结果
    const reward = {
      drawCount: (bonusReward.drawCount || 0) + (effectReward.drawCount || 0) + (triggerReward.drawCount || 0),
      extraTurn: bonusReward.extraTurn || effectReward.extraTurn || triggerReward.extraTurn,
      actions: [
        ...(bonusReward.actions || []),
        ...(effectReward.actions || []),
        ...(triggerReward.actions || [])
      ]
    };

    console.log("[Play Debug] Reward Result:", reward); // 打印计算出的奖励结果
    console.log("[Play Debug] Context -> card:", primaryCard, " slot:", selectedSlot, " payments:", paymentCards);

    // 提前准备牌库副本，用于可能的摸牌
    let newDeck = this.data.deck ? [...this.data.deck] : [];

    let gainedExtraTurn = false;
    let nextTurnAction = { drawnCount: 0 }; // 默认重置

    if (reward.drawCount > 0) {
      console.log(`[Bonus] Draw ${reward.drawCount} cards.`);
      let actualDrawn = 0;
      for (let i = 0; i < reward.drawCount; i++) {
        if (newDeck.length > 0) {
          const bonusCard = newDeck.shift();
          newHand.push(bonusCard);
          actualDrawn++;
        }
      }
      if (actualDrawn > 0) {
        wx.showToast({ title: `奖励: 摸${actualDrawn}张`, icon: "none" });
      }
    } else if (reward.playFree) {
      // 免费打牌奖励
      console.log("[Bonus] Free Play activated:", reward.playFree);
      wx.showToast({
        title: `奖励: 免费打出一张 ${reward.playFree.filter} 牌`,
        icon: "none",
        duration: 3000,
      });
      gainedExtraTurn = true; // 保持当前玩家
      // 设置特殊回合状态
      nextTurnAction = {
        drawnCount: 0,
        freePlay: reward.playFree // { filter: '...', multiple: bool }
      };

    } else if (reward.bonusText) {
      wx.showToast({
        title: `奖励生效: ${reward.bonusText}`,
        icon: "none",
        duration: 3000,
      });
      if (reward.extraTurn) {
        gainedExtraTurn = true;
      }
    }

    // 支付牌进空地
    paymentCards.forEach((c) => {
      // 支付牌飞入空地动画
      const cleanCard = { ...c, selected: false, animationData: flyInAnim };
      newClearing.push(cleanCard);
    });

    // 规则：如果打出的是树木 (Tree)，且牌库有牌，则从牌库翻一张进空地
    if (isTree && newDeck.length > 0) {
      const topCard = newDeck.shift();
      if (topCard) {
        // 确保进空地的牌是干净的
        newClearing.push({ ...topCard, selected: false });
      }
    }

    // 规则：空地满10张清空
    if (newClearing.length >= 10) {
      newClearing.length = 0;
    }

    // 计算下一位玩家
    // 如果获得额外回合，或者单人模式，RoundUtils.getNextPlayer 会返回当前玩家
    const nextPlayer = RoundUtils.getNextPlayer(
      openId,
      this.data.players,
      gainedExtraTurn
    );

    const updates = {
      [`gameState.playerStates.${openId}.hand`]: newHand,
      [`gameState.playerStates.${openId}.forest`]: forest,
      [`gameState.clearing`]: newClearing,
      [`gameState.deck`]: newDeck, // 必须更新牌库，因为可能少了一张
      [`gameState.activePlayer`]: nextPlayer,
      [`gameState.turnAction`]: nextTurnAction, // 使用动态计算的状态
      [`gameState.turnCount`]: db.command.inc(1), // 回合数+1
      [`gameState.turnReason`]: gainedExtraTurn ? "extra" : "normal", // 记录回合类型
    };

    // 成功后清除选中状态
    this.setData({ selectedSlot: null });
    const logMsg = primaryCard
      ? `打出了 ${primaryCard.name || "一张牌"}`
      : "打出了一张牌";
    this.submitGameUpdate(updates, "出牌成功", logMsg);
  },

  // 8. 摸牌 (从牌库)
  onDrawCard() {
    const { deck, playerStates, openId, turnAction } = this.data;
    const db = wx.cloud.database(); // Ensure db is available

    // 1. 手牌上限检查 (10张)
    const myState = playerStates[openId];
    const currentHandSize = (myState.hand || []).length;
    if (currentHandSize >= 10) {
      wx.showToast({ title: "手牌已满 (上限10张)", icon: "none" });
      return;
    }

    // 2. 牌库检查
    if (!deck || deck.length < 1) {
      wx.showToast({ title: "牌库到底了", icon: "none" });
      return;
    }

    // 3. 回合行动检查
    const currentDrawn = (turnAction && turnAction.drawnCount) || 0;
    if (currentDrawn >= 2) {
      wx.showToast({ title: "本回合摸牌次数已用完", icon: "none" });
      return;
    }

    const newDeck = [...deck];
    const newHand = [...(myState.hand || [])];

    // 只摸一张
    const card = newDeck.shift();
    if (!card) return; // Should not happen if check passed

    // 直接执行实际入手牌逻辑和提交
    newHand.push(card);

    const newDrawnCount = currentDrawn + 1;
    let nextPlayer = this.data.activePlayer;
    let nextTurnAction = { drawnCount: newDrawnCount };

    const updates = {
      [`gameState.deck`]: newDeck,
      [`gameState.playerStates.${openId}.hand`]: newHand,
      [`gameState.turnAction`]: nextTurnAction,
    };

    // 4. 判断回合结束
    if (newDrawnCount >= 2) {
      nextPlayer = RoundUtils.getNextPlayer(openId, this.data.players, false);
      updates[`gameState.activePlayer`] = nextPlayer;
      updates[`gameState.turnAction`] = { drawnCount: 0 };
      updates[`gameState.turnCount`] = db.command.inc(1);
      updates[`gameState.turnReason`] = "normal";
    } else {
      updates[`gameState.activePlayer`] = nextPlayer;
    }

    // 提交
    this.submitGameUpdate(
      updates,
      null,
      `摸了一张牌 (本回合第${newDrawnCount}张)`
    );
  },

  // 9. 确认拿取 (从空地)
  onConfirmTake() {
    const { selectedClearingIdx, clearing, playerStates, openId, turnAction } =
      this.data;
    const db = wx.cloud.database();

    // 检查回合锁定
    if (turnAction && turnAction.drawnCount > 0) {
      wx.showToast({ title: "已摸牌，本回合只能继续摸牌", icon: "none" });
      return;
    }

    if (selectedClearingIdx === -1 || selectedClearingIdx === undefined) {
      wx.showToast({ title: "请选择空地卡牌", icon: "none" });
      return;
    }



    const newClearing = [...clearing];
    const myState = playerStates[openId];
    const newHand = [...(myState.hand || [])];

    if (selectedClearingIdx >= newClearing.length) {
      return;
    }

    // 拿取卡片
    const [takenCard] = newClearing.splice(selectedClearingIdx, 1);
    if (!takenCard) return;

    newHand.push(takenCard);

    const updates = {
      [`gameState.clearing`]: newClearing,
      [`gameState.playerStates.${openId}.hand`]: newHand,
      [`gameState.activePlayer`]: RoundUtils.getNextPlayer(openId, this.data.players, false),
      [`gameState.turnAction`]: { drawnCount: 0 },
      [`gameState.turnCount`]: db.command.inc(1), // 回合数+1
      [`gameState.turnReason`]: "normal",
    };

    this.submitGameUpdate(updates, null, "从空地拿了一张牌");
  },

  // 10. 打出树苗
  onPlaySapling() {
    const { deck, playerStates, openId } = this.data;
    const db = wx.cloud.database();

    if (!deck || deck.length === 0) return;

    wx.showLoading({ title: "种植树苗..." });

    const newDeck = [...deck];
    const myState = playerStates[openId];
    const forest = [...(myState.forest || [])];

    const topCard = newDeck.shift();
    if (topCard) {
      forest.push(topCard);
    }

    const updates = {
      [`gameState.deck`]: newDeck,
      [`gameState.playerStates.${openId}.forest`]: forest,
      [`gameState.activePlayer`]: RoundUtils.getNextPlayer(openId, this.data.players, false),
      [`gameState.turnAction`]: { drawnCount: 0 },
      [`gameState.turnCount`]: db.command.inc(1), // 回合数+1
      [`gameState.turnReason`]: "normal",
    };

    this.submitGameUpdate(updates, null, "由空地打出树苗");
  },

  // 11. 日志显示
  onShowLogs() {
    this.setData({ showLogModal: true });
  },
  onCloseLogs() {
    this.setData({ showLogModal: false });
  },

  // 12. 展示当前 Buff
  onShowBuffs() {
    const { playerStates, openId } = this.data;
    const myState = playerStates[openId];
    if (!myState || !myState.forest) return;

    const buffList = [];

    // 遍历森林寻找常驻效果
    myState.forest.forEach((treeGroup) => {
      // 检查中心树木
      if (treeGroup.center && treeGroup.center.effect) {
        if (treeGroup.center.effect.toLowerCase().includes("whenever")) {
          buffList.push(`[${treeGroup.center.name}] ${treeGroup.center.effect}`);
        }
      }

      // 检查槽位卡牌
      if (treeGroup.slots) {
        Object.values(treeGroup.slots).forEach((card) => {
          if (card && card.effect && card.effect.toLowerCase().includes("whenever")) {
            buffList.push(`[${card.name}] ${card.effect}`);
          }
        });
      }
    });

    if (buffList.length === 0) {
      wx.showToast({ title: "暂无生效中的被动效果", icon: "none" });
    } else {
      wx.showModal({
        title: "生效中的效果 (Buff)",
        content: buffList.join("\n\n"),
        showCancel: false,
        confirmText: "了解",
      });
    }
  },

  noop() { }, // 空函数用于阻止冒泡
});
