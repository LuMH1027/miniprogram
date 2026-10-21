import Toast from 'tdesign-miniprogram/toast/index';
import { listOrder } from '../../../services/order/order';
import { getAllOrderItemsOfAnOrder } from '../../../services/order/orderItem';
import { LIST_LOADING_STATUS } from '../../../utils/listLoading';
import { getCloudImageTempUrl } from '../../../utils/cloudImageHandler';
import { orderListFinishFresh } from '../../../utils/orderListFresh';

function getRemarkText(remark) {
  return typeof remark === 'string' && remark.trim() ? remark.trim() : '无备注';
}

function formatDateTime(time) {
  const date = new Date(time || Date.now());
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

Page({
  page: {
    size: 5,
    num: 1,
  },

  data: {
    orderList: [],
    totalOrderCount: 0,
    listLoading: LIST_LOADING_STATUS.READY,
    emptyImg: 'https://cdn-we-retail.ym.tencent.com/miniapp/order/empty-order-list.png',
    backRefresh: false,
    pullDownRefreshing: false,
    loadingProps: {
      theme: 'circular',
      size: '40rpx',
    },
  },

  errorToast(message, e) {
    console.error(message, e);
    this.toast(message);
  },

  toast(message) {
    Toast({
      context: this,
      selector: '#t-toast',
      message,
      duration: 1000,
      icon: '',
    });
  },

  onLoad(query) {
    console.info('[order-list:query]', query);
  },

  async pullRefresh() {
    this.setData({ pullDownRefreshing: true });
    try {
      await this.onRefresh();
      orderListFinishFresh();
    } catch (e) {
      this.errorToast('获取订单列表失败', e);
    } finally {
      this.setData({ pullDownRefreshing: false });
    }
  },

  async onShow() {
    this.getTabBar().init();
    try {
      console.info('[order-list:onShow:refresh]');
      await this.onRefresh();
      orderListFinishFresh();
    } catch (e) {
      this.errorToast('获取订单列表失败', e);
    }
  },

  onReachBottom() {
    if (this.data.listLoading === LIST_LOADING_STATUS.READY) {
      this.getOrderList();
    }
  },

  async getOrderItems(order) {
    const orderId = order._id;
    try {
      const orderItems = await getAllOrderItemsOfAnOrder({ orderId });

      const images = orderItems.map((x) => x.sku.image ?? '');
      (await getCloudImageTempUrl(images)).forEach((image, index) => (orderItems[index].sku.image = image));

      order.orderItems = orderItems;
      order.previewImages = orderItems.slice(0, 3).map((item) => item.sku.image).filter(Boolean);
      order.totalCount = orderItems.reduce((sum, item) => sum + item.count, 0);
      order.totalPrice = orderItems.reduce((acc, cur) => acc + cur.sku.price * cur.count, 0);
      order.itemSummary = orderItems.map((item) => item?.sku?.spu?.name || '菜品').slice(0, 3).join('、');
      order.createTimeText = formatDateTime(order.createdAt || order.createTime);
    } catch (e) {
      this.errorToast('获取订单详情失败', e);
    }
  },

  async getOrderList(reset = false) {
    if (this._loadingOrders) return;
    this._loadingOrders = true;
    this.setData({
      listLoading: LIST_LOADING_STATUS.LOADING,
    });
    try {
      const { records, total } = await listOrder({
        pageSize: this.page.size,
        pageNumber: this.page.num,
      });
      console.info('[order-list:getOrderList:records]', {
        reset,
        total,
        count: records.length,
        ids: records.map((order) => order._id),
      });

      records.forEach((order) => {
        order.remarkText = getRemarkText(order.remark);
      });

      // async get items for each order
      await Promise.all(records.map((order) => this.getOrderItems(order)));

      const orderList = reset ? records : this.data.orderList.concat(records);
      const listLoading = orderList.length >= total ? LIST_LOADING_STATUS.NO_MORE : LIST_LOADING_STATUS.READY; // TODO: maybe we should notify user when `length > total`?

      this.setData({ listLoading, orderList, totalOrderCount: total });
      const currentNum = reset ? 1 : this.page.num;
      this.page.num = currentNum + 1;
    } catch (e) {
      console.error('获取订单列表失败', e);
      this.setData({ listLoading: LIST_LOADING_STATUS.FAILED });
    } finally {
      this._loadingOrders = false;
    }
  },

  onReTryLoad() {
    this.getOrderList();
  },

  refreshList() {
    if (this._loadingOrders) return;
    this.page = {
      size: this.page.size,
      num: 1,
    };
    this.setData({ orderList: [] });

    return this.getOrderList(true);
  },

  onRefresh() {
    return this.refreshList();
  },

  onOrderCardTap(e) {
    const { order } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/order/order-detail/index?orderId=${order._id}`,
    });
  },

  goPickFood() {
    wx.switchTab({ url: '/pages/home/home' });
  },
});
