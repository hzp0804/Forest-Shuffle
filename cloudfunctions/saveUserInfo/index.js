// cloudfunctions/saveUserInfo/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  
  const { avatarUrl, nickName } = event

  if (!openId) {
    return { success: false, msg: 'No OpenID found' }
  }

  try {
    const usersCollection = db.collection('userList')
    
    // 查询已有记录
    const { data: users } = await usersCollection.where({
      _openid: openId
    }).get()

    const now = db.serverDate()

    if (users && users.length > 0) {
      // 更新
      const userId = users[0]._id
      await usersCollection.doc(userId).update({
        data: {
          avatarUrl,
          nickName,
          updateTime: now
        }
      })
      return { success: true, type: 'update', openId }
    } else {
      // 新增
      await usersCollection.add({
        data: {
          _openid: openId,
          avatarUrl,
          nickName,
          createTime: now,
          updateTime: now
        }
      })
      return { success: true, type: 'add', openId }
    }
  } catch (err) {
    console.error(err)
    return { success: false, msg: err.message, err }
  }
}
