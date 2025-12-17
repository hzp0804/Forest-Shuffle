import Utils from "../../utils/utils";
const RewardUtils = require("../../utils/reward.js");
const RoundUtils = require("../../utils/round.js");
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
    enableAnimation: true, // 动画开关
  },

  onLoad(options) {
    const app = getApp();
    const openId = app.globalData.userProfile?.openId; // use const, not let
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
      const lastTurnCount = this.data.lastTurnCount || -1;

      let isNewTurn = false;

      // 首次加载(lastTurnCount === -1) 且当前是自己，也提示
      if (lastTurnCount === -1 && currentActive === this.data.openId) {
        isNewTurn = true;
      }
      // 只要回合数增加了，就是新回合
      else if (currentTurnCount > lastTurnCount) {
        isNewTurn = true;
      }

      if (isNewTurn) {
        if (currentActive === this.data.openId) {
          // 只有轮到自己才提示
          wx.showToast({ title: "轮到你了！", icon: "none", duration: 2000 });
          processedData.selectedPlayerOpenId = this.data.openId;
        }
      }

      // 更新记录
      processedData.lastActivePlayer = currentActive;
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

    console.log("打出的牌：", primaryCard); // 打印打出的手牌数据

    // --- 校验出牌目标 ---
    // 1. 如果是树木 (Tree)，不需要选槽位，直接种
    // 2. 如果是非树木 (hCard, vCard)，必须选槽位
    if (type !== "Tree") {
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
    if (type === "Tree") {
      // 树木：新建一个 TreeGroup 放入森林
      // 结构参考 utils.js enrichForest
      const newTreeGroup = {
        _id: Math.random().toString(36).substr(2, 9), // 生成个临时ID，或者直接存对象，后端处理
        center: primaryCard,
        slots: { top: null, bottom: null, left: null, right: null },
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
      if (targetTree.slots[selectedSlot.side]) {
        wx.hideLoading();
        wx.showToast({ title: "该位置已有卡牌", icon: "none" });
        return;
      }

      // 放置卡牌
      targetTree.slots[selectedSlot.side] = primaryCard;
      forest[targetTreeIndex] = targetTree;
    }

    // --- 计算颜色奖励 (Bonus) ---
    // 引入 reward.js
    const reward = RewardUtils.calculateColorReward(
      primaryCard,
      selectedSlot,
      paymentCards
    );

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
      const cleanCard = { ...c, selected: false };
      newClearing.push(cleanCard);
    });

    // 规则：如果打出的是树木 (Tree)，且牌库有牌，则从牌库翻一张进空地
    if (primaryCard.type === "Tree" && newDeck.length > 0) {
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

    wx.showLoading({ title: "摸牌中..." });

    const newDeck = [...deck];
    const newHand = [...(myState.hand || [])];

    // 只摸一张
    const card = newDeck.shift();
    if (card) newHand.push(card);

    const newDrawnCount = currentDrawn + 1;
    let nextPlayer = this.data.activePlayer; // 默认不下机
    let nextTurnAction = { drawnCount: newDrawnCount }; // 更新计数

    const updates = {
      [`gameState.deck`]: newDeck,
      [`gameState.playerStates.${openId}.hand`]: newHand,
      [`gameState.turnAction`]: nextTurnAction,
      // 注意：摸第一张牌时不增加 turnCount，也不切回合
    };

    // 4. 判断回合结束
    if (newDrawnCount >= 2) {
      nextPlayer = RoundUtils.getNextPlayer(openId, this.data.players, false);
      updates[`gameState.activePlayer`] = nextPlayer;
      updates[`gameState.turnAction`] = { drawnCount: 0 };
      updates[`gameState.turnCount`] = db.command.inc(1); // 回合结束，计数+1
    } else {
      updates[`gameState.activePlayer`] = nextPlayer; // 保持不变
    }

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

    wx.showLoading({ title: "拿取中..." });

    const newClearing = [...clearing];
    const myState = playerStates[openId];
    const newHand = [...(myState.hand || [])];

    if (selectedClearingIdx >= newClearing.length) {
      wx.hideLoading();
      return;
    }
    const [takenCard] = newClearing.splice(selectedClearingIdx, 1);
    if (takenCard) {
      newHand.push(takenCard);
    }

    const updates = {
      [`gameState.clearing`]: newClearing,
      [`gameState.playerStates.${openId}.hand`]: newHand,
      [`gameState.activePlayer`]: RoundUtils.getNextPlayer(openId, this.data.players, false),
      [`gameState.turnAction`]: { drawnCount: 0 },
      [`gameState.turnCount`]: db.command.inc(1), // 回合数+1
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

  noop() { }, // 空函数用于阻止冒泡
});
