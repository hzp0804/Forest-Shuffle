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
    ]
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
    this.ensureRoomCode();
  },

  ensureProfileOrBack() {
    if (this.data.userProfile && this.data.userProfile.uid) {
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
    const { createForm } = this.data;
    const setCount = Number(createForm.setCount) || 1;
    const totalCards = Math.max(0, setCount) * BASE_DECK_SIZE;
    const winterStartOffset = Number(createForm.winterStartOffset) || 0;

    this.ensureRoomCode();

    wx.showModal({
      title: '房间已创建',
      content: `房间号：${this.data.roomCode}\n套数：${setCount}（共 ${totalCards} 张）\n冬季卡从牌堆底部前 ${winterStartOffset} 张起抽`,
      confirmText: '复制房号',
      cancelText: '知道了',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({ data: this.data.roomCode });
        }
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
    const { seats, userProfile } = this.data;
    const myIndex = this.findMySeatIndex();
    const targetIndex = seats.findIndex((s) => s.id === seatId);
    if (targetIndex < 0) return;

    const target = seats[targetIndex];
    if (target.occupant && target.occupant.uid !== userProfile.uid) {
      wx.showToast({ title: '座位已被占用', icon: 'none' });
      return;
    }

    const updated = seats.map((s) => ({ ...s }));
    if (myIndex >= 0) {
      updated[myIndex].occupant = null;
    }
    updated[targetIndex].occupant = {
      uid: userProfile.uid,
      nickName: userProfile.nickName || '玩家',
      avatarUrl: userProfile.avatarUrl || this.data.defaultAvatar
    };

    this.setData({ 
      seats: updated,
      isSeated: true
    });
  },

  onExitRoom() {
    const { seats } = this.data;
    const myIndex = this.findMySeatIndex();
    
    if (myIndex >= 0) {
      const updated = seats.map((s) => ({ ...s }));
      updated[myIndex].occupant = null;
      
      this.setData({
        seats: updated,
        isSeated: false
      });
      wx.showToast({ title: '已退出房间', icon: 'none' });
    }
  },

  onJoinRoom() {
    if (!this.ensureProfileOrBack()) return;
    const code = (this.data.joinRoomCode || '').trim();
    if (!code) {
      wx.showToast({ title: '请输入房间号', icon: 'none' });
      return;
    }
    if (code.length < 4) {
      wx.showToast({ title: '房间号格式不正确', icon: 'none' });
      return;
    }

    wx.showToast({ title: '加入房间成功', icon: 'success' });
    wx.navigateTo({
      url: `/pages/score/score?room=${code}`
    });
  }
});
