import Toast from 'tdesign-miniprogram/toast/index';
import { createOrderItem } from '../../../services/order/orderItem';
import { createOrder, ORDER_STATUS, updateOrderStatus } from '../../../services/order/order';
import { getCartItem, deleteCartItem } from '../../../services/cart/cart';
import { getSkuDetail, updateSku } from '../../../services/sku/sku';
import { getSingleCloudImageTempUrl } from '../../../utils/cloudImageHandler';
import { cartShouldFresh } from '../../../utils/cartFresh';
import { pay } from '../../../services/pay/pay';
import { notifyDeveloperOrder } from '../../../services/order/notifyDeveloper';

const REMARK_MAX_LENGTH = 200;

function sanitizeRemark(value = '') {
  return String(value)
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .slice(0, REMARK_MAX_LENGTH)
    .trim();
}

async function cancelIncompleteOrder(orderId) {
  if (!orderId) return;
  try {
    await updateOrderStatus({
      orderId,
      status: ORDER_STATUS.CANCELED,
      expectedStatus: ORDER_STATUS.TO_PAY,
    });
    console.info('[order-confirm:create:rollback-canceled]', { orderId });
  } catch (e) {
    console.warn('[order-confirm:create:rollback-failed]', { orderId, error: e });
  }
}

async function rollbackReservedSkus(reservedSkus = []) {
  await Promise.all(
    reservedSkus.map(async ({ skuId, count }) => {
      try {
        await updateSku({ skuId, data: { count } });
        console.info('[order-confirm:create:stock-rollback]', { skuId, count });
      } catch (e) {
        console.warn('[order-confirm:create:stock-rollback-failed]', { skuId, count, error: e });
      }
    }),
  );
}

async function createOrderItemFromSku({ count, orderId, skuId, reservedSkus }) {
  if (!Number.isInteger(count) || count < 1) throw new Error('点单数量无效');
  const latestSku = await getSkuDetail(skuId);
  const previousCount = latestSku.count;
  const finalCount = latestSku.count - count;

  // check if sku is enough
  if (!Number.isInteger(finalCount) || finalCount < 0) {
    return Promise.reject({ reason: 'SKU_NOT_ENOUGH' });
  }

  try {
    // decrease sku's count
    await updateSku({
      skuId,
      data: {
        count: finalCount,
      },
    });
    reservedSkus && reservedSkus.push({ skuId, count: previousCount });
    try {
      // create order item
      await createOrderItem({ count, orderId, skuId });
    } catch (e) {
      console.error(e);
      return Promise.reject({ reason: 'CREATE_ORDER_ITEM_FAILED' });
    }
  } catch (e) {
    console.error(e);
    return Promise.reject({ reason: 'SKU_DECREASE_FAILED' });
  }
}

/**
 *
 * @param {Object} cartItem
 * @param {String} orderId
 */
function createOrderItemFromCartItem(cartItem, orderId, reservedSkus) {
  return createOrderItemFromSku({ count: cartItem.count, orderId, skuId: cartItem.sku._id, reservedSkus });
}

/**
 *
 * @param {Array} cartItems
 */
function cartItemToGoodList(cartItems) {
  return cartItems.map((item) => ({
    thumb: item.sku.image,
    title: item.sku.spu.name,
    specs: item.sku.attr_value.map((v) => v.value).join('，'),
    price: item.sku.price,
    num: item.count,
  }));
}

