import { fetchUserCenter } from '../../services/usercenter/fetchUsercenter';
import { getFinishedOrderCount, getToPayOrderCount, getToSendOrderCount } from '../../services/order/order';
import { ORDER_STATUS } from '../../services/order/order';
import Toast from 'tdesign-miniprogram/toast/index';

const menuData = [
  [
    {
      title: '我们的地址',
      tit: '',
      url: '',
      type: 'address',
    },
  ],
];

const orderTagInfos = [
  {
    title: '待付款',
    iconName: 'wallet',
    orderNum: 0,
    tabType: ORDER_STATUS.TO_PAY,
    status: 1,
  },
  {
    title: '甜品制作中',
    iconName: 'deliver',
    orderNum: 0,
    tabType: ORDER_STATUS.TO_SEND,
    status: 1,
  },
  {
    title: '已完成',
    iconName: 'package',
    orderNum: 0,
    tabType: ORDER_STATUS.FINISHED,
    status: 1,
  },
];

const getDefaultData = () => ({
  userInfo: {
    avatarUrl: '',
    nickName: '正在登录...',
    phoneNumber: '',
  },
  menuData,
  orderTagInfos,
  currAuthStep: 1,
});

Page({
  data: getDefaultData(),

  onShow() {
    this.getTabBar().init();
    this.init();
  },
  onPullDownRefresh() {
    this.init();
  },

  init() {
    this.fetUseriInfoHandle();
    this.initOrderCount();
  },

  async initOrderCount() {
    const [pay, send, finished] = await Promise.all([
      getToPayOrderCount(),
      getToSendOrderCount(),
      getFinishedOrderCount(),
    ]);
    this.setData({
      'orderTagInfos[0].orderNum': pay,
      'orderTagInfos[1].orderNum': send,
      'orderTagInfos[2].orderNum': finished,
    });
  },

  fetUseriInfoHandle() {
    fetchUserCenter().then(({ userInfo }) => {
      this.setData({
        userInfo,
        menuData,
        currAuthStep: 2,
      });
      wx.stopPullDownRefresh();
    });
  },

  onClickCell({ currentTarget }) {
    const { type } = currentTarget.dataset;

    switch (type) {
      case 'address': {
        wx.navigateTo({ url: '/pages/usercenter/address/list/index' });
        break;
      }
      default: {
        Toast({
          context: this,
          selector: '#t-toast',
          message: '未知跳转',
          icon: '',
          duration: 1000,
        });
        break;
      }
    }
  },

  jumpNav(e) {
    const status = e.detail.tabType;
    wx.setStorageSync('orderListStatus', status);
    wx.switchTab({ url: '/pages/order/order-list/index' });
  },

  jumpAllOrder() {
    wx.removeStorageSync('orderListStatus');
    wx.switchTab({ url: '/pages/order/order-list/index' });
  },



  gotoUserEditPage() {
    const { currAuthStep } = this.data;
    if (currAuthStep === 2) {
      wx.navigateTo({ url: '/pages/usercenter/person-info/index' });
    } else {
      this.fetUseriInfoHandle();
    }
  },

});
