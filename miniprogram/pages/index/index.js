// index.js
const app = getApp();
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

Page({
  data: {
    userProfile: null,
    loginLoading: false
  },

  onLoad: function() {
    const stored = getStoredProfile();
    if (stored) {
      this.setData({ userProfile: stored });
    }
  },

  requestLogin: function() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于展示头像昵称并记录对局',
        success: (res) => {
          wx.login({
            success: (loginRes) => {
              const profile = {
                nickName: res.userInfo.nickName,
                avatarUrl: res.userInfo.avatarUrl,
                uid: buildUid(loginRes.code)
              };
              saveProfile(profile);
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

  onStartGame: function() {
    const stored = getStoredProfile();
    if (stored && stored.uid) {
      this.setData({ userProfile: stored });
      wx.navigateTo({ url: '/pages/lobby/lobby' });
      return;
    }

    this.setData({ loginLoading: true });
    this.requestLogin()
      .then((profile) => {
        this.setData({ userProfile: profile });
        wx.navigateTo({ url: '/pages/lobby/lobby' });
      })
      .catch(() => {})
      .finally(() => {
        this.setData({ loginLoading: false });
      });
  },

  onViewCards: function() {
    wx.navigateTo({
      url: '/pages/gallery/gallery'
    });
  }
});
