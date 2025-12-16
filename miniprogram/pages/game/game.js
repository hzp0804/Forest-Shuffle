Page({
  data: {
    gameData: null,
    myHand: [],
    roomId: "",
    allPlayers: [],
    clearing: [],
    myForest: [],
    myScore: 0,
    deckCount: 0,
    instructionText: "",
    previewCard: null,
    showDetailModal: false,
    activeTab: 0,
    primarySelection: "",
    targetTreeId: "",
    targetTreeId: "",
    selectedSlot: null, // { treeId, side, isValid }
    selectedClearingIdx: -1,
    isMyTurn: false,
    isGameOver: false,
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
    this.gameWatcher = db
      .collection("rooms")
      .doc(roomId)
      .watch({
        onChange: (snapshot) => {
          if (snapshot.docs && snapshot.docs[0]) {
            const room = snapshot.docs[0];
            this.handleGameUpdate(room);
          }
        },
        onError: (err) => console.error("Game watch error", err),
      });
  },

  computeInstruction(
    isMyTurn,
    hand,
    primaryUid,
    selectedClearingIdx,
    isGameOver
  ) {
    if (isGameOver) return { text: "游戏已结束", state: "normal" };
    if (!isMyTurn) return { text: "等待其他玩家行动...", state: "normal" };
    if (selectedClearingIdx > -1)
      return { text: "点击“拿取”获得该卡牌", state: "success" };
    if (!primaryUid)
      return { text: "轮到你了：可摸牌或打出手牌", state: "normal" };

    const mainCard = hand.find((c) => c.uid === primaryUid);
    if (!mainCard)
      return { text: "轮到你了：可摸牌或打出手牌", state: "normal" };

    const paymentCount = hand.filter(
      (c) => c.selected && c.uid !== primaryUid
    ).length;

    let costs = new Set();
    let specificMode = false;
    let requiredCost = 0;
    let specificBonus = "";

    const { selectedSlot } = this.data;
    // Determines if current selection is compatible with selected slot
    let isSlotCompatible = false;
    if (selectedSlot && selectedSlot.isValid) {
      if (
        mainCard.type === "H_CARD" &&
        (selectedSlot.side === "left" || selectedSlot.side === "right")
      )
        isSlotCompatible = true;
      if (
        mainCard.type === "V_CARD" &&
        (selectedSlot.side === "top" || selectedSlot.side === "bottom")
      )
        isSlotCompatible = true;
    }

    if (isSlotCompatible) {
      specificMode = true;
      const side = selectedSlot.side;
      let speciesIdx = -1;
      if (side === "top" || side === "left") speciesIdx = 0;
      else if (side === "bottom" || side === "right") speciesIdx = 1;

      const speciesList = mainCard.speciesDetails || [];
      const targetData =
        speciesIdx !== -1 && speciesList[speciesIdx]
          ? speciesList[speciesIdx]
          : mainCard;

      requiredCost =
        targetData.cost !== undefined
          ? Number(targetData.cost)
          : mainCard.cost !== undefined
          ? Number(mainCard.cost)
          : 0;
      if (targetData.bonus) specificBonus = targetData.bonus;
    } else {
      if (mainCard.cost !== undefined) costs.add(Number(mainCard.cost));
      if (mainCard.speciesDetails) {
        mainCard.speciesDetails.forEach((s) => {
          if (s.cost !== undefined) costs.add(Number(s.cost));
        });
      }
      if (costs.size === 0) costs.add(0);
    }

    if (specificMode) {
      const diff = paymentCount - requiredCost;
      if (diff < 0)
        return {
          text: `需支付 ${requiredCost} 张牌 (还少 ${-diff} 张)`,
          state: "warning",
        };
      if (diff > 0)
        return {
          text: `需支付 ${requiredCost} 张牌 (多了 ${diff} 张)`,
          state: "error",
        };

      let bonusText = specificBonus ? `，奖励：${specificBonus}` : "";
      return {
        text: `支付 ${requiredCost} 张牌 (完成${bonusText})`,
        state: "success",
      };
    }

    const sortedCosts = Array.from(costs).sort((a, b) => a - b);

    if (sortedCosts.length === 1) {
      const cost = sortedCosts[0];
      const diff = paymentCount - cost;
      if (diff < 0)
        return {
          text: `需支付 ${cost} 张牌 (还少 ${-diff} 张)`,
          state: "warning",
        };
      if (diff > 0)
        return {
          text: `需支付 ${cost} 张牌 (多了 ${diff} 张)`,
          state: "error",
        };

      // Success case - Check for bonuses
      let bonusText = "";
      const rawBonuses = new Set();
      if (mainCard.bonus) rawBonuses.add(mainCard.bonus);
      if (mainCard.speciesDetails) {
        mainCard.speciesDetails.forEach((s) => {
          if (s.bonus) rawBonuses.add(s.bonus);
        });
      }
      if (rawBonuses.size > 0) {
        bonusText = `，奖励：${Array.from(rawBonuses).join(" / ")}`;
      }
      return { text: `支付 ${cost} 张牌 (完成${bonusText})`, state: "success" };
    } else {
      const costStr = sortedCosts.join(" 或 ");
      if (sortedCosts.includes(paymentCount)) {
        // Success case logic for multi-cost (unlikely for now but safe to add)
        let bonusText = "";
        const rawBonuses = new Set();
        if (mainCard.bonus) rawBonuses.add(mainCard.bonus);
        if (mainCard.speciesDetails) {
          mainCard.speciesDetails.forEach((s) => {
            // Try to match cost if possible? simplified: show all potentials
            if (s.bonus) rawBonuses.add(s.bonus);
          });
        }
        if (rawBonuses.size > 0) {
          bonusText = `，奖励：${Array.from(rawBonuses).join(" / ")}`;
        }
        return {
          text: `支付 ${paymentCount} 张牌 (完成${bonusText})`,
          state: "success",
        };
      }
      return {
        text: `需支付 ${costStr} 张牌 (已选 ${paymentCount})`,
        state: "warning",
      };
    }
  },

  handleGameUpdate(room) {
    this.roomCache = room;
    if (!room) return;
    const app = getApp();
    const myOpenId = app.globalData.userProfile?.openId;
    const prevSelected = new Set(
      (this.data.myHand || []).filter((c) => c.selected).map((c) => c.uid)
    );
    const prevPrimary = this.data.primarySelection || "";

    // 假设 gameState 结构
    const gameState = room.gameState || {};
    const playerStates = gameState.playerStates || {};
    const myState = playerStates[myOpenId];

    // 处理玩家列表 (6个座位)
    const rawPlayers = room.players || Array(6).fill(null);
    const allPlayers = rawPlayers.map((p) => {
      if (!p) return { isEmpty: true };

      const pState = playerStates[p.openId];
      return {
        isEmpty: false,
        openId: p.openId,
        nickName: p.nickName,
        avatarUrl: p.avatarUrl,
        isMe: p.openId === myOpenId,
        handCount: pState ? (pState.hand || []).length : 0,
        score: pState ? pState.score : 0,
      };
    });

    // 处理手牌：将 ID 映射回详细信息
    const cardData = require("../../data/cardData.js");
    const bgaData = require("../../data/bgaCardData.js");
    const dict = cardData.byName || cardData;

    // --- Count Real Cards in Game ---
    const realCounts = {};
    const countItem = (c) => {
      if (!c || !c.id) return;
      realCounts[c.id] = (realCounts[c.id] || 0) + 1;
    };

    if (gameState) {
      (gameState.deck || []).forEach(countItem);
      (gameState.clearing || []).forEach(countItem);
      Object.values(gameState.playerStates || {}).forEach((p) => {
        (p.hand || []).forEach(countItem);
        (p.forest || []).forEach((tree) => {
          countItem(tree.center);
          if (tree.slots) {
            Object.values(tree.slots).forEach((s) => {
              if (s) countItem(s);
            });
          }
        });
      });
    }

    // --- Image Helper Logic (Unified with Gallery) ---
    const remoteBase =
      "https://x.boardgamearena.net/data/themereleases/current/games/forestshuffle/250929-1034/img";
    const remoteMap = {
      "trees.jpg": `${remoteBase}/trees.jpg`,
      "hcards.jpg": `${remoteBase}/hCards.jpg`,
      "vcards.jpg": `${remoteBase}/vCards.jpg`,
      "mountain.jpg": `${remoteBase}/mountain.jpg`,
      "woodlands.jpg": `${remoteBase}/woodlands.Jpg`,
      "trees.webp": `${remoteBase}/trees.jpg`,
      "hcards.webp": `${remoteBase}/hCards.jpg`,
      "vcards.webp": `${remoteBase}/vCards.jpg`,
      "mountain.webp": `${remoteBase}/mountain.jpg`,
      "hCards.jpg": `${remoteBase}/hCards.jpg`,
      "vCards.jpg": `${remoteBase}/vCards.jpg`,
      "woodlands.Jpg": `${remoteBase}/woodlands.Jpg`,
    };

    const toRemote = (img = "") => {
      if (!img) return img;
      if (/^https?:\/\//.test(img)) return img;
      const name = img.split("/").pop();
      const lower = name.toLowerCase();
      if (remoteMap[name]) return remoteMap[name];
      if (remoteMap[lower]) return remoteMap[lower];
      return img;
    };

    const defaultSpriteByType = {
      H_CARD: toRemote("/images/cards/hcards.jpg"),
      V_CARD: toRemote("/images/cards/vcards.jpg"),
      W_CARD: toRemote("/images/cards/trees.jpg"),
      TREE: toRemote("/images/cards/trees.jpg"),
    };

    const spriteGridByFile = {
      "trees.webp": { cols: 5, rows: 5 },
      "trees.jpg": { cols: 5, rows: 5 },
      "hcards.webp": { cols: 7, rows: 7 },
      "hcards.jpg": { cols: 7, rows: 7 },
      "vcards.webp": { cols: 7, rows: 7 },
      "vcards.jpg": { cols: 7, rows: 7 },
      "mountain.webp": { cols: 7, rows: 4 },
      "mountain.jpg": { cols: 7, rows: 4 },
      "woodlands.jpg": { cols: 6, rows: 6 },
    };

    const resolveImg = (card) => {
      if (card.img && card.img.trim()) {
        return toRemote(card.img.trim());
      }
      return defaultSpriteByType[card.type] || defaultSpriteByType.TREE;
    };

    const getGrid = (img, type) => {
      const fname = img.split("/").pop().toLowerCase();
      if (fname.includes("mountain")) return { cols: 7, rows: 4 };
      if (spriteGridByFile[fname]) return spriteGridByFile[fname];
      if (type === "H_CARD") return spriteGridByFile["hcards.jpg"];
      if (type === "V_CARD") return spriteGridByFile["vcards.jpg"];
      return { cols: 7, rows: 7 };
    };

    const parsePct = (s) => parseFloat(s) || 0;
    const quantizeIndex = (valuePct, divisions) => {
      const step = 100 / (divisions - 1);
      return Math.round(valuePct / step);
    };

    const computeSpriteStyle = (xPctStr, yPctStr, grid) => {
      const { cols, rows } = grid;
      const width = cols * 100;
      const height = rows * 100;
      const xIndex = quantizeIndex(parsePct(xPctStr), cols);
      const yIndex = quantizeIndex(parsePct(yPctStr), rows);
      const left = -1 * xIndex * 100;
      const top = -1 * yIndex * 100;
      return `width: ${width}%; height: ${height}%; left: ${left}%; top: ${top}%; position: absolute;`;
    };

    // Prepare Visual Map
    const cardVisualMap = {};
    Object.values(bgaData.cards).forEach((card) => {
      if (!card.species) return;
      card.species.forEach((sp) => {
        const normalized = String(sp)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
        if (!cardVisualMap[normalized]) {
          cardVisualMap[normalized] = card;
        }
        // Fix: Map Bechstein's Bat alias
        if (normalized === "BECHSTEIN") {
          cardVisualMap["BECHSTEINSBAT"] = card;
        }
      });
    });
    // --- End Image Helper Logic ---

    // --- Species Metadata Helper (Copied/Adapted from Gallery.js) ---
    const tagMap = {
      Tree: "树",
      tree: "树",
      Plant: "植物",
      plant: "植物",
      Mushroom: "蘑菇",
      mushroom: "蘑菇",
      Bird: "鸟类",
      bird: "鸟类",
      Insect: "昆虫",
      insect: "昆虫",
      Butterfly: "蝴蝶",
      butterfly: "蝴蝶",
      Amphibian: "两栖动物",
      amphibian: "两栖动物",
      Paw: "兽类",
      paw: "兽类",
      Bat: "蝙蝠",
      bat: "蝙蝠",
      Deer: "鹿",
      deer: "鹿",
      "Cloven-hoofed animal": "偶蹄动物",
      "cloven-hoofed animal": "偶蹄动物",
      Mountain: "山脉",
      mountain: "山脉",
      "Woodland Edge": "林缘",
      "woodland edge": "林缘",
      Shrub: "灌木",
      shrub: "灌木",
    };

    const findSpeciesMeta = (code = "") => {
      if (!code) return null;
      // cardData.byName is already loaded
      const meta =
        cardData.byName[code] ||
        cardData.byName[code.toLowerCase()] ||
        cardData.byConst[code];
      return meta;
    };

    const enrichCard = (simpleCard) => {
      if (!simpleCard || !simpleCard.id) return null;

      let base = null;
      let visualCard = null;

      if (simpleCard.sapling) {
        base = { ...simpleCard, name: "树苗" };
        visualCard = {
          type: "V_CARD", // Treat as Vertical Card
          img: "/images/cards/vCards.jpg", // Use standard path key
          x: "100%",
          y: "100%",
        };
      } else if (simpleCard.id === "WINTER") {
        base = {
          ...simpleCard,
          name: "冬季卡",
          type: "WINTER",
          color: "#a0d8ef",
        };
        visualCard = bgaData.cards["67"];
      } else {
        const def = dict[simpleCard.id];
        base = def ? { ...def, ...simpleCard } : simpleCard;
        const normalizedKey = String(simpleCard.id)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
        visualCard = cardVisualMap[normalizedKey];
      }

      if (visualCard) {
        const visual = resolveImg(visualCard);
        const grid = getGrid(visual, visualCard.type);
        base.img = visual;
        base.spriteStyle = computeSpriteStyle(visualCard.x, visualCard.y, grid);

        // Enrich with detailed structure for "Gallery-style" modal
        const speciesList = visualCard.species || [];
        base.speciesDetails = speciesList.map((code) => {
          const meta = findSpeciesMeta(code) || {};
          const rawTags =
            meta.tags && meta.tags.length ? meta.tags : meta.tags_en || [];
          const tags = rawTags
            .map((t) => {
              const k = (t || "").trim();
              return tagMap[k] || tagMap[k.toLowerCase()] || k;
            })
            .filter(Boolean);

          return {
            key: code,
            displayName: meta.name || meta.name_en || code,
            tags: tags,
            cost: meta.cost,
            type: meta.type,
            nb: realCounts[simpleCard.id] || meta.nb,
            effect: meta.effect || "",
            bonus: meta.bonus || "",
            points: meta.points || meta.points_en || "",
          };
        });
        // Try to find a primary name if missing
        if (!base.name && base.speciesDetails.length) {
          base.name = base.speciesDetails.map((s) => s.displayName).join(" / ");
        }
      }

      // --- Fix: Ensure Type is present and Normalized ---
      if (!base.type && visualCard && visualCard.type) {
        base.type = visualCard.type;
      }

      if (base.type) {
        let t = String(base.type).toUpperCase();
        if (t === "VCARD") t = "V_CARD";
        if (t === "HCARD") t = "H_CARD";
        base.type = t;
      }

      return base;
    };

    // Enrich Logs
    if (gameState.logs && gameState.logs.length) {
      gameState.logs = gameState.logs.map((log) => ({
        ...log,
        cards: (log.cards || []).map((c) => {
          const base = enrichCard(c);
          return { ...base, logType: c.logType };
        }),
      }));
    }

    const displayLogs = [...(gameState.logs || [])].reverse();

    const rawHand = myState ? myState.hand : [];
    const richHand = rawHand
      .map(enrichCard)
      .filter((c) => c)
      .map((c) => ({
        ...c,
        selected: prevSelected.has(c.uid),
      }));

    // 处理空地区域 (Clearing)
    const rawClearing = gameState.clearing || [];
    const richClearing = rawClearing.map(enrichCard).filter((c) => c);

    // 处理森林区域 (Display Forest) - Supports viewing other players
    const viewingId = this.data.viewingPlayerId || myOpenId;
    const displayState = gameState.playerStates[viewingId];
    const rawForest = displayState ? displayState.forest || [] : [];
    // If forest is flat list (legacy), treat them all as separate trees or saplings?
    // Ideally we assume new structure: objects with { isTree: true, ... } OR { type: 'TREE_GROUP', center: ..., slots: ... }
    // But since we control the write, let's define the Read structure.

    // We expect gameState.playerStates[x].forest to be an array of "TreeGroup" objects.
    // If it's a flat array of cards (from previous simple impl), we wrap them as trees for compatibility/migration.
    let richForest = [];
    if (rawForest.length > 0 && rawForest[0].id) {
      // Legacy flat format detection (item has .id directly) -> Wrap as simple trees
      richForest = rawForest.map((c) => {
        const rich = enrichCard(c);
        return {
          _id: c.uid || Math.random().toString(36),
          center: rich,
          slots: { top: null, bottom: null, left: null, right: null },
        };
      });
    } else {
      // New Format: Array of TreeGroup objects
      richForest = rawForest.map((g) => ({
        _id: g._id,
        center: enrichCard(g.center),
        slots: {
          top: enrichCard(g.slots?.top),
          bottom: enrichCard(g.slots?.bottom),
          left: enrichCard(g.slots?.left),
          right: enrichCard(g.slots?.right),
        },
      }));
    }

    const deckCount = (gameState.deck || []).length;
    const winterCount = gameState.winterCount || 0;
    const isGameOver = gameState.status === "finished" || winterCount >= 3;

    const turnOrder = gameState.turnOrder || [];
    const currentIdx = gameState.currentPlayerIdx || 0;

    // Robust check for turn
    let isMyTurn = turnOrder.length > 0 && turnOrder[currentIdx] === myOpenId;

    // Safety fallback for single player: If only 1 player, it MUST be their turn (unless game over)
    if (turnOrder.length === 1 && turnOrder[0] === myOpenId) {
      isMyTurn = true;
    }

    // Vibrate if it becomes my turn
    if (isMyTurn && !this.data.isMyTurn && !isGameOver) {
      wx.vibrateShort({ type: "medium" });
      console.log("Turn changed to me, vibrating...");
    }

    // --- Turn Summary / Action Log Logic ---
    if (gameState.lastTurnSummary && gameState.lastTurnSummary.actionTime) {
      const remoteTime = gameState.lastTurnSummary.actionTime;
      const localTime = this.data.lastSummaryTime || 0;

      if (remoteTime > localTime) {
        // Always update time tracking
        this.setData({ lastSummaryTime: remoteTime });

        const actorId = gameState.lastTurnSummary.playerOpenId;
        // Only trigger popup if action was by OTHERS
        if (actorId && actorId !== myOpenId) {
          this.setData({ showLogModal: true });

          // Auto hide logs after 2 seconds
          if (this._logTimer) clearTimeout(this._logTimer);
          this._logTimer = setTimeout(() => {
            this.setData({ showLogModal: false });
          }, 2000);
        }
      }
    }

    const nextPrimary = prevSelected.has(prevPrimary)
      ? prevPrimary
      : richHand.find((c) => c.selected)?.uid || "";
    const { text: instructionText, state: instructionState } =
      this.computeInstruction(isMyTurn, richHand, nextPrimary, -1, isGameOver);

    const deckBack = enrichCard({ sapling: true, id: "DECK" });

    this.setData({
      gameData: gameState,
      allPlayers: allPlayers,
      myHand: richHand,
      clearing: richClearing,
      myForest: richForest, // 新增森林数据
      myScore: myState ? myState.score : 0,
      deckCount: deckCount,
      deckBack: deckBack,
      instructionText: instructionText,
      instructionState: instructionState,
      userProfile: app.globalData.userProfile || {},
      primarySelection: nextPrimary,
      targetTreeId: this.data.targetTreeId,
      isMyTurn: isMyTurn,
      isGameOver: isGameOver,
      displayLogs: displayLogs,
      viewingPlayerNick:
        viewingId === myOpenId
          ? "我"
          : allPlayers.find((p) => p && p.openId === viewingId)?.nickName ||
            "玩家",
      isViewingSelf: viewingId === myOpenId,
      // showTurnSummary removed
    });

    if (isGameOver && !this.data.hasShownResult) {
      this.setData({ hasShownResult: true });
      wx.showModal({
        title: "游戏结束",
        content: "第三张冬季卡已出现，游戏结束！\n请查看最终得分。",
        showCancel: false,
      });
    }

    // 动态更新标题
    wx.setNavigationBarTitle({
      title: `牌库 (${deckCount}) - 冬季卡 (${winterCount})`,
    });
  },

  stripCard(card = {}) {
    const base = { id: card.id, uid: card.uid };
    if (card.sapling) base.sapling = true;
    return base;
  },

  getCardSymbol(card) {
    if (!card || !card.id) return null;
    const id = Number(card.id);

    // 1. Trees (Base Game & Alpine)
    if (id >= 1 && id <= 9) return "LINDEN";
    if (id >= 10 && id <= 16) return "OAK";
    if (id >= 17 && id <= 22) return "SILVER_FIR";
    if (id >= 23 && id <= 32) return "BIRCH";
    if (id >= 33 && id <= 42) return "BEECH";
    if (id >= 43 && id <= 48) return "SYCAMORE";
    if (id >= 49 && id <= 55) return "DOUGLAS_FIR";
    if (id >= 56 && id <= 66) return "HORSE_CHESTNUT";
    if (id >= 162 && id <= 168) return "LARCH";
    if (id >= 169 && id <= 175) return "PINE";

    // 2. Dwellers / Split Cards
    // TODO: Map remaining IDs to their symbols.
    // Currently missing data for IDs 70-161 and 176+
    // For now, return UNKNOWN to block bonus (Strict Mode)

    return "UNKNOWN";
  },

  checkBonusCondition(mainCard, payCards) {
    // Rule: To get the bonus, all payment cards must share the same symbol as the played card.
    const targetSymbol = this.getCardSymbol(mainCard);

    // Strict Mode: If we don't know the symbol, we cannot validate the bonus.
    // User requirement: "Reward needs to pay corresponding color to trigger".
    // Therefore, UNKNOWN symbols should NOT trigger bonuses.
    if (!targetSymbol || targetSymbol === "UNKNOWN") return false;

    return payCards.every((c) => {
      const sym = this.getCardSymbol(c);
      return sym === targetSymbol;
    });
  },

  getMyOpenId() {
    return getApp().globalData.userProfile?.openId;
  },

  isMyTurnNow() {
    const { gameData } = this.data;
    const myId = this.getMyOpenId();
    const order = gameData?.turnOrder || [];
    if (!order.length) return false;
    return order[gameData.currentPlayerIdx || 0] === myId;
  },

  async withLatestState() {
    const roomId = this.data.roomId;
    if (!roomId) throw new Error("缺少房间 ID");
    const db = wx.cloud.database();
    const res = await db.collection("rooms").doc(roomId).get();
    const room = res.data;
    if (!room || !room.gameState) throw new Error("游戏未初始化");
    const gameState = room.gameState;
    const myId = this.getMyOpenId();
    const myState = gameState.playerStates?.[myId];
    if (!myState) throw new Error("未找到你的玩家状态");
    return { db, room, gameState, myState, myId };
  },

  appendLog(gameState, text, cards = []) {
    const logs = gameState.logs || [];
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
    logs.push({
      text: text,
      time: timeStr,
      cards: cards,
    });
    // Keep last 50 logs
    if (logs.length > 50) logs.shift();
    gameState.logs = logs;
  },

  advanceTurn(state) {
    const order = state.turnOrder || [];
    if (!order.length) return state;
    const nextIdx = ((state.currentPlayerIdx || 0) + 1) % order.length;
    // Reset draw count and action state for the next player
    return {
      ...state,
      currentPlayerIdx: nextIdx,
      drawCount: 0,
      turnAction: null,
    };
  },

  onCardTap(e) {
    const uid = e.currentTarget.dataset.uid;
    const { myHand, primarySelection } = this.data;
    let nextPrimary = primarySelection;
    const newHand = (myHand || []).map((c) => {
      // Toggle selection logic
      if (c.uid === uid) {
        const toggled = !c.selected;
        if (toggled && !nextPrimary) {
          nextPrimary = uid;
        } else if (!toggled && nextPrimary === uid) {
          // If deselecting primary, pick another selected as primary
          nextPrimary = "";
        }
        return { ...c, selected: toggled };
      }
      return c;
    });

    // Re-evaluate primary if we lost it
    if (!nextPrimary) {
      const fallback = newHand.find((item) => item.selected);
      nextPrimary = fallback ? fallback.uid : "";
    }

    // Selecting hand card clears clearing selection AND slot selection
    const { text: instructionText, state: instructionState } =
      this.computeInstruction(
        this.data.isMyTurn,
        newHand,
        nextPrimary,
        -1,
        this.data.isGameOver
      );

    this.setData({
      myHand: newHand,
      primarySelection: nextPrimary,
      selectedClearingIdx: -1,
      instructionText,
      instructionState,
    });
  },

  onClearingCardTap(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const current = this.data.selectedClearingIdx;
    const next = current === idx ? -1 : idx;

    // Selecting clearing card clears hand selection
    const newHand = (this.data.myHand || []).map((c) => ({
      ...c,
      selected: false,
    }));
    const { text: instructionText, state: instructionState } =
      this.computeInstruction(
        this.data.isMyTurn,
        newHand,
        "",
        next,
        this.data.isGameOver
      );

    this.setData({
      selectedClearingIdx: next,
      primarySelection: "",
      selectedSlot: null,
      targetTreeId: "",
      myHand: newHand,
      instructionText,
      instructionState,
    });
  },

  onTreeTap(e) {
    const treeId = e.currentTarget.dataset.id;
    this.setData({
      targetTreeId: this.data.targetTreeId === treeId ? "" : treeId,
    });
  },

  async onDrawCard() {
    if (!this.isMyTurnNow()) {
      wx.showToast({ title: "当前不是你的回合", icon: "none" });
      return;
    }
    if (this._actionBusy) return;
    if (this.data.isGameOver) {
      wx.showToast({ title: "游戏已结束", icon: "none" });
      return;
    }

    this._actionBusy = true;
    try {
      const { db, room, gameState, myState, myId } =
        await this.withLatestState();

      // Check turn
      const latestOrder = gameState.turnOrder || [];
      if (latestOrder[gameState.currentPlayerIdx || 0] !== myId) {
        wx.showToast({ title: "当前不是你的回合", icon: "none" });
        return;
      }

      // 1. Check if allowed to draw
      // Cannot draw if already played a card (action 'play') or full turns
      if (gameState.turnAction === "play") {
        wx.showToast({ title: "已打出牌，本回合结束", icon: "none" });
        // Should have advanced already, but just in case
        return;
      }

      // Check hand limit (10)
      if ((myState.hand || []).length >= 10) {
        wx.showToast({ title: "手牌已满10张，不能摸牌", icon: "none" });
        return;
      }

      const deck = [...(gameState.deck || [])];
      if (!deck.length) {
        wx.showToast({ title: "牌库已空", icon: "none" });
        return;
      }

      // Perform Draw
      const drawn = deck.shift();
      const currentDrawCount = (gameState.drawCount || 0) + 1;

      const nextState = {
        ...gameState,
        deck,
        playerStates: { ...gameState.playerStates },
        turnAction: "draw",
        drawCount: currentDrawCount,
      };

      const nextMine = { ...myState, hand: [...(myState.hand || [])] };

      let message = "摸到 1 张牌";
      if (drawn.id === "WINTER") {
        const wCount = (nextState.winterCount || 0) + 1;
        nextState.winterCount = wCount;
        if (wCount >= 3) {
          nextState.status = "finished";
        }
        message = "翻出冬季卡";
      } else {
        nextMine.hand.push(this.stripCard(drawn));
      }
      nextState.playerStates[myId] = nextMine;

      // Check End Valid Conditions
      // Rule: Draw 2 cards OR draw until hand limit (10).
      // If hand reaches 10, stop.
      // If drawCount == 2, stop.
      const handSize = nextMine.hand.length;
      let shouldEnd = false;
      if (currentDrawCount >= 2) shouldEnd = true;
      if (handSize >= 10) shouldEnd = true;

      let finalState = nextState;
      if (shouldEnd) {
        finalState = this.advanceTurn(finalState);
        message += " (回合结束)";
      } else {
        message += " (请再摸一张)";
      }

      // Add Log
      const logText =
        `${this.data.userProfile.nickName} 摸了1张牌` +
        (drawn.id === "WINTER" ? " (冬季卡)" : "");
      const logCards =
        drawn.id === "WINTER"
          ? [{ ...this.stripCard(drawn), logType: "winter" }]
          : [];
      this.appendLog(finalState, logText, logCards);

      await db
        .collection("rooms")
        .doc(room._id)
        .update({
          data: { gameState: finalState },
        });

      // Local state update hints
      this.setData({
        selectedClearingIdx: -1,
        selectedSlot: null,
        targetTreeId: "",
        primarySelection: "",
        myHand: (this.data.myHand || []).map((c) => ({
          ...c,
          selected: false,
        })),
      });

      wx.showToast({ title: message, icon: "none" });
    } catch (err) {
      console.error("Draw card failed", err);
      wx.showToast({ title: err.message || "操作失败，请重试", icon: "none" });
    } finally {
      this._actionBusy = false;
    }
  },

  checkClearingLimit(clearing) {
    if (clearing.length >= 10) {
      return [];
    }
    return clearing;
  },

  async onConfirmTake() {
    const idx = this.data.selectedClearingIdx;
    if (idx < 0) {
      wx.showToast({ title: "请先选择一张空地卡牌", icon: "none" });
      return;
    }
    if (!this.isMyTurnNow()) {
      wx.showToast({ title: "当前不是你的回合", icon: "none" });
      return;
    }
    if (this._actionBusy) return;
    if (this.data.isGameOver) {
      wx.showToast({ title: "游戏已结束", icon: "none" });
      return;
    }
    this._actionBusy = true;
    try {
      const { db, room, gameState, myState, myId } =
        await this.withLatestState();

      // 1. Check turn consistency
      const latestOrder = gameState.turnOrder || [];
      if (latestOrder[gameState.currentPlayerIdx || 0] !== myId) {
        wx.showToast({ title: "当前不是你的回合", icon: "none" });
        return;
      }

      // 2. Check restrictions
      if (gameState.turnAction === "play") {
        wx.showToast({ title: "已打出牌，本回合结束", icon: "none" });
        return;
      }
      if ((myState.hand || []).length >= 10) {
        wx.showToast({ title: "手牌已满10张，无法拿取", icon: "none" });
        return;
      }

      const clearing = [...(gameState.clearing || [])];
      const picked = clearing[idx];
      if (!picked) {
        wx.showToast({ title: "这个位置没有牌", icon: "none" });
        return;
      }
      clearing.splice(idx, 1);

      const currentDrawCount = (gameState.drawCount || 0) + 1;

      const nextState = {
        ...gameState,
        clearing,
        playerStates: { ...gameState.playerStates },
        turnAction: "draw",
        drawCount: currentDrawCount,
      };

      const nextMine = {
        ...myState,
        hand: [...(myState.hand || []), this.stripCard(picked)],
      };
      nextState.playerStates[myId] = nextMine;

      // Check End Turn
      const handSize = nextMine.hand.length;
      let shouldEnd = false;
      if (currentDrawCount >= 2) shouldEnd = true;
      if (handSize >= 10) shouldEnd = true;

      let finalState = nextState;
      let message = "拿到 1 张牌";

      if (shouldEnd) {
        finalState = this.advanceTurn(finalState);
        message += " (回合结束)";
      } else {
        message += " (请再拿一张)";
      }

      // Add Log
      const logText = `${this.data.userProfile.nickName} 从空地拿取了 ${
        picked.name || "一张牌"
      }`;
      const logCards = [{ ...this.stripCard(picked), logType: "take" }];
      this.appendLog(finalState, logText, logCards);

      await db
        .collection("rooms")
        .doc(room._id)
        .update({
          data: { gameState: finalState },
        });
      // Clear selection after taking
      this.setData({ selectedClearingIdx: -1 });
      wx.showToast({ title: message, icon: "none" });
    } catch (err) {
      console.error("Take from clearing failed", err);
      wx.showToast({ title: err.message || "操作失败，请重试", icon: "none" });
    } finally {
      this._actionBusy = false;
    }
  },

  // New Action: Generic Confirm Play (Plants Tree or Attaches Card)
  onConfirmPlay() {
    const { selectedSlot } = this.data;

    // If a VALID slot is selected, play into that slot
    if (selectedSlot && selectedSlot.isValid) {
      this.onPlayCard({
        currentTarget: { dataset: { side: selectedSlot.side } },
      });
    } else {
      // Default: Play as Tree (Ignore slot if invalid or null)
      this.onPlayTree();
    }
  },

  onPlayTree() {
    // Wrapper for playing as tree - only valid for TREE or W_CARD
    const selected = (this.data.myHand || []).filter((c) => c.selected);
    if (!selected.length) {
      wx.showToast({ title: "请选择一张手牌", icon: "none" });
      return;
    }

    const primaryUid =
      this.data.primarySelection &&
      selected.some((c) => c.uid === this.data.primarySelection)
        ? this.data.primarySelection
        : selected[0].uid;
    const mainCard = selected.find((c) => c.uid === primaryUid);

    if (mainCard.type !== "TREE" && mainCard.type !== "W_CARD") {
      wx.showToast({ title: "该卡牌不能作为树木打出", icon: "none" });
      return;
    }

    this.onPlayCard({ currentTarget: { dataset: { side: "tree" } } });
  },

  onSlotTap(e) {
    const { treeid, side } = e.currentTarget.dataset;
    if (!treeid || !side) return;

    // Guard: Can only select slots on OWN forest
    if (
      this.data.viewingPlayerId &&
      this.data.viewingPlayerId !== this.getMyOpenId()
    ) {
      return;
    }

    // Toggle off if clicking same slot
    if (
      this.data.selectedSlot &&
      this.data.selectedSlot.treeId === treeid &&
      this.data.selectedSlot.side === side
    ) {
      this.setData({ selectedSlot: null });
      return;
    }

    const selected = (this.data.myHand || []).filter((c) => c.selected);
    // Removed blocking check for empty selection

    const primaryUid =
      this.data.primarySelection &&
      selected.some((c) => c.uid === this.data.primarySelection)
        ? this.data.primarySelection
        : selected.length > 0
        ? selected[0].uid
        : "";
    const mainCard = selected.find((c) => c.uid === primaryUid);

    // Default valid if no card selected yet (allow slot selection first)
    let isValid = true;
    let reason = "";

    if (mainCard) {
      if (mainCard.type === "H_CARD") {
        if (side === "left" || side === "right") isValid = true;
        else {
          isValid = false;
          reason = "左右结构的牌只能放置在左右两侧";
        }
      } else if (mainCard.type === "V_CARD") {
        if (side === "top" || side === "bottom") isValid = true;
        else {
          isValid = false;
          reason = "上下结构的牌只能放置在上下两侧";
        }
      } else {
        isValid = false;
        reason = "该卡牌不是附属卡，不能插在树下";
      }
    }

    this.setData({
      selectedSlot: {
        treeId: treeid,
        side: side,
        isValid: isValid,
        reason: reason,
      },
      targetTreeId: treeid,
    });

    if (!isValid && reason) {
      wx.showToast({ title: reason, icon: "none" });
    }
  },

  async onPlayCard(e) {
    const side = e.currentTarget.dataset.side || "tree";
    const {
      myHand,
      primarySelection,
      targetTreeId,
      gameData,
      selectedSlot,
      isGameOver,
    } = this.data;

    if (isGameOver) {
      wx.showToast({ title: "游戏已结束", icon: "none" });
      return;
    }
    if (!this.isMyTurnNow()) {
      wx.showToast({ title: "当前不是你的回合", icon: "none" });
      return;
    }
    if (this._actionBusy) return;
    this._actionBusy = true;

    try {
      const selected = (myHand || []).filter((c) => c.selected);
      const primaryUid =
        primarySelection && selected.some((c) => c.uid === primarySelection)
          ? primarySelection
          : selected.length > 0
          ? selected[0].uid
          : "";

      const mainCard = selected.find((c) => c.uid === primaryUid);
      if (!mainCard) throw new Error("未选择主牌");

      const paymentCards = selected.filter((c) => c.uid !== primaryUid);

      // --- 1. Identify Species & Cost ---
      let cost = 0;
      let targetSpecies = mainCard;
      let speciesIdx = -1;
      const speciesList = mainCard.speciesDetails || [];

      if (side === "tree") {
        if (mainCard.type === "TREE" || mainCard.type === "W_CARD") {
          if (mainCard.cost !== undefined) cost = Number(mainCard.cost);
          else if (speciesList[0] && speciesList[0].cost !== undefined)
            cost = Number(speciesList[0].cost);
          targetSpecies = speciesList[0] || mainCard;
        } else {
          throw new Error("此牌不能作为树木打出");
        }
      } else {
        // Symbiont check
        if (side === "top" || side === "left") speciesIdx = 0;
        else if (side === "bottom" || side === "right") speciesIdx = 1;

        if (speciesIdx === -1) throw new Error("未知的位置方向");

        if (!speciesList[speciesIdx]) {
          targetSpecies = mainCard; // Fallback
        } else {
          targetSpecies = speciesList[speciesIdx];
        }
        cost = Number(targetSpecies.cost || 0);
      }

      // --- 2. validate Cost ---
      const needPay = Math.max(0, Number(cost));
      if (paymentCards.length !== needPay) {
        throw new Error(
          `需要支付 ${needPay} 张牌，已选 ${paymentCards.length} 张`
        );
      }

      // --- 3. Validate Bonus ---
      let isBonusActive = false;
      if (needPay > 0) {
        isBonusActive = this.checkBonusCondition(mainCard, paymentCards);
      }

      // --- 4. Database Transaction Logic ---
      const { db, room, gameState, myState, myId } =
        await this.withLatestState();

      const latestOrder = gameState.turnOrder || [];
      if (latestOrder[gameState.currentPlayerIdx || 0] !== myId) {
        throw new Error("回合已被抢占，请刷新");
      }

      // Check turn action restriction
      if (gameState.turnAction === "draw") {
        throw new Error("你已摸牌，不能再打出手牌，请继续摸牌或结束回合");
      }

      // Update Hand
      const keptHand = (myState.hand || []).filter(
        (c) =>
          c.uid !== mainCard.uid && !paymentCards.some((p) => p.uid === c.uid)
      );

      // Update Clearing
      const oldClearing = gameState.clearing || [];
      const strippedPayment = paymentCards.map((c) => this.stripCard(c));
      let newClearing = [...oldClearing, ...strippedPayment];

      // Update Forest
      let newForest = [...(myState.forest || [])];
      let cardToAdd = this.stripCard(mainCard);
      cardToAdd.playedSpeciesIndex = speciesIdx;

      let drawCount = 0;
      let extraTurn = false;

      // Parsing Effects
      const getDrawAmt = (txt) => {
        const m = txt && txt.match(/获得(\d+)张牌/);
        return m ? parseInt(m[1]) : 0;
      };
      const checkExtraTurn = (txt) => {
        return txt && txt.includes("再进行一个回合");
      };

      if (targetSpecies.effect) {
        drawCount += getDrawAmt(targetSpecies.effect);
        if (checkExtraTurn(targetSpecies.effect)) extraTurn = true;
      }
      if (isBonusActive && targetSpecies.bonus) {
        drawCount += getDrawAmt(targetSpecies.bonus);
        if (checkExtraTurn(targetSpecies.bonus)) extraTurn = true;
      }

      let winterTriggered = false;
      let actuallyDrawn = 0;

      // Execute Logic for Tree Planting (Draw 1 to clearing if deck not fail)
      if (side === "tree") {
        // New Tree Group
        const newGroup = {
          _id: `tree_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          center: cardToAdd,
          slots: { top: null, bottom: null, left: null, right: null },
        };
        newForest.push(newGroup);

        // Draw 1 card to CLEARING (Rule for planting tree)
        const deck = [...(gameState.deck || [])];
        if (deck.length > 0) {
          const drawn = deck.shift();
          if (drawn.id === "WINTER") {
            gameState.winterCount = (gameState.winterCount || 0) + 1;
            winterTriggered = true;
          } else {
            newClearing.push(this.stripCard(drawn));
          }
        }
        gameState.deck = deck;
      } else {
        // Attach
        const idx = newForest.findIndex((t) => t._id === targetTreeId);
        if (idx === -1) throw new Error("目标树木不存在");
        const group = newForest[idx];
        if (group.slots[side]) throw new Error("位置已占用");

        const updated = { ...group, slots: { ...group.slots } };
        updated.slots[side] = cardToAdd;
        newForest[idx] = updated;
      }

      // Check Clearing Limit (Flush if >= 10)
      // Note: "Flush to box" - here just empty list
      if (newClearing.length >= 10) {
        newClearing = [];
      }

      // Execute Rewards (Draw Cards to HAND)
      // Note: This modifies gameState.deck and keptHand further
      if (drawCount > 0) {
        const deck = gameState.deck; // Ref to current deck state (modified by tree plant maybe)
        for (let i = 0; i < drawCount; i++) {
          if (deck.length > 0) {
            const c = deck.shift();
            if (c.id === "WINTER") {
              gameState.winterCount = (gameState.winterCount || 0) + 1;
              winterTriggered = true;
            } else {
              keptHand.push(this.stripCard(c));
              actuallyDrawn++;
            }
          }
        }
      }

      if ((gameState.winterCount || 0) >= 3) {
        gameState.status = "finished";
      }

      const nextPlayerState = {
        ...myState,
        hand: keptHand,
        forest: newForest,
      };

      const rawNextGameState = {
        ...gameState,
        // deck is already updated in place
        clearing: newClearing,
        playerStates: {
          ...gameState.playerStates,
          [myId]: nextPlayerState,
        },
      };

      if (extraTurn) {
        rawNextGameState.drawCount = 0;
        rawNextGameState.turnAction = null;
      }

      const turnSummary = {
        playerNick: this.data.userProfile.nickName,
        playerAvatar: this.data.userProfile.avatarUrl,
        playerOpenId: this.getMyOpenId(), // Added for filtering own logs
        playedCard: this.stripCard(mainCard),
        paidCards: strippedPayment,
        actionTime: Date.now(),
      };

      const finalGameState = extraTurn
        ? rawNextGameState
        : this.advanceTurn(rawNextGameState);
      // Attach summary to game state
      finalGameState.lastTurnSummary = turnSummary;

      // Add Log
      const logText = `${this.data.userProfile.nickName} 打出了 ${
        mainCard.name || "Cards"
      }`;
      const logCards = [
        { ...this.stripCard(mainCard), logType: "played" },
        ...strippedPayment.map((c) => ({
          ...this.stripCard(c),
          logType: "paid",
        })),
      ];
      this.appendLog(finalGameState, logText, logCards);

      await db
        .collection("rooms")
        .doc(room._id)
        .update({
          data: { gameState: finalGameState },
        });

      const parts = [];
      if (side === "tree") parts.push("种植成功");
      else parts.push("打出成功");
      if (isBonusActive) parts.push("奖励激活");
      if (actuallyDrawn > 0) parts.push(`摸牌${actuallyDrawn}张`);
      if (extraTurn) parts.push("获得额外回合");

      wx.showToast({ title: parts.join("，"), icon: "none" });

      if (winterTriggered) {
        // Additional alert
        setTimeout(
          () => wx.showToast({ title: "翻出了冬季卡！", icon: "none" }),
          1500
        );
      }

      this.setData({
        primarySelection: "",
        selectedSlot: null,
        targetTreeId: "",
        myHand: (this.data.myHand || []).map((c) => ({
          ...c,
          selected: false,
        })),
        isMyTurn: extraTurn ? true : false,
      });
    } catch (err) {
      console.error(err);
      wx.showToast({ title: err.message || "出牌失败", icon: "none" });
    } finally {
      this._actionBusy = false;
    }
  },

  async onPlayCard_OLD(e) {
    // Determine Mode: Plant Tree or Attach Symbiont?
    // Passed via data-side: 'tree', 'top', 'bottom', 'left', 'right'
    const side = e.currentTarget.dataset.side || "tree";

    const selected = (this.data.myHand || []).filter((c) => c.selected);
    if (!selected.length) {
      wx.showToast({ title: "请选择要打出的主牌和支付牌", icon: "none" });
      return;
    }
    if (!this.isMyTurnNow()) {
      wx.showToast({ title: "当前不是你的回合", icon: "none" });
      return;
    }
    if (this._actionBusy) return;
    this._actionBusy = true;

    try {
      const primaryUid =
        this.data.primarySelection &&
        selected.some((c) => c.uid === this.data.primarySelection)
          ? this.data.primarySelection
          : selected[0].uid;
      const mainCard = selected.find((c) => c.uid === primaryUid);
      if (!mainCard) throw new Error("未找到主牌");

      // --- Validation & Setup ---
      const isTreeAction = side === "tree";

      // Cost Calculation
      // If split card, cost depends on which species we picked.
      // mainCard.speciesDetails has [0] and [1].
      let cost = 0;
      let speciesIndex = 0;

      if (isTreeAction) {
        // If playing as tree (or sapling logic handled separately), use full card cost?
        // Trees usually have simple cost.
        cost = mainCard.cost !== undefined ? mainCard.cost : 0;
      } else {
        // Playing as symbiont
        if (side === "top" || side === "left") speciesIndex = 0;
        if (side === "bottom" || side === "right") speciesIndex = 1;

        if (mainCard.speciesDetails && mainCard.speciesDetails[speciesIndex]) {
          cost = mainCard.speciesDetails[speciesIndex].cost || 0;
        } else {
          // Fallback
          cost = mainCard.cost || 0;
        }
      }

      const payCards = selected.filter((c) => c.uid !== primaryUid);
      const needPay = Math.max(0, Number(cost));

      if (payCards.length < needPay) {
        throw new Error(`需要支付 ${needPay} 张牌，已选 ${payCards.length} 张`);
      }
      if (payCards.length > needPay) {
        throw new Error(
          `只需支付 ${needPay} 张牌，已多选 ${payCards.length - needPay} 张`
        );
      }

      const { db, room, gameState, myState, myId } =
        await this.withLatestState();

      // Check Game Over again
      if (
        gameState.status === "finished" ||
        (gameState.winterCount || 0) >= 3
      ) {
        throw new Error("游戏已结束");
      }

      // Validate Tree Target if attaching
      let targetTree = null;
      let targetTreeIdx = -1;
      const forest = myState.forest || []; // This is raw data from DB

      if (!isTreeAction) {
        const tid = this.data.targetTreeId;
        if (!tid) throw new Error("请先点击选择一棵森林中的树木作为目标");

        targetTreeIdx = forest.findIndex((t) => t._id === tid);
        if (targetTreeIdx < 0) throw new Error("目标树木不存在");
        targetTree = forest[targetTreeIdx];

        // Check slot occupancy
        if (targetTree.slots && targetTree.slots[side]) {
          throw new Error(`这棵树的${side}位置已被占用`);
        }

        // Guard: Cannot effect tree if not my turn or VIEWING OTHER PLAYER
        if (
          this.data.viewingPlayerId &&
          this.data.viewingPlayerId !== this.getMyOpenId()
        ) {
          throw new Error("只能在自己的森林中打牌");
        }

        // Validate Card Type for Slot
        if (side === "left" || side === "right") {
          if (mainCard.type !== "H_CARD")
            throw new Error("该位置只能放置左右结构的卡牌");
        }
        if (side === "top" || side === "bottom") {
          if (mainCard.type !== "V_CARD")
            throw new Error("该位置只能放置上下结构的卡牌");
        }
      }

      // --- Execution ---
      const hand = myState.hand || [];
      const payList = payCards.slice(0, needPay);
      const paySet = new Set(payList.map((c) => c.uid));
      const removeSet = new Set([primaryUid, ...payList.map((c) => c.uid)]);
      const nextHand = hand.filter((c) => !removeSet.has(c.uid));

      // Prepare the card to add
      const cardToAdd = this.stripCard(mainCard);
      // If we are playing a specific species half, we should mark it?
      // Actually the card data stores the ID.
      // Ideally we store { ...card, playedIndex: speciesIndex } so we know which half to display active.
      cardToAdd.playedSpeciesIndex = speciesIndex;

      let nextForest = [...forest];

      if (isTreeAction) {
        // Plant new tree
        const newTree = {
          _id: `tree_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          center: cardToAdd,
          slots: { top: null, bottom: null, left: null, right: null },
        };
        nextForest.push(newTree);

        // Rule: Draw 1 card to clearing when planting a tree
        const deck = [...(gameState.deck || [])];
        let clearing = [...(gameState.clearing || [])];

        if (deck.length > 0) {
          const drawn = deck.shift();
          if (drawn.id === "WINTER") {
            const wCount = (gameState.winterCount || 0) + 1;
            gameState.winterCount = wCount;
            if (wCount >= 3) gameState.status = "finished";
          } else {
            clearing.push(this.stripCard(drawn));
          }
        }

        // Apply Clearing Limit after adding
        clearing = this.checkClearingLimit(clearing);

        gameState.deck = deck;
        gameState.clearing = clearing;
      } else {
        // Attach to slot
        const updatedTree = { ...targetTree };
        updatedTree.slots = { ...updatedTree.slots, [side]: cardToAdd };
        nextForest[targetTreeIdx] = updatedTree;
      }

      // Handle Payment -> Clearing
      // If payment cards exist, add them to CURRENT gameState.clearing
      // Note: If we planted a tree, we updated gameState.clearing in the 'if' block above.
      // We must start from that potentially updated clearing.
      let finalClearing = gameState.clearing || [];

      if (payCards.length > 0) {
        finalClearing = [
          ...finalClearing,
          ...payCards.map((c) => this.stripCard(c)),
        ];
      }
      // Check limit again (once at the end of transaction)
      finalClearing = this.checkClearingLimit(finalClearing);

      const nextMine = { ...myState, hand: nextHand, forest: nextForest };
      const nextState = {
        ...gameState,
        clearing: finalClearing,
        playerStates: { ...gameState.playerStates, [myId]: nextMine },
      };

      const advanced = this.advanceTurn(nextState);

      await db
        .collection("rooms")
        .doc(room._id)
        .update({
          data: { gameState: advanced },
        });

      this.setData({
        primarySelection: "",
        targetTreeId: "",
        myHand: (this.data.myHand || []).map((c) => ({
          ...c,
          selected: false,
        })),
      });

      // --- Execute Bonus / Effects ---
      let msg = isTreeAction ? "种植成功" : "打出成功";

      // 1. Check & Execute Bonus
      // Logic: Condition met -> Execute Bonus effects (e.g. Draw Cards)
      // Note: "Effect" (Always happens) vs "Bonus" (Condition).
      // Since our data structure puts "Points" in 'points' and immediate actions?
      // "effect": "获得1张牌" (This is 'Effect')
      // "bonus": "获得1张牌" (This is 'Bonus')

      let drawCount = 0;
      let bonusTriggered = false;

      // Determine active species data
      let activeData = null;
      if (isTreeAction) {
        activeData = mainCard; // Trees usually utilize main props
        if (mainCard.speciesDetails && mainCard.speciesDetails[0]) {
          // Fallback for tree species data
          if (!activeData.effect) activeData = mainCard.speciesDetails[0];
        }
      } else {
        // Played as symbiont
        const spIndex = cardToAdd.playedSpeciesIndex || 0;
        activeData = mainCard.speciesDetails
          ? mainCard.speciesDetails[spIndex]
          : mainCard;
      }

      if (activeData) {
        // 1. Always Trigger Effect
        if (activeData.effect) {
          if (
            activeData.effect.includes("获得1张牌") ||
            activeData.effect.includes("Receive 1 card")
          ) {
            drawCount += 1;
          } else if (
            activeData.effect.includes("获得2张牌") ||
            activeData.effect.includes("Receive 2 cards")
          ) {
            drawCount += 2;
          }
          // TODO: Handle other effects
        }

        // 2. Check Bonus Condition
        if (activeData.bonus) {
          const conditionMet = this.checkBonusCondition(mainCard, payCards);
          if (conditionMet) {
            bonusTriggered = true;
            if (
              activeData.bonus.includes("获得1张牌") ||
              activeData.bonus.includes("Receive 1 card")
            ) {
              drawCount += 1;
            } else if (
              activeData.bonus.includes("获得2张牌") ||
              activeData.bonus.includes("Receive 2 cards")
            ) {
              drawCount += 2;
            }
            msg += " (触发奖励!)";
          }
        }
      }

      // Execute Draws
      if (drawCount > 0) {
        // Perform Draw Logic
        // We need to fetch latest state loop or just update local optimism?
        // Since we just updated `gameState` in cloud, we should ideally chain this.
        // BUT: The previous `update` call finished. We can call `onDrawCard` logic or manually update.
        // Calling local draw is risky if state changed.
        // Let's do a quick optimisic update or separate call for now.
        // Actually, we should have done this IN the transaction or updated the gameState object before sending.
        // RETROACTIVE FIX: We already sent the update. We need to send ANOTHER update or move logic up.
        // Moving logic up is better but `checkBonusCondition` needs `payCards`.
        // I will do a follow-up draw operation immediately.

        wx.showToast({
          title: `${msg}\n正在抽取 ${drawCount} 张牌...`,
          icon: "none",
        });
        await this.doBonusDraw(drawCount);
      } else {
        wx.showToast({ title: msg, icon: "success" });
      }
    } catch (err) {
      console.error("Play card failed", err);
      wx.showToast({ title: err.message || "操作失败", icon: "none" });
    } finally {
      this._actionBusy = false;
    }
  },

  async doBonusDraw(count) {
    if (count <= 0) return;
    try {
      const { db, room, gameState, myState, myId } =
        await this.withLatestState();
      const deck = [...(gameState.deck || [])];
      const nextMine = { ...myState, hand: [...(myState.hand || [])] };

      let actualDrawn = 0;
      for (let i = 0; i < count; i++) {
        if (deck.length === 0) break;
        const drawn = deck.shift();
        if (drawn.id === "WINTER") {
          gameState.winterCount = (gameState.winterCount || 0) + 1;
          if (gameState.winterCount >= 3) gameState.status = "finished";
        } else {
          nextMine.hand.push(this.stripCard(drawn));
          actualDrawn++;
        }
      }

      gameState.deck = deck;
      gameState.playerStates[myId] = nextMine;

      await db.collection("rooms").doc(room._id).update({
        data: { gameState },
      });
    } catch (e) {
      console.error("Bonus draw failed", e);
    }
  },

  async onPlaySapling() {
    const selected = (this.data.myHand || []).filter((c) => c.selected);
    if (!selected.length) {
      wx.showToast({ title: "请选择 1 张要当树苗的牌", icon: "none" });
      return;
    }
    if (!this.isMyTurnNow()) {
      wx.showToast({ title: "当前不是你的回合", icon: "none" });
      return;
    }
    if (this._actionBusy) return;
    if (this.data.isGameOver) {
      wx.showToast({ title: "游戏已结束", icon: "none" });
      return;
    }
    this._actionBusy = true;

    try {
      const primaryUid =
        this.data.primarySelection &&
        selected.some((c) => c.uid === this.data.primarySelection)
          ? this.data.primarySelection
          : selected[0].uid;

      const { db, room, gameState, myState, myId } =
        await this.withLatestState();
      const latestOrder = gameState.turnOrder || [];
      if (latestOrder[gameState.currentPlayerIdx || 0] !== myId) {
        wx.showToast({ title: "当前不是你的回合", icon: "none" });
        return;
      }
      const hand = myState.hand || [];
      const target = hand.find((c) => c.uid === primaryUid);
      if (!target) throw new Error("这张牌已不在手牌中");

      const nextHand = hand.filter((c) => c.uid !== primaryUid);

      const newSaplingTree = {
        _id: `tree_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        center: { ...this.stripCard(target), sapling: true },
        slots: { top: null, bottom: null, left: null, right: null },
      };

      const nextMine = {
        ...myState,
        hand: nextHand,
        forest: [...(myState.forest || []), newSaplingTree],
      };

      // Rule: Draw 1 card to clearing when planting a sapling (Same as Tree)
      const deck = [...(gameState.deck || [])];
      let clearing = [...(gameState.clearing || [])];

      if (deck.length > 0) {
        const drawn = deck.shift();
        if (drawn.id === "WINTER") {
          const wCount = (gameState.winterCount || 0) + 1;
          gameState.winterCount = wCount;
          if (wCount >= 3) gameState.status = "finished";
        } else {
          clearing.push(this.stripCard(drawn));
        }
      }
      clearing = this.checkClearingLimit(clearing);

      const nextState = {
        ...gameState,
        deck,
        clearing,
        playerStates: { ...gameState.playerStates, [myId]: nextMine },
      };
      const advanced = this.advanceTurn(nextState);

      // Add Log
      const logText = `${this.data.userProfile.nickName} 打出了 ${
        target.name || "树苗"
      } (作为树苗)`;
      const logCards = [{ ...this.stripCard(target), logType: "played" }];
      this.appendLog(advanced, logText, logCards);

      await db
        .collection("rooms")
        .doc(room._id)
        .update({
          data: { gameState: advanced },
        });

      this.setData({
        primarySelection: "",
        myHand: (this.data.myHand || []).map((c) => ({
          ...c,
          selected: false,
        })),
      });
      wx.showToast({ title: "作为树苗打出", icon: "none" });
    } catch (err) {
      console.error("Play sapling failed", err);
      wx.showToast({ title: err.message || "操作失败，请重试", icon: "none" });
    } finally {
      this._actionBusy = false;
    }
  },

  onShowDetail(e) {
    // 兼容点击和长按事件对象的 dataset 获取
    const { type, uid, idx } = e.currentTarget.dataset;
    let card = null;

    if (type === "hand") {
      card = this.data.myHand.find((c) => c.uid === uid);
    } else if (type === "clearing") {
      card = this.data.clearing[idx];
    }

    if (card) {
      this.setData({
        previewCard: card,
        showDetailModal: true,
        activeTab: 0, // Reset tab
      });
    }
  },

  onCloseDetail() {
    this.setData({
      showDetailModal: false,
      previewCard: null,
    });
  },

  onShowLogDetail(e) {
    const card = e.currentTarget.dataset.card;
    if (card) {
      this.setData({
        previewCard: card,
        showDetailModal: true,
        activeTab: 0,
      });
    }
  },

  onCloseSummary() {
    this.setData({ showTurnSummary: false });
    if (this._summaryTimer) clearTimeout(this._summaryTimer);
  },

  onTabChange(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ activeTab: index });
  },

  onShowLogs() {
    this.setData({ showLogModal: true });
  },

  onCloseLogs() {
    this.setData({ showLogModal: false });
    if (this._logTimer) clearTimeout(this._logTimer);
  },

  onPlayerTap(e) {
    const pid = e.currentTarget.dataset.openid;
    if (pid && pid !== this.data.viewingPlayerId) {
      this.setData({ viewingPlayerId: pid }, () => {
        if (this.roomCache) this.handleGameUpdate(this.roomCache);
      });
    }
  },

  noop() {},
});