Page({
  data: {
    loading: true,
    userAddress: null,
    goodsList: [],
    cartItems: [],
    totalSalePrice: 0,
    totalGoodsCount: 0,
    directSku: null,
    remark: '',
    remarkSourceText: '',
    remarkMaxLength: REMARK_MAX_LENGTH,
    submitting: false,
    readyToSubmit: false,
  },

  payLock: false,

  type: null,

  async onLoadFromCart(cartIds) {
    this.setData({ readyToSubmit: false });
    if (typeof cartIds !== 'string') {
      console.error('invalid cart item ids', cartIds);
      this.failedAndBack('获取点单车信息失败');
      return;
    }
    const ids = cartIds.split(',');
    try {
      const cartItems = await Promise.all(
        ids.map(async (id) => {
          const cartItem = (await getCartItem({ id })).data;
          cartItem.sku = { ...cartItem.sku, ...(await getSkuDetail(cartItem.sku._id)) };
          cartItem.sku.image = await getSingleCloudImageTempUrl(cartItem.sku.image);
          return cartItem;
        }),
      );
      const goodsList = cartItemToGoodList(cartItems);
      const totalSalePrice = goodsList.reduce((acc, cur) => acc + cur.price * cur.num, 0);
      this.setData({
        goodsList,
        readyToSubmit: true,
        totalGoodsCount: goodsList.reduce((sum, item) => sum + item.num, 0),
        totalSalePrice,
        cartItems,
      });
    } catch (e) {
      this.failedAndBack('获取点单车信息失败', e);
    }
  },
  async onLoadFromDirect(countStr, skuId) {
    this.setData({ readyToSubmit: false });
    const count = Number(countStr);
    if (!Number.isInteger(count) || count < 1 || typeof skuId !== 'string') {
      console.error('invalid cunt or skiId', count, skuId);
      this.failedAndBack('初始化信息有误');
      return;
    }

    try {
      const sku = await getSkuDetail(skuId);
      if (count > sku.count) throw new Error('超过可点数量了');
      sku.image = await getSingleCloudImageTempUrl(sku.image);

      const goodsList = [
        {
          thumb: sku.image,
          title: sku.spu.name,
          specs: sku.attr_value.map((v) => v.value).join('，'),
          price: sku.price,
          num: count,
        },
      ];

      const totalSalePrice = goodsList.reduce((acc, cur) => acc + cur.price * cur.num, 0);
      this.setData({
        goodsList,
        readyToSubmit: true,
        totalGoodsCount: goodsList.reduce((sum, item) => sum + item.num, 0),
        totalSalePrice,
        directSku: sku,
      });
    } catch (e) {
      this.failedAndBack('获取菜品信息失败', e);
    }
  },

  async onLoad(options) {
    this.type = options?.type;
    if (typeof options?.remark === 'string') {
      let remark = options.remark;
      try {
        remark = decodeURIComponent(remark);
      } catch (error) {
        console.warn('[order-confirm:invalid-remark-encoding]', error);
      }
      this.setData({ remark: sanitizeRemark(remark) });
    }
    if (options?.remarkSource === 'detail-quick') {
      this.setData({ remarkSourceText: '来自详情页备注快捷词，可继续修改' });
    }
    if (this.type === 'cart') {
      await this.onLoadFromCart(options?.cartIds);
    } else if (this.type === 'direct') {
      await this.onLoadFromDirect(options?.count, options?.skuId);
    } else {
      this.failedAndBack('初始化信息有误', 'invalid type');
    }

    this.setData({
      loading: false,
    });
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

  onRemarkChange(e) {
    const remark = sanitizeRemark(e.detail.value);
    this.setData({ remark });
  },

  async payImpl(totalPrice, orderId) {
    try {
      console.info('[order-confirm:pay:start]', { orderId, totalPrice });
      await pay({ id: orderId, totalPrice });
      try {
        await updateOrderStatus({ orderId, status: ORDER_STATUS.TO_SEND, expectedStatus: ORDER_STATUS.TO_PAY });
        console.info('[order-confirm:pay:status-updated]', { orderId, status: ORDER_STATUS.TO_SEND });
        this.toast('支付成功');
      } catch (e) {
        console.error(e);
        this.toast('支付成功，但订单状态更新失败');
      } finally {
        setTimeout(() => {
          wx.setStorageSync('orderListStatus', ORDER_STATUS.TO_SEND);
          wx.switchTab({ url: '/pages/order/order-list/index' });
        }, 1000);
      }
    } catch (e) {
      console.warn('[order-confirm:pay:failed]', { orderId, error: e });
      this.toast('支付未完成，可在订单列表继续付款');
      setTimeout(() => {
        wx.setStorageSync('orderListStatus', ORDER_STATUS.TO_PAY);
        wx.switchTab({ url: '/pages/order/order-list/index' });
      }, 1000);
    }
  },

  async submitOrderFromCart() {
    /**
     * 1.创建订单
     * 2.创建订单项
     * 3.删除购物车项
     */

    const { cartItems, userAddress, goodsList, remark } = this.data;
    let orderId;
    const reservedSkus = [];
    try {
      if (!cartItems.length) {
        this.failedAndBack('点单车为空');
        return;
      }

      console.info('[order-confirm:create:cart:start]', {
        count: cartItems.length,
        amount: cartItems.reduce((acc, cur) => acc + cur.count * cur.sku.price, 0),
        hasRemark: Boolean(sanitizeRemark(remark)),
      });
      const { id } = await createOrder({
        status: ORDER_STATUS.TO_PAY,
        addressId: userAddress?._id || '',
        remark: sanitizeRemark(remark),
      });
      orderId = id;
      console.info('[order-confirm:create:cart:order-created]', { orderId });

      for (const cartItem of cartItems) {
        await createOrderItemFromCartItem(cartItem, orderId, reservedSkus);
      }
      console.info('[order-confirm:create:cart:items-created]', { orderId });
      this.setData({ readyToSubmit: false });

      try {
        await Promise.all(cartItems.map(async (cartItem) => {
          await deleteCartItem({ cartItemId: cartItem._id });
          // any deletion should notify cart to fresh
          cartShouldFresh();
        }));
      } catch (e) {
        console.error(e);
        this.toast('清理点单车失败，请手动删除');
        // do not return, continue to pay
      }

      const totalPrice = cartItems.reduce((acc, cur) => acc + cur.count * cur.sku.price, 0);
      console.log('[order-confirm:notify:cart:start]', {
        orderId,
        goodsCount: goodsList.length,
        totalPrice,
        remark: sanitizeRemark(remark),
      });
      const notifyResult = await notifyDeveloperOrder({
        orderId,
        goodsList,
        remark: sanitizeRemark(remark),
        totalPrice,
      });
      console.log('[order-confirm:notify:cart:done]', notifyResult);
      await this.payImpl(totalPrice, orderId);
    } catch (e) {
      await rollbackReservedSkus(reservedSkus);
      await cancelIncompleteOrder(orderId);
      this.failedAndBack('创建订单失败', e);
    }
  },

  async submitOrderFromDirect() {
    /**
     * 1.创建订单
     * 2.创建订单项
     */

    const { directSku, userAddress, goodsList, remark } = this.data;
    const goods = goodsList[0];
    let orderId;
    const reservedSkus = [];
    try {
      if (!directSku || !goods) {
        this.failedAndBack('菜品信息为空');
        return;
      }

      console.info('[order-confirm:create:direct:start]', {
        skuId: directSku?._id,
        count: goods?.num,
        amount: goods ? goods.price * goods.num : 0,
        hasRemark: Boolean(sanitizeRemark(remark)),
      });
      const { id } = await createOrder({
        status: ORDER_STATUS.TO_PAY,
        addressId: userAddress?._id || '',
        remark: sanitizeRemark(remark),
      });
      orderId = id;
      console.info('[order-confirm:create:direct:order-created]', { orderId });

      await createOrderItemFromSku({ count: goods.num, orderId, skuId: directSku._id, reservedSkus });
      console.info('[order-confirm:create:direct:item-created]', { orderId });
      this.setData({ readyToSubmit: false });
      const totalPrice = goods.price * goods.num;
      console.log('[order-confirm:notify:direct:start]', {
        orderId,
        goodsCount: goodsList.length,
        totalPrice,
        remark: sanitizeRemark(remark),
      });
      const notifyResult = await notifyDeveloperOrder({
        orderId,
        goodsList,
        remark: sanitizeRemark(remark),
        totalPrice,
      });
      console.log('[order-confirm:notify:direct:done]', notifyResult);

      await this.payImpl(totalPrice, orderId);
    } catch (e) {
      await rollbackReservedSkus(reservedSkus);
      await cancelIncompleteOrder(orderId);
      this.failedAndBack('创建订单失败', e);
    }
  },

  failedAndBack(message, e) {
    e && console.error(e);
    this.toast(message);
    setTimeout(() => {
      wx.navigateBack();
    }, 1000);
  },

  // 提交订单
  async submitOrder() {
    if (!this.data.readyToSubmit) {
      this.toast('菜品信息还没准备好，请返回重试');
      return;
    }
    if (this.payLock || this.data.submitting) {
      console.info('[order-confirm:submit:skip-duplicate]');
      return;
    }

    this.payLock = true;
    this.setData({ submitting: true });

    try {
      if (this.type === 'cart') {
        await this.submitOrderFromCart();
      } else if (this.type === 'direct') {
        await this.submitOrderFromDirect();
      } else {
        console.error('invalid type', this.type);
        this.failedAndBack('初始化信息有误');
      }
    } finally {
      this.payLock = false;
      this.setData({ submitting: false });
    }
  },
});
