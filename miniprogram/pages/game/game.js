Page({
  data: {
    gameData: null,
    myHand: [],
    roomId: '',
    allPlayers: [],
    clearing: [],
    myForest: [],
    myScore: 0,
    deckCount: 0,
    instructionText: '',
    previewCard: null,
    showDetailModal: false,
    activeTab: 0,
    primarySelection: '',
    isMyTurn: false
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
    this.gameWatcher = db.collection('rooms').doc(roomId).watch({
      onChange: (snapshot) => {
        if (snapshot.docs && snapshot.docs[0]) {
          const room = snapshot.docs[0];
          this.handleGameUpdate(room);
        }
      },
      onError: (err) => console.error('Game watch error', err)
    });
  },

  handleGameUpdate(room) {
    const app = getApp();
    const myOpenId = app.globalData.userProfile?.openId;
    const prevSelected = new Set((this.data.myHand || []).filter(c => c.selected).map(c => c.uid));
    const prevPrimary = this.data.primarySelection || '';
    
    // 假设 gameState 结构
    const gameState = room.gameState || {};
    const playerStates = gameState.playerStates || {};
    const myState = playerStates[myOpenId];

    // 处理玩家列表 (6个座位)
    const rawPlayers = room.players || Array(6).fill(null);
    const allPlayers = rawPlayers.map(p => {
      if (!p) return { isEmpty: true };
      
      const pState = playerStates[p.openId];
      return {
        isEmpty: false,
        openId: p.openId,
        nickName: p.nickName,
        avatarUrl: p.avatarUrl,
        isMe: p.openId === myOpenId,
        handCount: pState ? (pState.hand || []).length : 0,
        score: pState ? pState.score : 0
      };
    });
    
    // 处理手牌：将 ID 映射回详细信息
    const speciesData = require('../../data/speciesData.js');
    const bgaData = require('../../data/bgaCardData.js');
    const dict = speciesData.byName || speciesData;

    // --- Image Helper Logic (Unified with Gallery) ---
    const remoteBase = 'https://x.boardgamearena.net/data/themereleases/current/games/forestshuffle/250929-1034/img';
    const remoteMap = {
      'trees.jpg': `${remoteBase}/trees.jpg`,
      'hcards.jpg': `${remoteBase}/hCards.jpg`,
      'vcards.jpg': `${remoteBase}/vCards.jpg`,
      'mountain.jpg': `${remoteBase}/mountain.jpg`,
      'woodlands.jpg': `${remoteBase}/woodlands.Jpg`,
      'trees.webp': `${remoteBase}/trees.jpg`,
      'hcards.webp': `${remoteBase}/hCards.jpg`,
      'vcards.webp': `${remoteBase}/vCards.jpg`,
      'mountain.webp': `${remoteBase}/mountain.jpg`,
      'hCards.jpg': `${remoteBase}/hCards.jpg`,
      'vCards.jpg': `${remoteBase}/vCards.jpg`,
      'woodlands.Jpg': `${remoteBase}/woodlands.Jpg`
    };

    const toRemote = (img = '') => {
      if (!img) return img;
      if (/^https?:\/\//.test(img)) return img;
      const name = img.split('/').pop();
      const lower = name.toLowerCase();
      if (remoteMap[name]) return remoteMap[name];
      if (remoteMap[lower]) return remoteMap[lower];
      return img;
    };

    const defaultSpriteByType = {
      H_CARD: toRemote('/images/cards/hcards.jpg'),
      V_CARD: toRemote('/images/cards/vcards.jpg'),
      W_CARD: toRemote('/images/cards/trees.jpg'),
      TREE: toRemote('/images/cards/trees.jpg')
    };

    const spriteGridByFile = {
      'trees.webp': { cols: 5, rows: 5 },
      'trees.jpg': { cols: 5, rows: 5 },
      'hcards.webp': { cols: 7, rows: 7 },
      'hcards.jpg': { cols: 7, rows: 7 },
      'vcards.webp': { cols: 7, rows: 7 },
      'vcards.jpg': { cols: 7, rows: 7 },
      'mountain.webp': { cols: 7, rows: 4 },
      'mountain.jpg': { cols: 7, rows: 4 },
      'woodlands.jpg': { cols: 6, rows: 6 }
    };

    const resolveImg = (card) => {
        if (card.img && card.img.trim()) {
            return toRemote(card.img.trim());
        }
        return defaultSpriteByType[card.type] || defaultSpriteByType.TREE;
    };

    const getGrid = (img, type) => {
        const fname = img.split('/').pop().toLowerCase();
        if (fname.includes('mountain')) return { cols: 7, rows: 4 };
        if (spriteGridByFile[fname]) return spriteGridByFile[fname];
        if (type === 'H_CARD') return spriteGridByFile['hcards.jpg'];
        if (type === 'V_CARD') return spriteGridByFile['vcards.jpg'];
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
    Object.values(bgaData.cards).forEach(card => {
        if (!card.species) return;
        card.species.forEach(sp => {
            const normalized = String(sp).toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (!cardVisualMap[normalized]) {
                cardVisualMap[normalized] = card;
            }
        });
    });
    // --- End Image Helper Logic ---

    // --- Species Metadata Helper (Copied/Adapted from Gallery.js) ---
    const tagMap = {
      'Tree': '树', 'tree': '树', 'Plant': '植物', 'plant': '植物', 'Mushroom': '蘑菇', 'mushroom': '蘑菇',
      'Bird': '鸟类', 'bird': '鸟类', 'Insect': '昆虫', 'insect': '昆虫', 'Butterfly': '蝴蝶', 'butterfly': '蝴蝶',
      'Amphibian': '两栖动物', 'amphibian': '两栖动物', 'Paw': '兽类', 'paw': '兽类', 'Bat': '蝙蝠', 'bat': '蝙蝠',
      'Deer': '鹿', 'deer': '鹿', 'Cloven-hoofed animal': '偶蹄动物', 'cloven-hoofed animal': '偶蹄动物',
      'Mountain': '山脉', 'mountain': '山脉', 'Woodland Edge': '林缘', 'woodland edge': '林缘', 'Shrub': '灌木', 'shrub': '灌木'
    };

    const findSpeciesMeta = (code = '') => {
        if (!code) return null;
        // speciesData.byName is already loaded
        const meta = speciesData.byName[code] || speciesData.byName[code.toLowerCase()] || speciesData.byConst[code];
        return meta;
    };

    const enrichCard = (simpleCard) => {
        if (!simpleCard || !simpleCard.id) return null;
        
        let base = null;
        let visualCard = null;

        if (simpleCard.id === 'WINTER') {
             base = { ...simpleCard, name: '冬季卡', type: 'WINTER', color: '#a0d8ef' };
             visualCard = bgaData.cards['67']; 
        } else {
             const def = dict[simpleCard.id];
             base = def ? { ...def, ...simpleCard } : simpleCard;
             const normalizedKey = String(simpleCard.id).toUpperCase().replace(/[^A-Z0-9]/g, '');
             visualCard = cardVisualMap[normalizedKey];
        }

        if (visualCard) {
            const visual = resolveImg(visualCard);
            const grid = getGrid(visual, visualCard.type);
            base.img = visual;
            base.spriteStyle = computeSpriteStyle(visualCard.x, visualCard.y, grid);
            
            // Enrich with detailed structure for "Gallery-style" modal
            const speciesList = visualCard.species || [];
            base.speciesDetails = speciesList.map(code => {
                 const meta = findSpeciesMeta(code) || {};
                 const rawTags = (meta.tags && meta.tags.length) ? meta.tags : (meta.tags_en || []);
                 const tags = rawTags.map(t => {
                    const k = (t || '').trim();
                    return tagMap[k] || tagMap[k.toLowerCase()] || k;
                 }).filter(Boolean);

                 return {
                    key: code,
                    displayName: meta.name || meta.name_en || code,
                    tags: tags,
                    cost: meta.cost,
                    type: meta.type,
                    nb: meta.nb,
                    effect: meta.effect || '',
                    bonus: meta.bonus || '',
                    points: meta.points || meta.points_en || ''
                 };
            });
            // Try to find a primary name if missing
            if (!base.name && base.speciesDetails.length) {
                base.name = base.speciesDetails.map(s => s.displayName).join(' / ');
            }
        }
        return base;
    };

    const rawHand = myState ? myState.hand : [];
    const richHand = rawHand.map(enrichCard).filter(c => c).map(c => ({
      ...c,
      selected: prevSelected.has(c.uid)
    }));

    // 处理空地区域 (Clearing)
    const rawClearing = gameState.clearing || [];
    const richClearing = rawClearing.map(enrichCard).filter(c => c);

    // 处理森林区域 (My Forest)
    const rawForest = myState ? (myState.forest || []) : [];
    const richForest = rawForest.map(enrichCard).filter(c => c);

    const deckCount = (gameState.deck || []).length;
    const winterCount = gameState.winterCount || 0;

    const isMyTurn = (gameState.turnOrder && gameState.turnOrder[gameState.currentPlayerIdx || 0] === myOpenId);
    const instructionText = isMyTurn ? '轮到你了：可摸牌或打出手牌' : '等待其他玩家行动...';
    const nextPrimary = prevSelected.has(prevPrimary) ? prevPrimary : (richHand.find(c => c.selected)?.uid || '');

    this.setData({
      gameData: gameState,
      allPlayers: allPlayers,
      myHand: richHand,
      clearing: richClearing,
      myForest: richForest, // 新增森林数据
      myScore: myState ? myState.score : 0,
      deckCount: deckCount,
      instructionText: instructionText,
      userProfile: app.globalData.userProfile || {},
      primarySelection: nextPrimary,
      isMyTurn: isMyTurn
    });

    // 动态更新标题
    wx.setNavigationBarTitle({
      title: `牌库 (${deckCount}) - 冬季卡 (${winterCount})` 
    });
  },

  stripCard(card = {}) {
    const base = { id: card.id, uid: card.uid };
    if (card.sapling) base.sapling = true;
    return base;
  },

  getMyOpenId() {
    return getApp().globalData.userProfile?.openId;
  },

  isMyTurnNow() {
    const { gameData } = this.data;
    const myId = this.getMyOpenId();
    const order = gameData?.turnOrder || [];
    if (!order.length) return false;
    return order[(gameData.currentPlayerIdx || 0)] === myId;
  },

  async withLatestState() {
    const roomId = this.data.roomId;
    if (!roomId) throw new Error('缺少房间 ID');
    const db = wx.cloud.database();
    const res = await db.collection('rooms').doc(roomId).get();
    const room = res.data;
    if (!room || !room.gameState) throw new Error('游戏未初始化');
    const gameState = room.gameState;
    const myId = this.getMyOpenId();
    const myState = gameState.playerStates?.[myId];
    if (!myState) throw new Error('未找到你的玩家状态');
    return { db, room, gameState, myState, myId };
  },

  advanceTurn(state) {
    const order = state.turnOrder || [];
    if (!order.length) return state;
    const nextIdx = ((state.currentPlayerIdx || 0) + 1) % order.length;
    return { ...state, currentPlayerIdx: nextIdx };
  },

  onCardTap(e) {
    const uid = e.currentTarget.dataset.uid;
    const { myHand, primarySelection } = this.data;
    let nextPrimary = primarySelection;
    const newHand = (myHand || []).map(c => {
      if (c.uid === uid) {
        const toggled = !c.selected;
        if (toggled && !nextPrimary) {
          nextPrimary = uid;
        } else if (!toggled && nextPrimary === uid) {
          nextPrimary = '';
        }
        return { ...c, selected: toggled };
      }
      return c; 
    });

    if (!nextPrimary) {
      const fallback = newHand.find(item => item.selected);
      nextPrimary = fallback ? fallback.uid : '';
    }
    this.setData({ myHand: newHand, primarySelection: nextPrimary });
  },

  async onDrawCard() {
    if (!this.isMyTurnNow()) {
      wx.showToast({ title: '当前不是你的回合', icon: 'none' });
      return;
    }
    if (this._actionBusy) return;
    this._actionBusy = true;
    try {
      const { db, room, gameState, myState, myId } = await this.withLatestState();
      const latestOrder = gameState.turnOrder || [];
      if (latestOrder[(gameState.currentPlayerIdx || 0)] !== myId) {
        wx.showToast({ title: '当前不是你的回合', icon: 'none' });
        return;
      }
      const deck = [...(gameState.deck || [])];
      if (!deck.length) {
        wx.showToast({ title: '牌库已空', icon: 'none' });
        return;
      }
      const drawn = deck.shift();
      const nextState = { ...gameState, deck, playerStates: { ...gameState.playerStates } };
      const nextMine = { ...myState, hand: [...(myState.hand || [])] };

      if (drawn.id === 'WINTER') {
        nextState.winterCount = (nextState.winterCount || 0) + 1;
      } else {
        nextMine.hand.push(this.stripCard(drawn));
      }

      nextState.playerStates[myId] = nextMine;
      const advanced = this.advanceTurn(nextState);

      await db.collection('rooms').doc(room._id).update({
        data: { gameState: advanced }
      });
      wx.showToast({ title: drawn.id === 'WINTER' ? '翻出冬季卡' : '摸到 1 张牌', icon: 'none' });
    } catch (err) {
      console.error('Draw card failed', err);
      wx.showToast({ title: err.message || '操作失败，请重试', icon: 'none' });
    } finally {
      this._actionBusy = false;
    }
  },

  async onTakeFromClearing(e) {
    if (!this.isMyTurnNow()) {
      wx.showToast({ title: '当前不是你的回合', icon: 'none' });
      return;
    }
    if (this._actionBusy) return;
    this._actionBusy = true;
    try {
      const idx = Number(e.currentTarget.dataset.idx);
      const { db, room, gameState, myState, myId } = await this.withLatestState();
      const latestOrder = gameState.turnOrder || [];
      if (latestOrder[(gameState.currentPlayerIdx || 0)] !== myId) {
        wx.showToast({ title: '当前不是你的回合', icon: 'none' });
        return;
      }
      const clearing = [...(gameState.clearing || [])];
      const picked = clearing[idx];
      if (!picked) {
        wx.showToast({ title: '这个位置没有牌', icon: 'none' });
        return;
      }
      clearing.splice(idx, 1);

      const nextState = {
        ...gameState,
        clearing,
        playerStates: { ...gameState.playerStates }
      };
      const nextMine = {
        ...myState,
        hand: [...(myState.hand || []), this.stripCard(picked)]
      };
      nextState.playerStates[myId] = nextMine;
      const advanced = this.advanceTurn(nextState);

      await db.collection('rooms').doc(room._id).update({
        data: { gameState: advanced }
      });
      wx.showToast({ title: '从空地拿到 1 张牌', icon: 'none' });
    } catch (err) {
      console.error('Take from clearing failed', err);
      wx.showToast({ title: err.message || '操作失败，请重试', icon: 'none' });
    } finally {
      this._actionBusy = false;
    }
  },

  async onPlayCard() {
    const selected = (this.data.myHand || []).filter(c => c.selected);
    if (!selected.length) {
      wx.showToast({ title: '请选择要打出的主牌和支付牌', icon: 'none' });
      return;
    }
    if (!this.isMyTurnNow()) {
      wx.showToast({ title: '当前不是你的回合', icon: 'none' });
      return;
    }
    if (this._actionBusy) return;
    this._actionBusy = true;

    try {
      const primaryUid = (this.data.primarySelection && selected.some(c => c.uid === this.data.primarySelection))
        ? this.data.primarySelection
        : selected[0].uid;
      const mainCard = selected.find(c => c.uid === primaryUid);
      if (!mainCard) {
        wx.showToast({ title: '未找到主牌', icon: 'none' });
        return;
      }
      const payCards = selected.filter(c => c.uid !== primaryUid);
      const needPay = Math.max(0, Number(mainCard && mainCard.cost !== undefined ? mainCard.cost : 0)) || 0;

      if (payCards.length < needPay) {
        wx.showToast({ title: `还需选择 ${needPay - payCards.length} 张支付牌`, icon: 'none' });
        return;
      }

      const { db, room, gameState, myState, myId } = await this.withLatestState();
      const latestOrder = gameState.turnOrder || [];
      if (latestOrder[(gameState.currentPlayerIdx || 0)] !== myId) {
        wx.showToast({ title: '当前不是你的回合', icon: 'none' });
        return;
      }
      const hand = myState.hand || [];
      const payList = payCards.slice(0, needPay);
      const paySet = new Set(payList.map(c => c.uid));

      const mainRaw = hand.find(c => c.uid === primaryUid);
      if (!mainRaw) throw new Error('主牌已不在手牌中');

      const payRaw = hand.filter(c => paySet.has(c.uid));
      if (payRaw.length < paySet.size) {
        throw new Error('支付的牌已变化，请重选');
      }

      const removeSet = new Set([primaryUid, ...payList.map(c => c.uid)]);
      const nextHand = hand.filter(c => !removeSet.has(c.uid));
      const nextState = {
        ...gameState,
        clearing: [...(gameState.clearing || []), ...payRaw.map(card => this.stripCard(card))],
        playerStates: { ...gameState.playerStates }
      };
      const nextMine = {
        ...myState,
        hand: nextHand,
        forest: [...(myState.forest || []), this.stripCard(mainRaw)]
      };
      nextState.playerStates[myId] = nextMine;
      const advanced = this.advanceTurn(nextState);

      await db.collection('rooms').doc(room._id).update({
        data: { gameState: advanced }
      });

      this.setData({
        primarySelection: '',
        myHand: (this.data.myHand || []).map(c => ({ ...c, selected: false }))
      });
      wx.showToast({ title: '已打出', icon: 'none' });
    } catch (err) {
      console.error('Play card failed', err);
      wx.showToast({ title: err.message || '操作失败，请重试', icon: 'none' });
    } finally {
      this._actionBusy = false;
    }
  },

  async onPlaySapling() {
    const selected = (this.data.myHand || []).filter(c => c.selected);
    if (!selected.length) {
      wx.showToast({ title: '请选择 1 张要当树苗的牌', icon: 'none' });
      return;
    }
    if (!this.isMyTurnNow()) {
      wx.showToast({ title: '当前不是你的回合', icon: 'none' });
      return;
    }
    if (this._actionBusy) return;
    this._actionBusy = true;

    try {
      const primaryUid = (this.data.primarySelection && selected.some(c => c.uid === this.data.primarySelection))
        ? this.data.primarySelection
        : selected[0].uid;

      const { db, room, gameState, myState, myId } = await this.withLatestState();
      const latestOrder = gameState.turnOrder || [];
      if (latestOrder[(gameState.currentPlayerIdx || 0)] !== myId) {
        wx.showToast({ title: '当前不是你的回合', icon: 'none' });
        return;
      }
      const hand = myState.hand || [];
      const target = hand.find(c => c.uid === primaryUid);
      if (!target) throw new Error('这张牌已不在手牌中');

      const nextHand = hand.filter(c => c.uid !== primaryUid);
      const nextMine = {
        ...myState,
        hand: nextHand,
        forest: [...(myState.forest || []), { ...this.stripCard(target), sapling: true }]
      };

      const nextState = {
        ...gameState,
        playerStates: { ...gameState.playerStates, [myId]: nextMine }
      };
      const advanced = this.advanceTurn(nextState);

      await db.collection('rooms').doc(room._id).update({
        data: { gameState: advanced }
      });

      this.setData({
        primarySelection: '',
        myHand: (this.data.myHand || []).map(c => ({ ...c, selected: false }))
      });
      wx.showToast({ title: '作为树苗打出', icon: 'none' });
    } catch (err) {
      console.error('Play sapling failed', err);
      wx.showToast({ title: err.message || '操作失败，请重试', icon: 'none' });
    } finally {
      this._actionBusy = false;
    }
  },

  onShowDetail(e) {
    // 兼容点击和长按事件对象的 dataset 获取
    const { type, uid, idx } = e.currentTarget.dataset;
    let card = null;

    if (type === 'hand') {
       card = this.data.myHand.find(c => c.uid === uid);
    } else if (type === 'clearing') {
       card = this.data.clearing[idx];
    }

    if (card) {
      this.setData({
        previewCard: card,
        showDetailModal: true,
        activeTab: 0 // Reset tab
      });
    }
  },

  onCloseDetail() {
    this.setData({
      showDetailModal: false,
      previewCard: null
    });
  },

  onTabChange(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ activeTab: index });
  },

  noop() {}
});
