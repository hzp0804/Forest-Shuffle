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
    const { avatarUrl, nickName } = e.detail;
    console.log('onUserInfoSubmit', avatarUrl, nickName);
    
    // 更新本地状态
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

    // 关闭弹窗
    const modal = this.selectComponent('#userInfoModal');
    if (modal) {
      if (modal.showLoading) modal.showLoading(); // 假设有 loading 方法，或者不设置也可以
    }

    // 调用客户端数据库保存到 userList
    const db = wx.cloud.database();
    const userCollection = db.collection('userList');
    
    // 注意：客户端 DB 查询只能查到自己的数据（默认权限）
    userCollection.get({
      success: async (res) => {
        console.log('Query userList success:', res);
        const users = res.data;
        const now = db.serverDate();
        
        if (users.length > 0) {
          // 更新
          const docId = users[0]._id;
          console.log('Updating existing user:', docId);
          userCollection.doc(docId).update({
             data: {
               avatarUrl,
               nickName,
               updateTime: now
             },
             success: (updateRes) => {
               console.log('Update success:', updateRes);
               wx.showToast({ title: '登录成功', icon: 'success' });
             },
             fail: (err) => {
               console.error('Update fail:', err);
               wx.showToast({ title: '登录失败', icon: 'none' });
             }
          });
        } else {
          // 新增
          console.log('Adding new user');
          userCollection.add({
            data: {
              avatarUrl,
              nickName,
              createTime: now,
              updateTime: now
            },
            success: (addRes) => {
                console.log('Add success:', addRes);
                wx.showToast({ title: '保存成功', icon: 'success' });
            },
            fail: (err) => {
                console.error('Add fail:', err);
                // 特殊处理集合不存在的错误提示
                 const errMsg = err.errMsg || '';
                 if (errMsg.includes('not exists') || errMsg.includes('not found')) {
                    wx.showModal({
                      title: '提示',
                      content: '请在云开发控制台创建 "userList" 集合'
                    });
                 } else {
                    wx.showToast({ title: '保存失败', icon: 'none' });
                 }
            }
          });
        }
      },
      fail: (err) => {
         console.error('Query userList fail:', err);
         wx.showToast({ title: '查询数据库失败', icon: 'none' });
      },
      complete: () => {
        if (modal) {
          modal.hide();
          if (modal.stopLoading) modal.stopLoading();
        }
        // 由于 DB 操作是异步的，这里直接跳转可能在保存完成前就发生了，
        // 但为了用户体验，通常直接跳转是可接受的，后台异步保存。
        // 或者我们可以把跳转放在 success 回调里。鉴于这是小程序，
        // 建议稍微延迟跳转或放在 success 里。
        
        // 为了响应速度，我们这里直接跳转，后台慢慢存
         wx.navigateTo({
          url: '/pages/lobby/lobby'
        });
      }
    });
  },

  onViewCards: function() {
    wx.navigateTo({
      url: '/pages/gallery/gallery'
    });
  }
});
