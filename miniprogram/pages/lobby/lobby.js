const STORAGE_KEY = 'userProfile';
const BASE_DECK_SIZE = 180; // 官方基础牌库张数（可按需调整）

const getStoredProfile = () => {
  try {
    return wx.getStorageSync(STORAGE_KEY) || null;
  } catch (e) {
    return null;
  }
};

const saveProfile = (profile) => {
  try {
    wx.setStorageSync(STORAGE_KEY, profile);
  } catch (e) {
    // no-op
  }
};

const normalizeStoredProfile = (profile) => {
  if (!profile || !profile.uid) return null;
  if (profile.authorized) return profile;
  const normalized = { ...profile, authorized: true };
  saveProfile(normalized);
  return normalized;
};

const clearStoredProfile = () => {
  try {
    wx.removeStorageSync(STORAGE_KEY);
  } catch (e) {
    // no-op
  }
};

const buildRoomCode = () => {
  return Math.random().toString().slice(2, 8).padEnd(6, '0');
};

Page({
  data: {
    userProfile: null,
    defaultAvatar: 'https://res.wx.qq.com/a/wx_fed/wechat_applets/default-user-avatar.png',
    isSeated: false,
    isInRoom: false,
    isHost: false,
    baseDeckSize: BASE_DECK_SIZE,
    roomCode: '',
    joinRoomCode: '',
    createForm: {
      setCount: 1,
      winterStartOffset: 30
    },
    seats: [
      { id: 1, label: '座位1', occupant: null },
      { id: 2, label: '座位2', occupant: null },
      { id: 3, label: '座位3', occupant: null },
      { id: 4, label: '座位4', occupant: null },
      { id: 5, label: '座位5', occupant: null },
      { id: 6, label: '座位6', occupant: null }
    ],
    roomList: [],
    roomSettings: null,
    roomStatus: 'waiting'
  },

  onLoad() {
    const app = getApp();
    const globalProfile = app.globalData.userProfile;
    console.log('Lobby onLoad, globalProfile:', globalProfile);

    // 判断是否已登录（只要有 openId 且有昵称认为已登录）
    if (globalProfile && globalProfile.openId && globalProfile.nickName) {
      this.setData({ userProfile: globalProfile });
    } else {
      wx.showToast({ title: '请先在首页登录', icon: 'none', duration: 2000 });
      // 延迟跳转以免 toast 看不见
      setTimeout(() => {
        wx.navigateBack({ delta: 1 });
      }, 1500);
      return;
    }
    // this.ensureRoomCode(); // 移除自动生成，改为创建时生成
    this.fetchRoomList();
  },

  onShow() {
    this.fetchRoomList();
  },

  onPullDownRefresh() {
    this.fetchRoomList().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onUnload() {
    if (this.roomWatcher) {
      this.roomWatcher.close();
    }
  },

  ensureProfileOrBack() {
    if (this.data.userProfile && (this.data.userProfile.uid || this.data.userProfile.openId)) {
      return true;
    }
    wx.showToast({ title: '请返回首页登录', icon: 'none' });
    setTimeout(() => wx.navigateBack({ delta: 1 }), 300);
    return false;
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  ensureRoomCode() {
    if (!this.data.roomCode) {
      this.setData({ roomCode: buildRoomCode() });
    }
  },

  onCopyRoomCode() {
    this.ensureRoomCode();
    wx.setClipboardData({
      data: this.data.roomCode,
      success: () => wx.showToast({ title: '房间号已复制', icon: 'none' })
    });
  },

  onSetCountInput(e) {
    const val = parseInt(e.detail.value, 10);
    this.setData({
      'createForm.setCount': isNaN(val) ? '' : val
    });
  },

  onWinterStartInput(e) {
    const val = parseInt(e.detail.value, 10);
    this.setData({
      'createForm.winterStartOffset': isNaN(val) ? '' : val
    });
  },

  onCreateRoom() {
    if (!this.ensureProfileOrBack()) return;
    const { createForm, userProfile } = this.data;
    const setCount = Number(createForm.setCount) || 1;
    const winterStartOffset = Number(createForm.winterStartOffset) || 0;

    this.ensureRoomCode();
    const roomCode = this.data.roomCode; // generated unique code

    wx.showLoading({ title: '创建房间中...', mask: true });

    const db = wx.cloud.database();
    const _ = db.command;

    // 清理该用户已创建的其他未开始房间（进行中不删）
    db.collection('rooms').where({
      hostOpenId: userProfile.openId,
      status: 'waiting'
    }).get()
    .then(res => {
      // 将之前的等待房间状态改为 closed
      const closePromises = (res.data || []).map(r => 
        db.collection('rooms').doc(r._id).update({
          data: { status: 'closed' }
        })
      );
      return Promise.all(closePromises);
    })
    .then(() => {
      // 初始座位数据：6个位置，第一个是房主
      const initialSeats = Array(6).fill(null);
      initialSeats[0] = {
        uid: userProfile.uid || userProfile.openId, // 兼容逻辑
        openId: userProfile.openId,
        nickName: userProfile.nickName,
        avatarUrl: userProfile.avatarUrl,
        seatId: 1, // 这里的ID对应界面显示的1-6
        ready: true
      };
  
      // 构建房间数据
      const roomData = {
        roomCode: roomCode,
        hostOpenId: userProfile.openId, // 记录房主OpenID权限
        status: 'waiting',
        players: initialSeats,
        settings: {
          setCount,
          winterStartOffset,
          baseDeckSize: BASE_DECK_SIZE,
          totalCards: Math.max(0, setCount) * BASE_DECK_SIZE
        },
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      };
  
      return db.collection('rooms').add({ data: roomData });
    })
    .then(res => {
      console.log('Room created:', res);
      wx.hideLoading();
      
      // 更新本地状态，进入房间视图
      this.setData({
        isInRoom: true,
        isHost: true,
        roomId: res._id,
        roomCode: roomCode,
        // seats: displaySeats // 由 watcher 更新
      });
      
      wx.showToast({ title: '创建成功', icon: 'success' });
      
      // 开启监听
      this.initRoomWatcher(res._id);
    })
    .catch(err => {
      wx.hideLoading();
      console.error('Create room failed:', err);
      if (err.errMsg && (err.errMsg.includes('not exists') || err.errMsg.includes('not found'))) {
        wx.showModal({
          title: '提示',
          content: '请在云开发控制台创建 "rooms" 集合，并在"数据权限"中设置为"所有用户可读，创建者可写"（开发阶段）或使用云函数创建。',
          showCancel: false
        });
      } else {
        wx.showToast({ title: '创建失败', icon: 'none' });
      }
    });
  },

  onJoinInput(e) {
    this.setData({
      joinRoomCode: e.detail.value.replace(/\s/g, '')
    });
  },

  findMySeatIndex() {
    const { seats, userProfile } = this.data;
    if (!userProfile || !userProfile.uid) return -1;
    return seats.findIndex((s) => s.occupant && s.occupant.uid === userProfile.uid);
  },

  onSelectSeat(e) {
    const seatId = Number(e.currentTarget.dataset.id);
    if (!this.ensureProfileOrBack()) return;
    const { seats, userProfile, roomId } = this.data;
    
    // 1. 本地预检查
    const targetIndex = seats.findIndex((s) => s.id === seatId);
    if (targetIndex < 0) return;

    const target = seats[targetIndex];
    // 检查是否被别人占用
    if (target.occupant && target.occupant.uid !== userProfile.uid && target.occupant.uid !== userProfile.openId) {
      wx.showToast({ title: '座位已被占用', icon: 'none' });
      return;
    }

    // 点击自己：不做反应
    if (target.occupant && (target.occupant.uid === userProfile.uid || target.occupant.uid === userProfile.openId)) {
      return;
    }

    // 检查游戏状态：如果已经在进行中，不允许换座位
    if (this.data.roomStatus === 'playing') {
      wx.showToast({ title: '游戏进行中，不可换座', icon: 'none' });
      return;
    }

    // 2. 也是为了"及时同步数据"，在操作前拉最新的房间数据检查
    wx.showLoading({ title: '请求中...', mask: true });
    const db = wx.cloud.database();
    
    db.collection('rooms').doc(roomId).get().then(res => {
        const remoteRoom = res.data;
        if (!remoteRoom) {
             wx.hideLoading();
             wx.showToast({ title: '房间不存在', icon: 'none' });
             return;
        }

        if (remoteRoom.status === 'playing') {
             wx.hideLoading();
             wx.showToast({ title: '游戏进行中，不可换座', icon: 'none' });
             return;
        }
        
        let players = remoteRoom.players || [];
        // 确保数组长度为 6
        if (players.length < 6) {
           players = players.concat(Array(6 - players.length).fill(null));
        }

        // 检查目标位置是否真的为空
        // remoteRoom.players[targetIndex] 对应 targetIndex
        const remotePlayer = players[targetIndex];
        if (remotePlayer && remotePlayer.openId && remotePlayer.openId !== userProfile.openId) {
             wx.hideLoading();
             wx.showToast({ title: '位置已被人抢了', icon: 'none' });
             // 触发一次 update 刷新界面
             this.updateSeatsFromPlayers(players);
             return;
        }

        // 构造更新数据
        // 直接修改整个 players 数组，避免 dot notation 更新 null 元素时的报错
        const nextPlayers = [...players];
        
        // 如果我已经入座了，需要把原来的位置清空 (换位)
        const myRemoteIndex = nextPlayers.findIndex(p => p && p.openId === userProfile.openId);
        
        if (myRemoteIndex !== -1 && myRemoteIndex !== targetIndex) {
            nextPlayers[myRemoteIndex] = null;
        }

        nextPlayers[targetIndex] = {
           openId: userProfile.openId,
           nickName: userProfile.nickName || '玩家',
           avatarUrl: userProfile.avatarUrl || this.data.defaultAvatar,
           seatId: seatId,
           ready: false
        };

        return db.collection('rooms').doc(roomId).update({
            data: {
              players: nextPlayers
            }
        }).then(() => {
            wx.hideLoading();
            // 成功后，手动刷新一次，polling 也会接手
            this.fetchRoomInfo();
        });
    }).catch(err => {
        wx.hideLoading();
        console.error('Seat op failed:', err);
        wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    });
  },

  onExitRoom() {
    const { roomId, userProfile, roomStatus } = this.data;
    if (!roomId) {
      this.setData({ isInRoom: false, isHost: false, roomCode: '' });
      return;
    }

    // 游戏进行中不清空座位，保留身份便于后续返回
    if (roomStatus === 'playing') {
      wx.showToast({ title: '已退出，可随时重新进入', icon: 'none' });
      this.leaveRoomLocal();
      return;
    }

    const db = wx.cloud.database();
    
    // 查找自己的位置（稍微有点麻烦，需要拿最新的数据，这里简单起见假设本地 seats 是准的，或者重新查一遍）
    // 为了稳妥，可以直接用 update 操作，但不知道索引。
    // 我们先假设本地 seats 同步了最新的 players
    const mySeatIndex = this.findMySeatIndex(); // 这个方法是基于 seats 的，需要确保 seats 和 players 映射对齐

    if (mySeatIndex === -1) {
       // 没在座位上？直接退
       this.leaveRoomLocal();
       return;
    }

    // 数据库更新：将对应位置置空
    // 注意：update 数组元素需要用 `players.${mySeatIndex}` 这种 key
    const updateKey = `players.${mySeatIndex}`;
    
    db.collection('rooms').doc(roomId).update({
      data: {
        [updateKey]: null
      },
      success: () => {
        wx.showToast({ title: '已退出', icon: 'none' });
        this.leaveRoomLocal();
      },
      fail: (err) => {
        console.error('Exit room failed:', err);
        wx.showToast({ title: '退出失败', icon: 'none' });
      }
    });
  },

  onRoomContainerLeave() {
    console.log('Page container leaving...');
    if (this.data.isInRoom) {
      // 这里的逻辑稍微 tricky：如果是用户点击“退出房间”按钮，会先调用 onExitRoom，然后 update db，然后 leaveRoomLocal -> isInRoom=false -> page-container hide -> trigger leave again?
      // 不，page-container 的 show 属性如果变为 false，也会触发 leave 吗？或者只在手势/返回时触发？
      // 官方文档：bindleave "如果是通过 setData 改变 show 属性隐藏的，也会触发"。
      // 所以我们必须防止无限循环。
      // 但其实这里只调用 onExitRoom 即可。onExitRoom 内部会判断。
      // 为防止死循环，我们可以在 leaveRoomLocal 里把 isInRoom 设为 false，这样下次 check 就跳过了。
      // 不过这里直接调 onExitRoom 可能会导致重复 toast，或者如果正在退出中？
      // 简单起见，如果此时 isInRoom 还是 true，说明还没完成退出流程（亦或是手势触发的），我们尝试退出。
      // 但 onExitRoom 是发请求 update db。
      this.onExitRoom();
    }
  },

  leaveRoomLocal() {
    if (this.roomWatcher) {
      this.roomWatcher.close();
      this.roomWatcher = null;
    }
    this.setData({
      isInRoom: false,
      isHost: false,
      roomCode: '',
      roomId: '',
      seats: this.data.seats.map(s => ({ ...s, occupant: null })), // 清空座位
      isSeated: false,
      isGameStarted: false
    });
    this.fetchRoomList();
    this.stopRoomPolling();
    this.fetchRoomList();
  },

  startRoomPolling(roomId) {
    this.stopRoomPolling(); // 防止重复
    console.log('Start polling room:', roomId);
    this.pollingTimer = setInterval(() => {
        this.fetchRoomInfo(roomId);
    }, 1000); // 每秒刷新
  },

  stopRoomPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  },

  fetchRoomInfo(roomId) {
      const id = roomId || this.data.roomId;
      if (!id) return;
      const db = wx.cloud.database();
      db.collection('rooms').doc(id).get().then(res => {
          if (res.data) {
              const room = res.data;
              if (room.status === 'closed') {
                wx.showToast({ title: '房间已关闭', icon: 'none' });
                this.leaveRoomLocal();
                return;
              }
              this.updateSeatsFromPlayers(room.players);
              if (room.settings) {
                  this.setData({ roomSettings: room.settings });
              }
          }
      }).catch(err => {
          console.error('Poll room failed:', err);
          // 如果是找不到，说明房间解散了
          if (err.errMsg && (err.errMsg.includes('not exists') || err.errMsg.includes('not found'))) {
               this.leaveRoomLocal();
          }
      });
  },

  onJoinRoom(e) {
    if (!this.ensureProfileOrBack()) return;
    const code = (e.currentTarget.dataset.code || this.data.joinRoomCode || '').trim();
    if (!code) {
      wx.showToast({ title: '请输入房间号', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '查找房间...', mask: true });
    
    const db = wx.cloud.database();
    const _ = db.command;

    // 1. 查询房间是否存在
    db.collection('rooms').where({
      roomCode: code
    }).get({
      success: (res) => {
        if (!res.data || res.data.length === 0) {
          wx.hideLoading();
          wx.showToast({ title: '房间不存在', icon: 'none' });
          return;
        }

        const room = res.data[0];
        const players = room.players || [];
        
        // 检查是否已经在房间里
        const myUid = this.data.userProfile.openId;
        const alreadyInIndex = players.findIndex(p => p && p.openId === myUid);
        
        // 场景A: 游戏已开始/已结束，或者是等待中但自己已在列
        // 允许重新进入的条件：我在名单里
        if (alreadyInIndex !== -1) {
           wx.hideLoading();
           if (room.status === 'closed') {
             wx.showToast({ title: '房间已关闭', icon: 'none' });
             return;
           }
           // 无论 playing 还是 waiting，只要在名单里都允许回房
           // TODO: 如果是 playing，可能需要跳转到游戏页？目前先回房间页，等待 watcher 同步状态
           this.enterRoomLocal(room);
           return;
        }

        // 场景B: 新玩家加入
        // 前提：房间必须是 waiting
        if (room.status !== 'waiting') {
           wx.hideLoading();
           wx.showToast({ title: '游戏已开始或房间已关闭', icon: 'none' });
           return;
        }

        // 找空位
        const emptyIndex = players.findIndex(p => !p);
        if (emptyIndex === -1) {
          wx.hideLoading();
          wx.showToast({ title: '房间已满', icon: 'none' });
          return;
        }

        // 2. 占位更新 (自动落座)
        const updateKey = `players.${emptyIndex}`;
        const newPlayer = {
          openId: myUid,
          nickName: this.data.userProfile.nickName,
          avatarUrl: this.data.userProfile.avatarUrl,
          seatId: emptyIndex + 1,
          ready: false
        };

        db.collection('rooms').doc(room._id).update({
          data: {
            [updateKey]: newPlayer
          },
          success: (updateRes) => {
            wx.hideLoading();
            console.log('Join success', updateRes);
            
            // 乐观更新本地数据，实际会由 watcher 修正
            room.players[emptyIndex] = newPlayer;
            this.enterRoomLocal(room);
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('Join failed:', err); // 可能是并发导致的位置冲突
            wx.showToast({ title: '加入失败，请重试', icon: 'none' });
          }
        });
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('Query room failed:', err);
        wx.showToast({ title: '查询失败', icon: 'none' });
      }
    });
  },

  enterRoomLocal(roomData) {
    const isHost = (roomData.hostOpenId === this.data.userProfile.openId);
    
    this.setData({
      isInRoom: true,
      isHost: isHost,
      roomId: roomData._id,
      roomCode: roomData.roomCode,
      roomSettings: roomData.settings || {},
      roomStatus: roomData.status || 'waiting'
    });
    
    this.updateSeatsFromPlayers(roomData.players);
    // 启动监听
    this.initRoomWatcher(roomData._id);
    // 启动轮询 (每秒更新)
    this.startRoomPolling(roomData._id);
  },

  updateSeatsFromPlayers(players) {
     const newSeats = this.data.seats.map((s, i) => {
        // players 数组索引和你 seats 数组索引是一一对应的吗？
        // 假设 players 是长度为6的数组，索引0对应id=1
        const p = players[i];
        return {
          ...s,
          occupant: p ? {
            uid: p.openId,
            nickName: p.nickName,
            avatarUrl: p.avatarUrl
          } : null
        };
     });
     
     // 检查自己是否在座位上（更新 isSeated 状态）
     const myUid = this.data.userProfile.openId;
     const amISeated = players.some(p => p && p.openId === myUid);

     this.setData({
       seats: newSeats,
       isSeated: amISeated
     });
  },

  initRoomWatcher(roomId) {
    if (this.roomWatcher) return; // 避免重复监听
    console.log('Start watching room:', roomId);
    
    const db = wx.cloud.database();
    this.roomWatcher = db.collection('rooms').doc(roomId).watch({
      onChange: (snapshot) => {
        console.log('Room update:', snapshot);
        // 如果房间被删除
        if (!snapshot.docs || snapshot.docs.length === 0) {
          wx.showToast({ title: '房间已解散', icon: 'none' });
          this.leaveRoomLocal();
          return;
        }

        const room = snapshot.docs[0];

        // 状态监听：跳转游戏
        if (room.status === 'playing') {
           // 确保只跳转一次
           if (!this.data.isGameStarted) {
             this.setData({ isGameStarted: true });
             wx.navigateTo({
               url: `/pages/game/game?roomId=${roomId}`,
             });
           }
        }

        // 如果房间被关闭
        if (room.status === 'closed') {
          wx.showToast({ title: '房间已关闭', icon: 'none' });
          this.leaveRoomLocal();
          return;
        }

        // Update room status
        if (room.status) {
             this.setData({ roomStatus: room.status });
        }

        this.updateSeatsFromPlayers(room.players);
        if (room.settings) {
          this.setData({ roomSettings: room.settings });
        }
      },
      onError: (err) => {
        console.error('Watch error:', err);
      }
    });
  },

  onStartGame() {
    if (!this.data.isHost) return;
    const { seats, roomSettings, roomId } = this.data;
    const activePlayers = seats.filter(s => s.occupant).map(s => s.occupant);

    if (activePlayers.length < 1) { // 允许单人调试，正式可能限制2人
      wx.showToast({ title: '人数不足', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在洗牌...', mask: true });

    // 1. 构建牌库
    const cardData = require('../../data/cardData.js');
    let rawDeck = [];
    const setNum = (roomSettings && roomSettings.setCount) || 1;

    // 假设 cardData.byName 是字典
    // 为防止数据结构差异，先做防守
    const dict = cardData.byName || cardData; 

    // --- 重新按官方基准牌数（180/套）缩放 nb，支持多套叠加 ---
    const BASE_DECK_SIZE = this.data.baseDeckSize || 180;
    const targetSize = BASE_DECK_SIZE * setNum;
    const totalNb = Object.values(dict).reduce((sum, c) => sum + Number(c.nb || 0), 0);
    const scaled = [];

    // 1) 先按比例分配，至少 1 张
    Object.keys(dict).forEach(key => {
      const cardDef = dict[key];
      const nb = Number(cardDef.nb || 0);
      const est = nb <= 0 || totalNb === 0 ? 1 : Math.max(1, Math.round((nb / totalNb) * targetSize));
      scaled.push({ key, est });
    });

    // 2) 调整数量使总和精确等于 targetSize
    let currentTotal = scaled.reduce((s, c) => s + c.est, 0);
    if (currentTotal > targetSize) {
      // 超出则从数量多的开始减
      scaled.sort((a, b) => b.est - a.est);
      let idx = 0;
      while (currentTotal > targetSize && idx < scaled.length) {
        if (scaled[idx].est > 1) {
          scaled[idx].est -= 1;
          currentTotal -= 1;
        } else {
          idx += 1;
        }
      }
    } else if (currentTotal < targetSize) {
      // 不足则从数量多的开始加
      scaled.sort((a, b) => b.est - a.est);
      let idx = 0;
      while (currentTotal < targetSize) {
        scaled[idx % scaled.length].est += 1;
        currentTotal += 1;
        idx += 1;
      }
    }

    // 3) 按缩放后的数量构建精简牌堆
    scaled.forEach(({ key, est }) => {
      for (let i = 0; i < est; i++) {
        rawDeck.push({
          id: key, // 对应 cardData 的 key
          uid: `${key}_${Math.random().toString(36).slice(2)}` // 唯一标识
        });
      }
    });

    // 2. 洗牌 (Fisher-Yates)
    for (let i = rawDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rawDeck[i], rawDeck[j]] = [rawDeck[j], rawDeck[i]];
    }

    // 3. 插入冬季卡
    // 默认取出最后 N 张，混入 2 张 Winter
    // 修正：如果牌太少，就全部混入
    const winterOffset = (roomSettings && roomSettings.winterStartOffset) || 30;
    const splitIndex = Math.max(0, rawDeck.length - winterOffset);
    
    const topPart = rawDeck.slice(0, splitIndex);
    const bottomPart = rawDeck.slice(splitIndex);

    // 添加 2 张冬季卡
    bottomPart.push({ id: 'WINTER', uid: `WINTER_1_${Math.random()}` });
    bottomPart.push({ id: 'WINTER', uid: `WINTER_2_${Math.random()}` });

    // 再次洗混底部
    for (let i = bottomPart.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bottomPart[i], bottomPart[j]] = [bottomPart[j], bottomPart[i]];
    }

    const finalDeck = topPart.concat(bottomPart);

    // 4. 发牌 (Initial Hand)
    // 规则：通常起始手牌是 6 张
    const HAND_SIZE = 6;
    const playerStates = {};
    const turnOrder = [];

    activePlayers.forEach(p => {
       const pid = p.openId || p.uid;
       turnOrder.push(pid);
       
       const hand = [];
       for(let k=0; k<HAND_SIZE; k++) {
         if (finalDeck.length > 0) {
           hand.push(finalDeck.shift());
         }
       }
       
       playerStates[pid] = {
         hand: hand,
         cave: [],
         forest: [], // 森林区域
         score: 0
       };
    });

    // 5. 初始 GameState
    const gameState = {
      deck: finalDeck,
      clearing: [], // 空地/弃牌区
      playerStates: playerStates,
      turnOrder: turnOrder,
      currentPlayerIdx: Math.floor(Math.random() * turnOrder.length), // 随机先手
      roundCount: 1,
      winterCount: 0 // 抽到的冬季卡数量
    };

    // 6. 写入数据库
    const db = wx.cloud.database();
    db.collection('rooms').doc(roomId).update({
      data: {
        status: 'playing',
        startTime: db.serverDate(),
        gameState: gameState
      },
      success: () => {
        wx.hideLoading();
        console.log('Game Initialized');
        // Watcher will handle navigation
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('Start game failed', err);
        wx.showToast({ title: '启动失败', icon: 'none' });
      }
    });
  },

  onContinueGame() {
    if (!this.data.roomId) return;
    wx.navigateTo({
      url: `/pages/game/game?roomId=${this.data.roomId}`,
    });
  },

  fetchRoomList() {
    const db = wx.cloud.database();
    const _ = db.command;
    // Calculate 1 hour ago
    // 2. Fetch all rooms, sorted by createTime desc
    return db.collection('rooms')
      .orderBy('createTime', 'desc')
      .limit(50) // Increase limit slightly to see more history
      .get()
      .then(res => {
         const list = (res.data || []).map(room => {
             const count = (room.players || []).filter(p => p).length;
             return { ...room, playerCount: count };
           });
           
         this.setData({
           roomList: list
         });
      })
      .catch(err => {
        console.error('Fetch rooms failed:', err);
      });
  },

  onDeleteRoom(e) {
    const roomId = e.currentTarget.dataset.id;
    if (!roomId) return;

    const { userProfile } = this.data;
    if (!userProfile) return;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个房间吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          const db = wx.cloud.database();
          db.collection('rooms').doc(roomId).remove()
            .then(() => {
              wx.hideLoading();
              wx.showToast({ title: '删除成功' });
              this.fetchRoomList(); // 刷新列表
            })
            .catch(err => {
              wx.hideLoading();
              console.error('Delete room failed:', err);
              wx.showToast({ title: '删除失败', icon: 'none' });
            });
        }
      }
    });
  }
});
