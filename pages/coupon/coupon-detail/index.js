import { fetchCouponDetail } from '../../../services/coupon/index';
import { redirectUnavailableFeature } from '../../../utils/routeGuard';

Page({
  data: {
    detail: null,
    storeInfoList: [],
    storeInfoStr: '',
    showStoreInfoList: false,
  },

  id: '',

  onLoad(query) {
    if (redirectUnavailableFeature('coupon-detail', '/pages/usercenter/index')) return;
    const id = parseInt(query.id);
    this.id = id;
    this.getGoodsList(id);
  },

  getGoodsList(id) {
    fetchCouponDetail(id).then(({ detail }) => {
      this.setData({
        detail,
      });
    });
  },

  navGoodListHandle() {
    wx.navigateTo({
      url: `/pages/coupon/coupon-activity-goods/index?id=${this.id}`,
    });
  },
});
