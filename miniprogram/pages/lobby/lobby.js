const { GAME_CONFIG } = require("../../data/constants");
const Utils = require("../../utils/utils");
const STORAGE_KEY = "userProfile";
const BASE_DECK_SIZE = GAME_CONFIG.BASE_DECK_SIZE;

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
  if (!profile) return null;
  // Rename uid to openId if needed to match latest convention
  const openId = profile.openId || profile.uid;
  if (!openId) return null;

  const normalized = {
    ...profile,
    openId, // Ensure openId field exists
    authorized: true,
  };
  // Also updating stored object structure
  if (!profile.openId || !profile.authorized) {
    saveProfile(normalized);
  }
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
  return Math.random().toString().slice(2, 5).padEnd(3, "0");
};

Page({
  data: {
    userProfile: null,
    defaultAvatar: "", // 使用空字符串，让系统使用默认头像
    isSeated: false,
    isInRoom: false,
    isHost: false,
    baseDeckSize: BASE_DECK_SIZE,
    roomCode: "",
    joinRoomCode: "",
    createForm: {
      cardCount: 233, // 默认一套牌:230张普通卡 + 3张冬季卡
      winterStartOffset: 30,
      enableVoice: false,
      enableAlpine: true,
      enableEdge: true,
    },
    seats: [
      { id: 1, label: "座位1", occupant: null },
      { id: 2, label: "座位2", occupant: null },
      { id: 3, label: "座位3", occupant: null },
      { id: 4, label: "座位4", occupant: null },
      { id: 5, label: "座位5", occupant: null },
      { id: 6, label: "座位6", occupant: null },
    ],
    roomList: [],
    roomSettings: null,
    roomStatus: "waiting",
  },

  onLoad() {
    const app = getApp();
    const globalProfile = app.globalData.userProfile;

    // 判断是否已登录（只要有 openId 且有昵称认为已登录）
    if (globalProfile && globalProfile.openId && globalProfile.nickName) {
      const profile = { ...globalProfile };
      profile.avatarUrl = Utils.getAvatarPath(
        profile.openId,
        profile.avatarUrl
      );
      this.setData({ userProfile: profile });
    } else {
      wx.showToast({ title: "请先在首页登录", icon: "none", duration: 2000 });
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
    // 开启房间列表轮询（每5秒刷新一次）
    this.roomListPolling = setInterval(() => {
      this.fetchRoomList();
    }, 5000);
  },

  onHide() {
    this.stopRoomPolling();
    if (this.roomListPolling) {
      clearInterval(this.roomListPolling);
      this.roomListPolling = null;
    }
  },

  onPullDownRefresh() {
    this.fetchRoomList().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onUnload() {
    this.stopRoomPolling();
    // 停止房间列表轮询
    if (this.roomListPolling) {
      clearInterval(this.roomListPolling);
      this.roomListPolling = null;
    }
    if (this.roomWatcher) {
      this.roomWatcher.close();
    }
  },

  ensureProfileOrBack() {
    if (
      this.data.userProfile &&
      (this.data.userProfile.uid || this.data.userProfile.openId)
    ) {
      return true;
    }
    wx.showToast({ title: "请返回首页登录", icon: "none" });
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
      success: () => wx.showToast({ title: "房间号已复制", icon: "none" }),
    });
  },

  onCardCountInput(e) {
    const val = parseInt(e.detail.value, 10);
    const MAX_DECK_SIZE = GAME_CONFIG.MAX_DECK_SIZE || 693; // 最大牌库数量

    if (!isNaN(val) && val > MAX_DECK_SIZE) {
      wx.showToast({
        title: `最多${MAX_DECK_SIZE}张`,
        icon: "none",
        duration: 2000,
      });
      this.setData({
        "createForm.cardCount": MAX_DECK_SIZE,
      });
      return;
    }

    this.setData({
      "createForm.cardCount": isNaN(val) ? "" : val,
    });
  },

  onWinterStartInput(e) {
    const val = parseInt(e.detail.value, 10);
    this.setData({
      "createForm.winterStartOffset": isNaN(val) ? "" : val,
    });
  },

  onVoiceSwitchChange(e) {
    this.setData({
      "createForm.enableVoice": e.detail.value,
    });
  },

  updateCardCountByExtensions() {
    const { enableAlpine, enableEdge } = this.data.createForm;
    let count = GAME_CONFIG.BASIC_DECK_SIZE;
    if (enableAlpine) count += GAME_CONFIG.ALPINE_DECK_SIZE;
    if (enableEdge) count += GAME_CONFIG.EDGE_DECK_SIZE;

    this.setData({
      "createForm.cardCount": count,
    });

    wx.showToast({
      title: `卡牌数量已更新为 ${count} 张`,
      icon: "none",
    });
  },

  onAlpineSwitchChange(e) {
    this.setData(
      {
        "createForm.enableAlpine": e.detail.value,
      },
      () => {
        this.updateCardCountByExtensions();
      }
    );
  },

  onEdgeSwitchChange(e) {
    this.setData(
      {
        "createForm.enableEdge": e.detail.value,
      },
      () => {
        this.updateCardCountByExtensions();
      }
    );
  },

  async onCreateRoom() {
    if (!this.ensureProfileOrBack()) return;
    const { createForm, userProfile } = this.data;
    const cardCount = Number(createForm.cardCount) || BASE_DECK_SIZE;
    const winterStartOffset = Number(createForm.winterStartOffset) || 0;

    wx.showLoading({
      title: "创建房间中...",
      mask: true,
    });

    const db = wx.cloud.database();
    const _ = db.command;

    try {
      // 1. 清理该用户已创建的其他未开始房间（进行中不删）
      const oldRoomsRes = await db
        .collection("rooms")
        .where({
          hostOpenId: userProfile.openId,
          status: "waiting",
        })
        .get();

      const closePromises = (oldRoomsRes.data || []).map((r) =>
        db
          .collection("rooms")
          .doc(r._id)
          .update({
            data: {
              status: "closed",
            },
          })
      );
      await Promise.all(closePromises);

      // 2. 生成 001 开始的 3 位房间号 (按顺序查找可用)
      // 查询当前活跃房间
      const activeRes = await db
        .collection("rooms")
        .where({
          status: _.in(["waiting", "playing"]),
        })
        .field({
          roomCode: true,
        })
        .get();

      const usedCodes = new Set(activeRes.data.map((r) => r.roomCode));
      let codeInt = 1;
      let finalCode = "001";
      while (codeInt <= 999) {
        const s = String(codeInt).padStart(3, "0");
        if (!usedCodes.has(s)) {
          finalCode = s;
          break;
        }
        codeInt++;
      }
      // 如果 999 满了，fallback 到随机
      if (codeInt > 999) {
        finalCode = Math.floor(Math.random() * 900 + 100).toString();
      }

      // 3. 构建房间数据
      const initialSeats = Array(6).fill(null);
      initialSeats[0] = {
        openId: userProfile.openId, // 明确使用 openId
        nickName: userProfile.nickName,
        avatarUrl: userProfile.avatarUrl,
        seatId: 1, // 这里的ID对应界面显示的1-6
        ready: true,
      };

      const roomData = {
        roomCode: finalCode,
        hostOpenId: userProfile.openId,
        status: "waiting",
        players: initialSeats,
        settings: {
          totalCardCount: cardCount,
          winterStartOffset,
          enableVoice: createForm.enableVoice ?? false,
          enableAlpine: createForm.enableAlpine ?? true,
          enableEdge: createForm.enableEdge ?? true,
        },
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
      };

      const res = await db.collection("rooms").add({
        data: roomData,
      });
      wx.hideLoading();

      // 更新本地状态，进入房间视图
      this.setData({
        isInRoom: true,
        isHost: true,
        roomId: res._id,
        roomCode: finalCode,
      });

      wx.showToast({
        title: "创建成功",
        icon: "success",
      });

      // 开启监听
      this.initRoomWatcher(res._id);
    } catch (err) {
      wx.hideLoading();
      if (
        err.errMsg &&
        (err.errMsg.includes("not exists") || err.errMsg.includes("not found"))
      ) {
        wx.showModal({
          title: "提示",
          content:
            '请在云开发控制台创建 "rooms" 集合，并在"数据权限"中设置为"所有用户可读，创建者可写"（开发阶段）或使用云函数创建。',
          showCancel: false,
        });
      } else {
        wx.showToast({
          title: "创建失败",
          icon: "none",
        });
      }
    }
  },

  onJoinInput(e) {
    this.setData({
      joinRoomCode: e.detail.value.replace(/\s/g, ""),
    });
  },

  findMySeatIndex() {
    const { seats, userProfile } = this.data;
    if (!userProfile || !userProfile.uid) return -1;
    return seats.findIndex(
      (s) => s.occupant && s.occupant.uid === userProfile.uid
    );
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
    if (
      target.occupant &&
      target.occupant.uid !== userProfile.uid &&
      target.occupant.uid !== userProfile.openId
    ) {
      wx.showToast({ title: "座位已被占用", icon: "none" });
      return;
    }

    // 点击自己：不做反应
    if (
      target.occupant &&
      (target.occupant.uid === userProfile.uid ||
        target.occupant.uid === userProfile.openId)
    ) {
      return;
    }

    // 检查游戏状态：如果已经在进行中，不允许换座位
    if (this.data.roomStatus === "playing") {
      wx.showToast({ title: "游戏进行中，不可换座", icon: "none" });
      return;
    }

    // 2. 也是为了"及时同步数据"，在操作前拉最新的房间数据检查
    wx.showLoading({ title: "请求中...", mask: true });
    const db = wx.cloud.database();

    db.collection("rooms")
      .doc(roomId)
      .get()
      .then((res) => {
        const remoteRoom = res.data;
        if (!remoteRoom) {
          wx.hideLoading();
          wx.showToast({ title: "房间不存在", icon: "none" });
          return;
        }

        if (remoteRoom.status === "playing") {
          wx.hideLoading();
          wx.showToast({ title: "游戏进行中，不可换座", icon: "none" });
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
        if (
          remotePlayer &&
          remotePlayer.openId &&
          remotePlayer.openId !== userProfile.openId
        ) {
          wx.hideLoading();
          wx.showToast({ title: "位置已被人抢了", icon: "none" });
          // 触发一次 update 刷新界面
          this.updateSeatsFromPlayers(players);
          return;
        }

        // 构造更新数据
        // 直接修改整个 players 数组，避免 dot notation 更新 null 元素时的报错
        const nextPlayers = [...players];

        // 如果我已经入座了，需要把原来的位置清空 (换位)
        const myRemoteIndex = nextPlayers.findIndex(
          (p) => p && p.openId === userProfile.openId
        );

        if (myRemoteIndex !== -1 && myRemoteIndex !== targetIndex) {
          nextPlayers[myRemoteIndex] = null;
        }

        nextPlayers[targetIndex] = {
          openId: userProfile.openId,
          nickName: userProfile.nickName || "玩家",
          avatarUrl: userProfile.avatarUrl || this.data.defaultAvatar,
          seatId: seatId,
          ready: false,
        };

        return db
          .collection("rooms")
          .doc(roomId)
          .update({
            data: {
              players: nextPlayers,
            },
          })
          .then(() => {
            wx.hideLoading();
            // 成功后，手动刷新一次，polling 也会接手
            this.fetchRoomInfo();
          });
      })
      .catch((err) => {
        wx.hideLoading();
        console.error("Seat op failed:", err);
        wx.showToast({ title: "操作失败，请重试", icon: "none" });
      });
  },

  onExitRoom() {
    const { roomId, userProfile, roomStatus } = this.data;
    if (!roomId) {
      this.setData({ isInRoom: false, isHost: false, roomCode: "" });
      return;
    }

    // 游戏进行中不清空座位，保留身份便于后续返回
    if (roomStatus === "playing") {
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

    db.collection("rooms")
      .doc(roomId)
      .update({
        data: {
          [updateKey]: null,
        },
        success: () => {
          wx.showToast({ title: "已退出", icon: "none" });
          this.leaveRoomLocal();
        },
        fail: (err) => {
          console.error("Exit room failed:", err);
          wx.showToast({ title: "退出失败", icon: "none" });
        },
      });
  },

  onRoomContainerLeave() {
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
      roomCode: "",
      roomId: "",
      seats: this.data.seats.map((s) => ({ ...s, occupant: null })), // 清空座位
      isSeated: false,
      isGameStarted: false,
    });
    this.fetchRoomList();
    this.stopRoomPolling();
    this.fetchRoomList();
  },

  startRoomPolling(roomId) {
    this.stopRoomPolling(); // 防止重复
    this.pollingTimer = setInterval(() => {
      this.fetchRoomInfo(roomId);
    }, 2000); // 2s 一次，避免过快轮询
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
    db.collection("rooms")
      .doc(id)
      .get()
      .then((res) => {
        if (res.data) {
          const room = res.data;
          if (room.status === "closed") {
            wx.showToast({ title: "房间已关闭", icon: "none" });
            this.leaveRoomLocal();
            return;
          }
          this.updateSeatsFromPlayers(room.players);
          if (room.settings) {
            this.setData({ roomSettings: room.settings });
          }
        }
      })
      .catch((err) => {
        console.error("Poll room failed:", err);
        // 如果是找不到，说明房间解散了
        if (
          err.errMsg &&
          (err.errMsg.includes("not exists") ||
            err.errMsg.includes("not found"))
        ) {
          this.leaveRoomLocal();
        }
      });
  },

  onJoinRoom(e) {
    if (!this.ensureProfileOrBack()) return;
    const code = (
      e.currentTarget.dataset.code ||
      this.data.joinRoomCode ||
      ""
    ).trim();
    if (!code) {
      wx.showToast({ title: "请输入房间号", icon: "none" });
      return;
    }

    wx.showLoading({ title: "查找房间...", mask: true });

    const db = wx.cloud.database();
    const _ = db.command;

    // 1. 查询房间是否存在
    db.collection("rooms")
      .where({
        roomCode: code,
      })
      .get({
        success: (res) => {
          if (!res.data || res.data.length === 0) {
            wx.hideLoading();
            wx.showToast({ title: "房间不存在", icon: "none" });
            return;
          }

          const room = res.data[0];
          const players = room.players || [];

          // 检查是否已经在房间里
          const myUid = this.data.userProfile.openId;
          const alreadyInIndex = players.findIndex(
            (p) => p && p.openId === myUid
          );

          // 场景A: 游戏已开始/已结束，或者是等待中但自己已在列
          // 允许重新进入的条件：我在名单里
          if (alreadyInIndex !== -1) {
            wx.hideLoading();
            if (room.status === "closed") {
              wx.showToast({ title: "房间已关闭", icon: "none" });
              return;
            }
            // 无论 playing 还是 waiting，只要在名单里都允许回房
            // TODO: 如果是 playing，可能需要跳转到游戏页？目前先回房间页，等待 watcher 同步状态
            this.enterRoomLocal(room);
            return;
          }

          // 场景B: 新玩家加入
          // 前提：房间必须是 waiting
          // 前提：房间必须是 waiting，除非是观战
          if (room.status !== "waiting") {
            if (room.status === "playing") {
              // 允许观战
              this.enterRoomLocal(room);
              wx.hideLoading();
              return;
            }
            wx.hideLoading();
            wx.showToast({ title: "房间已关闭", icon: "none" });
            return;
          }

          // 找空位
          const emptyIndex = players.findIndex((p) => !p);
          if (emptyIndex === -1) {
            wx.hideLoading();
            wx.showToast({ title: "房间已满", icon: "none" });
            return;
          }

          // 2. 占位更新 (自动落座)
          // 改为全量更新 players 数组，避免 update key 针对 null 元素报错 "Cannot create field ... in element null"
          const nextPlayers = [...players];
          const newPlayer = {
            openId: myUid,
            nickName: this.data.userProfile.nickName,
            avatarUrl: this.data.userProfile.avatarUrl,
            seatId: emptyIndex + 1,
            ready: false,
          };
          nextPlayers[emptyIndex] = newPlayer;

          db.collection("rooms")
            .doc(room._id)
            .update({
              data: {
                players: nextPlayers,
              },
              success: (updateRes) => {
                wx.hideLoading();
                // 乐观更新本地数据，实际会由 watcher 修正
                room.players = nextPlayers;
                this.enterRoomLocal(room);
              },
              fail: (err) => {
                wx.hideLoading();
                console.error("Join failed:", err); // 可能是并发导致的位置冲突
                wx.showToast({ title: "加入失败，请重试", icon: "none" });
              },
            });
        },
        fail: (err) => {
          wx.hideLoading();
          console.error("Query room failed:", err);
          wx.showToast({ title: "查询失败", icon: "none" });
        },
      });
  },

  enterRoomLocal(roomData) {
    const isHost = roomData.hostOpenId === this.data.userProfile.openId;

    this.setData({
      isInRoom: true,
      isHost: isHost,
      roomId: roomData._id,
      roomCode: roomData.roomCode,
      roomSettings: roomData.settings || {},
      roomStatus: roomData.status || "waiting",
    });

    this.updateSeatsFromPlayers(roomData.players);
    // 启动实时监听
    this.initRoomWatcher(roomData._id);
    // 注释：已使用实时推送,不再需要轮询
    // this.startRoomPolling(roomData._id);
  },

  updateSeatsFromPlayers(players) {
    const newSeats = this.data.seats.map((s, i) => {
      // players 数组索引和你 seats 数组索引是一一对应的吗？
      // 假设 players 是长度为6的数组，索引0对应id=1
      const p = players[i];
      return {
        ...s,
        occupant: p
          ? {
              openId: p.openId,
              nickName: p.nickName,
              avatarUrl: Utils.getAvatarPath(p.openId, p.avatarUrl),
            }
          : null,
      };
    });

    // 检查自己是否在座位上（更新 isSeated 状态）
    const myUid = this.data.userProfile.openId;
    const amISeated = players.some((p) => p && p.openId === myUid);

    this.setData({
      seats: newSeats,
      isSeated: amISeated,
    });
  },

  initRoomWatcher(roomId) {
    if (this.roomWatcher) return; // 避免重复监听
    const db = wx.cloud.database();
    this.roomWatcher = db
      .collection("rooms")
      .doc(roomId)
      .watch({
        onChange: (snapshot) => {
          // 如果房间被删除
          if (!snapshot.docs || snapshot.docs.length === 0) {
            wx.showToast({ title: "房间已解散", icon: "none" });
            this.leaveRoomLocal();
            return;
          }

          const room = snapshot.docs[0];

          // 状态监听：跳转游戏
          if (room.status === "playing") {
            // 确保只跳转一次
            if (!this.data.isGameStarted) {
              this.setData({ isGameStarted: true });
              wx.navigateTo({
                url: `/pages/game/game?roomId=${roomId}`,
              });
            }
          }

          // 如果房间被关闭
          if (room.status === "closed") {
            wx.showToast({ title: "房间已关闭", icon: "none" });
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
          console.error("Watch error:", err);
        },
      });
  },

  onStartGame() {
    if (!this.data.isHost) return;
    const { seats, roomSettings, roomId } = this.data;
    const activePlayers = seats
      .filter((s) => s.occupant)
      .map((s) => s.occupant);

    if (activePlayers.length < 1) {
      // 允许单人调试，正式可能限制2人
      wx.showToast({ title: "人数不足", icon: "none" });
      return;
    }

    wx.showLoading({ title: "正在洗牌...", mask: true });

    // 1. 构建牌库
    const cardData = require("../../data/cardData.js");
    let rawDeck = [];

    // 使用 CARDS_DATA 作为单一事实来源
    // CARDS_DATA 的 key 是卡牌ID，value 是卡牌定义。每个 entry 代表物理上的一张卡。
    const sourceData = cardData.CARDS_DATA || {};
    const sourceKeys = Object.keys(sourceData);

    // 1. 计算单套牌中普通卡的数量(排除冬季卡及未开启的扩展)
    const { DECK_TYPES, CARD_TYPES } = require("../../data/constants");

    // 获取配置，默认为 true 以防旧数据未设置
    const enableAlpine = roomSettings.enableAlpine !== false;
    const enableEdge = roomSettings.enableEdge !== false;

    const normalCards = sourceKeys.filter((key) => {
      const cardDef = sourceData[key];
      if (!cardDef) return false;

      // 排除冬季卡
      if (cardDef.type === CARD_TYPES.W_CARD) return false;

      // 过滤扩展包
      if (!enableAlpine && cardDef.deck === DECK_TYPES.ALPINE) return false;
      if (!enableEdge && cardDef.deck === DECK_TYPES.EDGE) return false;

      return true;
    });
    const oneSetCount = normalCards.length;

    if (oneSetCount === 0) {
      console.error("Fatal: No cards found in CARDS_DATA");
      wx.hideLoading();
      wx.showToast({ title: "牌库数据为空", icon: "none" });
      return;
    }

    const BASE_DECK_SIZE = GAME_CONFIG.BASE_DECK_SIZE;
    const WINTER_CARD_COUNT = GAME_CONFIG.WINTER_CARD_COUNT;

    // 2. 获取目标总数
    let totalTarget = roomSettings.totalCardCount;
    // 兼容旧数据
    if (!totalTarget) {
      // 旧版逻辑是用 setCount * 233，这里近似处理，或者直接设为默认
      totalTarget = (roomSettings.setCount || 1) * BASE_DECK_SIZE;
    }

    // 关键调整：用户设置的 totalTarget 是包含冬季卡的。
    // 所以实际需要构建的基础牌数量 = 总数 - 冬季卡数
    let baseCardTarget = totalTarget - WINTER_CARD_COUNT;
    if (baseCardTarget < 0) baseCardTarget = 0; // 防御性编程

    const fullSets = Math.floor(baseCardTarget / oneSetCount);
    const remainder = baseCardTarget % oneSetCount;

    // 3. 构建完整套牌(使用预过滤的普通卡列表)
    for (let s = 0; s < fullSets; s++) {
      normalCards.forEach((key) => {
        rawDeck.push({
          id: key,
          uid: `${key}_set${s}_${Math.random().toString(36).slice(2)}`,
        });
      });
    }

    // 4. 构建剩余散牌(使用预过滤的普通卡列表)
    if (remainder > 0) {
      let extraSet = normalCards.map((key) => ({ id: key }));

      // Fisher-Yates shuffle
      for (let i = extraSet.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [extraSet[i], extraSet[j]] = [extraSet[j], extraSet[i]];
      }

      // 取前 remainder 张
      const partial = extraSet.slice(0, remainder);
      partial.forEach((p, idx) => {
        rawDeck.push({
          id: p.id,
          uid: `${p.id}_extra_${idx}_${Math.random().toString(36).slice(2)}`,
        });
      });
    }

    // 5. 洗基础牌库 (Fisher-Yates)
    for (let i = rawDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rawDeck[i], rawDeck[j]] = [rawDeck[j], rawDeck[i]];
    }

    // 6. 插入冬季卡
    // 逻辑：将冬季卡洗入牌库底部
    // 使用房间设置的 winterStartOffset (默认30)
    let bottomSize = roomSettings.winterStartOffset;
    if (!bottomSize || bottomSize <= 0) {
      bottomSize = Math.floor(rawDeck.length / 3); // Fallback
    }
    // 确保不过大
    if (bottomSize > rawDeck.length) bottomSize = rawDeck.length;

    // splitIndex 是上部和下部的分界点
    const splitIndex = rawDeck.length - bottomSize;

    const topPart = rawDeck.slice(0, splitIndex);
    const bottomPart = rawDeck.slice(splitIndex);

    // 添加 3 张冬季卡 (ID需与前端判定一致，通常用 card.id='Winter' 或 type='WinterCount' 判定)
    const WINTER_CARD_ID = "Winter";
    for (let w = 1; w <= WINTER_CARD_COUNT; w++) {
      bottomPart.push({
        id: WINTER_CARD_ID,
        uid: `${WINTER_CARD_ID}_${w}_${Math.random().toString(36).slice(2)}`,
        type: "Winter", // 显式标记类型
      });
    }

    // 洗混底部区域 (包含冬季卡)
    for (let i = bottomPart.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bottomPart[i], bottomPart[j]] = [bottomPart[j], bottomPart[i]];
    }

    // 合并：上部安全区 + 混有冬季卡的下部
    const finalDeck = topPart.concat(bottomPart);

    console.group("Shuffle Result");
    console.log(`🌳 基础卡牌数: ${rawDeck.length}`);
    console.log(`🌳 冬季卡牌数: ${WINTER_CARD_COUNT}`);
    console.log(`🌳 总卡牌数: ${finalDeck.length}`);
    console.groupEnd();

    // 7. 发牌 (Initial Hand)
    const HAND_SIZE = 6;
    const playerStates = {};
    const turnOrder = [];

    // 获取 activePlayers 的 UID/OpenID
    // 注意：activePlayers 是 seat.occupant 对象
    activePlayers.forEach((p) => {
      // 优先使用 openId 作为唯一标识
      const pid = p.openId;
      turnOrder.push(pid);

      const hand = [];
      for (let k = 0; k < HAND_SIZE; k++) {
        if (finalDeck.length > 0) {
          hand.push(finalDeck.shift());
        }
      }

      playerStates[pid] = {
        hand: hand,
        cave: [],
        forest: [],
        score: 0,
      };
    });

    // 8. 初始化 GameState
    // 随机先手
    const firstPlayer = turnOrder[Math.floor(Math.random() * turnOrder.length)];

    const gameState = {
      deck: finalDeck,
      clearing: [],
      playerStates: playerStates,
      activePlayer: firstPlayer, // 确保字段名一致
      turnOrder: turnOrder, // 记录顺序备用
      roundCount: 1,
      turnCount: 0,
      turnReason: "normal",
      winterCount: 0,
      logs: [],
      // 特殊行动相关字段
      pendingActions: [], // 待处理的特殊行动队列
      actionMode: null, // 当前行动模式：null | 'MOLE' | 'FREE_PLAY_BAT' | 'RACCOON' 等
      accumulatedRewards: {
        // 累积的奖励（在所有行动结束后统一执行）
        drawCount: 0,
        extraTurn: false,
      },
    };

    // 9. 写入数据库
    const db = wx.cloud.database();
    db.collection("rooms")
      .doc(roomId)
      .update({
        data: {
          status: "playing",
          startTime: db.serverDate(),
          gameState: gameState,
          activePlayer: firstPlayer, // 顶层也存一份方便查询
        },
        success: () => {
          wx.hideLoading();
        },
        fail: (err) => {
          wx.hideLoading();
          console.error("Start game failed", err);
          wx.showToast({ title: "启动失败", icon: "none" });
        },
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
    return db
      .collection("rooms")
      .orderBy("createTime", "desc")
      .limit(50) // Increase limit slightly to see more history
      .get()
      .then((res) => {
        const list = (res.data || []).map((room) => {
          const count = (room.players || []).filter((p) => p).length;
          // Fix: 房主应该是创建者(hostOpenId)，而不是固定取座位1(players[0])
          // 尝试在 players 中找到 host
          let hostPlayer = null;
          if (room.hostOpenId && room.players) {
            hostPlayer = room.players.find(
              (p) => p && p.openId === room.hostOpenId
            );
          }
          // 如果找不到(比如房主退出了或者数据异常)，回退到取第一个人
          if (!hostPlayer && room.players && room.players.length > 0) {
            hostPlayer = room.players.find((p) => p); // Find first non-null
          }

          if (hostPlayer && hostPlayer.openId) {
            hostPlayer.avatarUrl = Utils.getAvatarPath(
              hostPlayer.openId,
              hostPlayer.avatarUrl
            );
            // 将 hostAvatar 附加到 room 对象上供列表展示
            room.hostAvatarUrl = hostPlayer.avatarUrl;
            room.hostNickName = hostPlayer.nickName;
          }

          return { ...room, playerCount: count };
        });

        this.setData({
          roomList: list,
        });
      })
      .catch((err) => {
        console.error("Fetch rooms failed:", err);
      });
  },

  onDeleteRoom(e) {
    const roomId = e.currentTarget.dataset.id;
    if (!roomId) return;

    const { userProfile } = this.data;
    if (!userProfile) return;

    wx.showModal({
      title: "确认删除",
      content: "确定要删除这个房间吗？",
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: "删除中..." });
          const db = wx.cloud.database();
          db.collection("rooms")
            .doc(roomId)
            .remove()
            .then(() => {
              wx.hideLoading();
              wx.showToast({ title: "删除成功" });
              this.fetchRoomList(); // 刷新列表
            })
            .catch((err) => {
              wx.hideLoading();
              console.error("Delete room failed:", err);
              wx.showToast({ title: "删除失败", icon: "none" });
            });
        }
      },
    });
  },
});
