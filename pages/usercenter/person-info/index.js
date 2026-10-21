import { fetchPerson } from '../../../services/usercenter/fetchPerson';
import { phoneEncryption } from '../../../utils/util';

Page({
  data: {
    personInfo: { avatarUrl: '', nickName: '', gender: 0, phoneNumber: '' },
    genderMap: ['', '男', '女'],
  },
  async onLoad() {
    try {
      const personInfo = await fetchPerson();
      this.setData({
        personInfo: { ...personInfo, phoneNumber: phoneEncryption(personInfo.phoneNumber) },
      });
    } catch (error) {
      console.error('[profile:load:failed]', error);
      wx.showToast({ title: '个人资料加载失败，请重试', icon: 'none' });
    }
  },
});
