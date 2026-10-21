import Dialog from 'tdesign-miniprogram/dialog/index';
import { fetchCartGroupData, fetchCartItems, deleteCartItem, updateCartItemCount } from '../../services/cart/cart';
import { getSkuDetail } from '../../services/sku/sku';
import { objectToParamString } from '../../utils/util';
import { getSingleCloudImageTempUrl } from '../../utils/cloudImageHandler';

const REMARK_MAX_LENGTH = 120;

function sanitizeRemark(value = '') {
  return String(value)
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, REMARK_MAX_LENGTH)
    .trim();
}

Component({
  data: {
    cartGroupData: null,
    cartItems: [],
    selectedCartItemNum: 0,
    allSelected: false,
    totalAmount: 0,
    loading: false,
    inited: false,
    remark: '',
    remarkMaxLength: REMARK_MAX_LENGTH,
  },

  observers: {
    cartItems: function (cartItems) {
      const selectedCartItems = cartItems.filter((x) => x.selected === true);
      const selectedCartItemNum = selectedCartItems.reduce((sum, item) => sum + item.count, 0);
      const totalAmount = selectedCartItems.reduce((acc, cur) => acc + cur.count * cur.sku.price, 0);
      const allSelected = cartItems.length > 0 && selectedCartItems.length === cartItems.length;

      this.setData({
        selectedCartItemNum,
        allSelected,
        totalAmount,
      });
    },
  },

  lifetimes: {
    attached: async function () {
      // console.log('called attached');
      // // 调用自定义tabbar的init函数，使页面与tabbar激活状态保持一致
      // this.getTabBar().init();
      // await this.setLoading();
      // await this.setDataPromise({ inited: true });
      // try {
      //   await this.init();
      // } finally {
      //   await this.unsetLoading();
      // }
    },
  },

  pageLifetimes: {
    show: async function () {
      // 调用自定义tabbar的init函数，使页面与tabbar激活状态保持一致
      this.getTabBar().init();

      await this.setLoading();
      try {
        await this.init();
      } finally {
        await this.unsetLoading();
      }
    },
  },

  methods: {
    async init() {
      if (this._cartSave) await this._cartSave;
      this._quantityErrors = new Set();
      const previousSelection = new Map(this.data.cartItems.map((item) => [item._id, item.selected]));
      const cartItems = (await fetchCartItems()).map((x) =>
        Object.assign(x, {
          selected: previousSelection.has(x._id) ? previousSelection.get(x._id) : true,
        }),
      );
      await Promise.all(
        cartItems.map(async (cartItem) => {
          const skuId = cartItem.sku._id;
          const sku = await getSkuDetail(skuId);
          if (sku.image) {
            sku.image = await getSingleCloudImageTempUrl(sku.image);
          }
          cartItem.sku = sku;
        }),
      );
      await this.setDataPromise({
        cartItems,
      });
    },

    findGoods(spuId, skuId) {
      let currentStore;
      let currentActivity;
      let currentGoods;
      const { storeGoods } = this.data.cartGroupData;
      for (const store of storeGoods) {
        for (const activity of store.promotionGoodsList) {
          for (const goods of activity.goodsPromotionList) {
            if (goods.spuId === spuId && goods.skuId === skuId) {
              currentStore = store;
              currentActivity = currentActivity;
              currentGoods = goods;
              return {
                currentStore,
                currentActivity,
                currentGoods,
              };
            }
          }
        }
      }
      return {
        currentStore,
        currentActivity,
        currentGoods,
      };
    },

    // 注：实际场景时应该调用接口获取购物车数据
    getCartGroupData() {
      const { cartGroupData } = this.data;
      if (!cartGroupData) {
        return fetchCartGroupData();
      }
      return Promise.resolve({ data: cartGroupData });
    },

    // 选择单个菜品
    // 注：实际场景时应该调用接口更改选中状态
    selectGoodsService({ spuId, skuId, isSelected }) {
      this.findGoods(spuId, skuId).currentGoods.isSelected = isSelected;
      return Promise.resolve();
    },

    // 全选门店
    // 注：实际场景时应该调用接口更改选中状态
    selectStoreService({ storeId, isSelected }) {
      const currentStore = this.data.cartGroupData.storeGoods.find((s) => s.storeId === storeId);
      currentStore.isSelected = isSelected;
      currentStore.promotionGoodsList.forEach((activity) => {
        activity.goodsPromotionList.forEach((goods) => {
          goods.isSelected = isSelected;
        });
      });
      return Promise.resolve();
    },

    // 点单数量变更
    // 注：实际场景时应该调用接口
    changeQuantityService({ spuId, skuId, quantity }) {
      this.findGoods(spuId, skuId).currentGoods.quantity = quantity;
      return Promise.resolve();
    },

    // 删除点单菜品
    // 注：实际场景时应该调用接口
    deleteGoodsService({ spuId, skuId }) {
      function deleteGoods(group) {
        for (const gindex in group) {
          const goods = group[gindex];
          if (goods.spuId === spuId && goods.skuId === skuId) {
            group.splice(gindex, 1);
            return gindex;
          }
        }
        return -1;
      }
      const { storeGoods, invalidGoodItems } = this.data.cartGroupData;
      for (const store of storeGoods) {
        for (const activity of store.promotionGoodsList) {
          if (deleteGoods(activity.goodsPromotionList) > -1) {
            return Promise.resolve();
          }
        }
        if (deleteGoods(store.shortageGoodsList) > -1) {
          return Promise.resolve();
        }
      }
      if (deleteGoods(invalidGoodItems) > -1) {
        return Promise.resolve();
      }
      return Promise.reject();
    },

    onGoodsSelect({ detail: { goods } }) {
      const { cartItems } = this.data;
      const item = cartItems.find((x) => x._id === goods._id);

      if (item == null) {
        console.warn('Cart item not found!');
        return;
      }

      item.selected = !item.selected;
      this.setData({ cartItems });
    },

    onQuantityChange({ detail: { cartItemId, count } }) {
      if (this.data.loading) return;
      const { cartItems } = this.data;
      const item = cartItems.find((x) => x._id === cartItemId);
      if (item == null) {
        console.warn('Cart item not found');
        return;
      }
      count = Number(count);
      if (!Number.isInteger(count) || count < 1 || count > item.sku.count) {
        wx.showToast({ title: '请输入可点范围内的整数数量', icon: 'none' });
        return;
      }
      item.count = count;
      this.setData({ cartItems });
      this.debouncedUpdateCartItemCount({ cartItemId, count });
    },

    debouncedUpdateCartItemCount({ cartItemId, count }) {
      // Serialize writes so changes to different items and rapid taps are all saved.
      this._quantityErrors = this._quantityErrors || new Set();
      this._cartSave = (this._cartSave || Promise.resolve()).then(async () => {
        try {
          await updateCartItemCount({ cartItemId, count });
          this._quantityErrors.delete(cartItemId);
        } catch (error) {
          console.error('[cart:save-quantity:failed]', error);
          this._quantityErrors.add(cartItemId);
          wx.showToast({ title: '数量保存失败，请重新调整后再试', icon: 'none' });
        }
      });
      return this._cartSave;
    },

    goCollect() {
      console.info('[phase-2-hidden-entry]', 'cart-promotion');
    },

    goGoodsDetail({
      detail: {
        goods: {
          sku: {
            spu: { _id },
          },
        },
      },
    }) {
      wx.navigateTo({
        url: `/pages/goods/details/index?spuId=${_id}`,
      });
    },

    async onGoodsDelete({
      detail: {
        goods: { _id },
      },
    }) {
      try {
        await Dialog.confirm({
          context: this,
          closeOnOverlayClick: true,
          title: '确认删除该菜品吗?',
          confirmBtn: '确定',
          cancelBtn: '取消',
        });
        this.setLoading();
        try {
          if (this._cartSave) await this._cartSave;
          await deleteCartItem({ cartItemId: _id });
          this._quantityErrors?.delete(_id);
          const { cartItems } = this.data;
          this.setData({
            cartItems: cartItems.filter((x) => x._id !== _id),
          });
        } finally {
          this.unsetLoading();
        }
      } catch {
        console.warn('deletion is cancelled');
      }
    },

    onSelectAll() {
      const { cartItems, allSelected } = this.data;
      cartItems.forEach((x) => (x.selected = !allSelected));
      this.setData({ cartItems });
    },

    async onToSettle() {
      if (this.data.loading) return;
      const selectedCartIds = this.data.cartItems
        .filter((item) => item.selected)
        .map((x) => x._id);
      if (!selectedCartIds.length) {
        wx.showToast({
          title: '先勾选想点的菜品',
          icon: 'none',
        });
        return;
      }

      await this.setLoading();
      try {
        if (this._cartSave) await this._cartSave;
        if (this._quantityErrors?.size) {
          wx.showToast({ title: '数量未保存成功，请重新调整后再试', icon: 'none' });
          return;
        }
        wx.navigateTo({
          url: `/pages/order/order-confirm/index?${objectToParamString({
            type: 'cart',
            cartIds: selectedCartIds.join(','),
            remark: encodeURIComponent(sanitizeRemark(this.data.remark)),
          })}`,
        });
      } finally {
        await this.unsetLoading();
      }
    },

    onRemarkChange(e) {
      const value = e?.detail?.value || '';
      this.setData({
        remark: sanitizeRemark(value),
      });
    },
    onGotoHome() {
      wx.switchTab({ url: '/pages/home/home' });
    },

    setLoading() {
      return this.setDataPromise({
        loading: true,
      });
    },
    unsetLoading() {
      return this.setDataPromise({
        loading: false,
      });
    },
    toggleLoading() {
      this.setData({
        loading: !this.data.loading,
      });
    },

    setDataPromise(data) {
      return new Promise((res) => {
        this.setData(data, () => res());
      });
    },
  },
});
