import Toast from 'tdesign-miniprogram/toast/index';
import dayjs from 'dayjs';
import { getAllOrderItemsOfAnOrder } from '../../../services/order/orderItem';
import { getOrder, orderStatusToName } from '../../../services/order/order';

function getRemarkText(remark) {
  return typeof remark === 'string' && remark.trim() ? remark.trim() : '无备注';
}

Page({
  data: {
    pageLoading: true,
    order: {}, // 后台返回的原始数据
  },

  toast(message) {
    Toast({
      context: this,
      selector: '#t-toast',
      message,
    });
  },

  onLoad({ orderId }) {
    if (orderId == null) {
      this.toast('异常订单号');
      setTimeout(() => {
        wx.navigateBack();
      }, 1000);
      return;
    }
    this.orderId = orderId;
    this.init();
    this.pullDownRefresh = this.selectComponent('#t-pull-down-refresh');
  },

  onShow() {
    // 当从其他页面返回，并且 backRefresh 被置为 true 时，刷新数据
    if (!this.data.backRefresh) return;
    this.onRefresh();
    this.setData({ backRefresh: false });
  },

  onPageScroll(e) {
    this.pullDownRefresh && this.pullDownRefresh.onPageScroll(e);
  },

  // 页面初始化，会展示pageLoading
  init() {
    this.setData({ pageLoading: true });
    this.getDetail()
      .then(() => {
        this.setData({ pageLoading: false });
      })
      .catch((e) => {
        console.error(e);
      });
  },

  // 页面刷新，展示下拉刷新
  onRefresh() {
    this.init();
    // 如果上一页为订单列表，通知其刷新数据
    const pages = getCurrentPages();
    const lastPage = pages[pages.length - 2];
    if (lastPage) {
      lastPage.data.backRefresh = true;
    }
  },

  // 页面刷新，展示下拉刷新
  onPullDownRefresh_(e) {
    const { callback } = e.detail;
    return this.getDetail().then(() => callback && callback());
  },

  async getDetail() {
    const orderId = this.orderId;
    const [order, orderItems] = await Promise.all([getOrder(orderId), getAllOrderItemsOfAnOrder({ orderId })]);
    order.orderItems = orderItems;
    order.totalPrice = orderItems.reduce((acc, cur) => acc + cur.count * cur.sku.price, 0);
    order.statusDesc = orderStatusToName(order.status);
    order.createdTimeString = dayjs(new Date(order.createdAt)).format('YYYY-MM-DD HH:mm:ss');
    order.remarkText = getRemarkText(order.remark);

    this.setData({ order });
  },

  onGoodsCardTap(e) {
    const { index } = e.currentTarget.dataset;
    const goods = this.data.order.orderItems[index];
    const spuId = goods?.sku?.spu?._id;
    if (!spuId) return;
    wx.navigateTo({ url: `/pages/goods/details/index?spuId=${spuId}` });
  },


});
