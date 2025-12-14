// components/UserInfoModal/UserInfoModal.js
const defaultAvatar = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';

Component({
  /**
   * Component properties
   */
  properties: {

  },

  /**
   * Component initial data
   */
  data: {
    visible: false,
    avatarUrl: '',
    nickName: '',
    defaultAvatar: defaultAvatar,
    canSubmit: false,
    submitting: false
  },

  /**
   * Component methods
   */
  methods: {
    show(userInfo) {
      if (userInfo) {
        this.setData({
          visible: true,
          avatarUrl: userInfo.avatarUrl || this.data.avatarUrl || '',
          nickName: userInfo.nickName || this.data.nickName || '',
          canSubmit: !!((userInfo.avatarUrl || this.data.avatarUrl) && (userInfo.nickName || this.data.nickName))
        });
      } else {
        this.setData({ visible: true });
      }
    },

    hide() {
      this.setData({ visible: false });
    },

    onChooseAvatar(e) {
      const { avatarUrl } = e.detail;
      this.setData({
        avatarUrl,
        canSubmit: !!(avatarUrl && this.data.nickName)
      });
    },

    onNicknameInput(e) {
      const { value } = e.detail;
      this.setData({
        nickName: value,
        canSubmit: !!(this.data.avatarUrl && value)
      });
    },

    onNicknameChange(e) {
        // Handle blur event/enter which sometimes is needed for type="nickname" persistence
        const { value } = e.detail;
        this.setData({
            nickName: value,
            canSubmit: !!(this.data.avatarUrl && value)
        });
    },

    onConfirm() {
      console.log('onConfirm', this.data);
      if (!this.data.canSubmit) return;
      
      this.setData({ submitting: true });
      
      const { avatarUrl, nickName } = this.data;
      
      // Trigger event to parent with the data
      this.triggerEvent('submit', {
        avatarUrl,
        nickName
      });
      
      // We don't hide immediately, let parent handle it or we hide after success
    },

    stopLoading() {
      this.setData({ submitting: false });
    }
  }
})
