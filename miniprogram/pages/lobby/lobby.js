const STORAGE_KEY = 'userProfile';

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

const buildUid = (code) => {
  if (code) return `wxcode_${code}`;
  return `local_${Date.now()}`;
};

const buildRoomCode = () => {
  return Math.random().toString().slice(2, 8).padEnd(6, '0');
};

// 官方基础牌库张数（可按需调整）
const BASE_DECK_SIZE = 180;

const storeLoggedProfile = (profile) => {
  const payload = { ...profile, authorized: true };
  saveProfile(payload);
  return payload;
};

const clearStoredProfile = () => {
  try {
    wx.removeStorageSync(STORAGE_KEY);
  } catch (e) {
    // no-op
  }
};

Page({
  data: {
    userProfile: null,
    loggedIn: false,
    defaultAvatar: 'https://res.wx.qq.com/a/wx_fed/wechat_applets/default-user-avatar.png',
    loginLoading: false,
    baseDeckSize: BASE_DECK_SIZE,
    roomCode: '',
    joinRoomCode: '',
    createForm: {
      setCount: 1,
      winterStartOffset: 30
    },
    seats: [
      { id: 1, label: '席位1', occupant: null },
      { id: 2, label: '席位2', occupant: null },
      { id: 3, label: '席位3', occupant: null },
      { id: 4, label: '席位4', occupant: null },
      { id: 5, label: '席位5', occupant: null },
      { id: 6, label: '席位6', occupant: null }
    ]
  },

  onLoad() {
    const stored = getStoredProfile();
    if (stored && stored.authorized) {
      wx.checkSession({
        success: () => {
          this.setData({ userProfile: stored, loggedIn: true });
        },
        fail: () => {
          clearStoredProfile();
          this.setData({ userProfile: null, loggedIn: false });
        }
      });
    } else {
      if (stored) {
        clearStoredProfile();
      }
      this.setData({ userProfile: null, loggedIn: false });
    }
    this.ensureRoomCode();
  },

  requestLogin() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于展示头像昵称并记录对局',
        success: (res) => {
          wx.login({
            success: (loginRes) => {
              const profile = storeLoggedProfile({
                nickName: res.userInfo.nickName,
                avatarUrl: res.userInfo.avatarUrl,
                uid: buildUid(loginRes.code)
              });
              resolve(profile);
            },
            fail: () => {
              wx.showToast({ title: '微信登录失败', icon: 'none' });
              reject(new Error('wx.login failed'));
            }
          });
        },
        fail: () => {
          wx.showToast({ title: '需要登录以继续', icon: 'none' });
          reject(new Error('getUserProfile denied'));
        }
      });
    });
  },

  ensureProfileBeforeAction(action) {
    if (this.data.loggedIn && this.data.userProfile && this.data.userProfile.uid) {
      this.ensureRoomCode();
      action();
      return;
    }

    this.setData({ loginLoading: true });
    this.requestLogin()
      .then((profile) => {
        this.setData({ userProfile: profile });
        this.setData({ loggedIn: true });
        this.ensureRoomCode();
        action();
      })
      .catch(() => {})
      .finally(() => {
        this.setData({ loginLoading: false });
      });
  },

  onLoginTap() {
    this.ensureProfileBeforeAction(() => {});
  },

  onGetUserProfile(e) {
    // Button-triggered authorization path (open-type="getUserProfile")
    if (!e.detail || !e.detail.userInfo) {
      wx.showToast({ title: '授权后才能继续', icon: 'none' });
      return;
    }

    this.setData({ loginLoading: true });
    wx.login({
      success: (loginRes) => {
        const profile = storeLoggedProfile({
          nickName: e.detail.userInfo.nickName,
          avatarUrl: e.detail.userInfo.avatarUrl,
          uid: buildUid(loginRes.code)
        });
        this.setData({ userProfile: profile, loggedIn: true });
        this.ensureRoomCode();
      },
      fail: () => {
        wx.showToast({ title: '微信登录失败', icon: 'none' });
      },
      complete: () => {
        this.setData({ loginLoading: false });
      }
    });
  },

  onLogout() {
    clearStoredProfile();
    this.setData({
      userProfile: null,
      loggedIn: false
    });
    wx.showToast({ title: '已注销', icon: 'none' });
  },

  ensureRoomCode() {
    if (!this.data.roomCode) {
      this.setData({ roomCode: buildRoomCode() });
    }
  },

  onCopyRoomCode() {
    this.ensureRoomCode();
    wx.setClipboardData({ data: this.data.roomCode });
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
    this.ensureProfileBeforeAction(() => {
      const { createForm } = this.data;
      const setCount = Number(createForm.setCount) || 1;
      const totalCards = Math.max(0, setCount) * BASE_DECK_SIZE;
      const winterStartOffset = Number(createForm.winterStartOffset) || 0;

      this.ensureRoomCode();

      wx.showModal({
        title: '房间已创建',
        content: `房间号：${this.data.roomCode}`,
        confirmText: '复制房号',
        cancelText: '知道了',
        success: (res) => {
          if (res.confirm) {
            wx.setClipboardData({ data: this.data.roomCode });
          }
        }
      });
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
    this.ensureProfileBeforeAction(() => {
      const { seats, userProfile } = this.data;
      const myIndex = this.findMySeatIndex();
      const targetIndex = seats.findIndex((s) => s.id === seatId);
      if (targetIndex < 0) return;

      const target = seats[targetIndex];
      if (target.occupant && target.occupant.uid !== userProfile.uid) {
        wx.showToast({ title: '席位已被占用', icon: 'none' });
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

      this.setData({ seats: updated });
    });
  },

  onJoinRoom() {
    this.ensureProfileBeforeAction(() => {
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
    });
  }
});
