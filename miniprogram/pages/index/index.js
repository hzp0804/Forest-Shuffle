const STORAGE_KEY = 'userProfile';

const getStoredProfile = () => {
  try {
    return wx.getStorageSync(STORAGE_KEY) || null;
  } catch (e) {
    return null;
  }
};

const saveProfile = async (profile) => {
  try {
    await wx.setStorageSync(STORAGE_KEY, profile);
  } catch (e) {
    // no-op
  }
};

const loginWithCloud = () => {
  return new Promise((resolve, reject) => {
    console.log('Starting cloud login...');
    wx.cloud.callFunction({
      name: 'login',
      data: {},
      success: (cloudRes) => {
        console.log('Cloud function login result:', cloudRes);
        const result = cloudRes?.result || {};
        const openId = result.openId || result?.userInfo?.openId || result?.openid;
        if (!openId) {
          console.error('No OpenID in cloud response');
          reject(new Error('未返回 openId'));
          return;
        }
        resolve({
          openId,
          registered: !!result.registered,
          userInfo: result.userInfo || null
        });
      },
      fail: (err) => {
        console.error('Cloud function login failed:', err);
        reject(new Error(err?.errMsg || '云函数调用失败'));
      }
    });
  });
};

Page({
  data: {
    userProfile: null,
    loginLoading: false
  },

  onLoad: async function() {
    this.setData({ loginLoading: true });
    
    const stored = getStoredProfile();
    console.log('onLoad stored profile:', stored);

    // 按照要求：进入小程序时先清空上次的 openId
    if (stored && stored.openId) {
      console.log('Clearing old openId from storage');
      delete stored.openId;
      await saveProfile(stored); // 更新本地缓存
      this.setData({ userProfile: stored });
    } else if (stored) {
      this.setData({ userProfile: stored });
    }

    try {
      // 重新拉取
      const res = await loginWithCloud();
      console.log('Logged in with cloud:', res);
      const openId = res.openId;
      
      // 获取最新状态（此时应该没有 openId）
      const currentProfile = this.data.userProfile || {};
      
      // 更新 openId
      let newProfile = { ...currentProfile, openId };
      console.log('Updating profile with new openId:', openId);
      
      // 查询 userList 是否存在相同数据
      const db = wx.cloud.database();
      const userRes = await db.collection('userList').get();
      console.log('User list query result:', userRes);
      
      if (userRes.data && userRes.data.length > 0) {
        const remoteUser = userRes.data[0];
        console.log('Found remote user:', remoteUser);
        // 直接带入云端数据，但依然会弹窗确认
        newProfile = {
          ...newProfile,
          nickName: remoteUser.nickName,
          avatarUrl: remoteUser.avatarUrl
        };
      }

      this.setData({ userProfile: newProfile });
      saveProfile(newProfile);
      
      // 更新全局变量
      const app = getApp();
      app.globalData.userProfile = newProfile;
      console.log('Updated globalData.userProfile:', app.globalData.userProfile);
      
    } catch (err) {
      console.error('Cloud login failed:', err);
      // 可以提示用户重试，或者静默失败让用户点击开始游戏再次触发(但目前开始游戏没有重试逻辑)
      wx.showToast({ title: '自动登录失败', icon: 'none' });
    } finally {
      this.setData({ loginLoading: false });
    }
  },

  onStartGame: function() {
    const { userProfile } = this.data;
    // 即使有数据也弹窗，只是带入数据
    const modal = this.selectComponent('#userInfoModal');
    if (modal) {
      modal.show(userProfile);
    } else {
      console.error('UserInfoModal not found');
    }
  },

  onUserInfoSubmit: async function(e) {
    let { avatarUrl, nickName } = e.detail;
    console.log('onUserInfoSubmit', avatarUrl, nickName);
    
    // 显示加载提示，因为上传图片可能需要一点时间
    wx.showLoading({ title: '保存中...', mask: true });

    try {
      // 1. 如果是临时路径，先上传到云存储获取永久fileID
      if (avatarUrl && (avatarUrl.startsWith('http://tmp') || avatarUrl.startsWith('wxfile://') || avatarUrl.startsWith('blob:'))) {
        const ext = avatarUrl.match(/\.[^.]+?$/)?.[0] || '.jpg';
        const openId = this.data.userProfile?.openId || 'unknown';
        // 构建云存储路径: avatars/{openId}_{timestamp}.jpg
        const cloudPath = `user-avatars/${openId}_${Date.now()}${ext}`;
        
        console.log('Uploading temporary avatar to:', cloudPath);
        
        const uploadResult = await wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: avatarUrl
        })
        
        if (!uploadResult.fileID) {
          throw new Error('图片上传失败，未获取到 fileID');
        }
        
        console.log('Upload success, fileID:', uploadResult.fileID);
        avatarUrl = uploadResult.fileID; // 更新为永久的文件ID
      }
      
      // 2. 更新本地状态
      const profile = { 
        ...(this.data.userProfile || {}),
        avatarUrl, 
        nickName,
        updateTime: new Date().getTime()
      };
      
      this.setData({ userProfile: profile });
      
      // 更新全局变量
      getApp().globalData.userProfile = profile;

      // 保存到本地缓存
      await saveProfile(profile);

      // 3. 调用客户端数据库保存到 userList
      const db = wx.cloud.database();
      const userCollection = db.collection('userList');
      
      // 查询是否已存在记录
      const queryRes = await userCollection.get();
      const users = queryRes.data;
      const now = db.serverDate();
        
      if (users.length > 0) {
        // 更新现有记录
        const docId = users[0]._id;
        console.log('Updating existing user:', docId);
        await userCollection.doc(docId).update({
            data: {
              avatarUrl,
              nickName,
              updateTime: now
            }
        });
      } else {
        // 新增记录
        console.log('Adding new user');
        await userCollection.add({
          data: {
            avatarUrl,
            nickName,
            createTime: now,
            updateTime: now
          }
        });
      }

      // 4. 成功后的处理
      wx.hideLoading();
      wx.showToast({ title: '登录成功', icon: 'success' });

      // 关闭弹窗
      const modal = this.selectComponent('#userInfoModal');
      if (modal) {
        modal.hide();
        if (modal.stopLoading) modal.stopLoading();
      }

      // 跳转
      wx.navigateTo({
        url: '/pages/lobby/lobby'
      });

    } catch (err) {
      wx.hideLoading();
      console.error('Save user info failed:', err);
      
      // 更加友好的错误提示
      let errMsg = '保存失败';
      if (err.errMsg && (err.errMsg.includes('not exists') || err.errMsg.includes('not found'))) {
        errMsg = '数据库集合 userList 不存在';
      } else if (err.message) {
        errMsg = err.message;
      }
      
      wx.showToast({ title: errMsg, icon: 'none', duration: 3000 });
      
      const modal = this.selectComponent('#userInfoModal');
      if (modal && modal.stopLoading) modal.stopLoading();
    }
  },

  onViewCards: function() {
    wx.navigateTo({
      url: '/pages/gallery/gallery'
    });
  }
});
