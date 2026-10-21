import Toast from 'tdesign-miniprogram/toast/index';

Component({
  isSpecsTap: false, // 标记本次点击事件是否因为点击specs触发（由于底层goods-card组件没有catch specs点击事件，只能在此处加状态来避免点击specs时触发跳转商品详情）
  externalClasses: ['wr-class'],
  properties: {
    thumbWidth: { type: null },
    thumbHeight: { type: null },
    cartItems: { type: Array },
  },

  data: {
    isShowSpecs: false,
    currentGoods: null,
  },

  methods: {
    toast(message) {
      Toast({
        context: this,
        selector: '#t-toast',
        message,
      });
    },
    // 删除商品
    deleteGoods(e) {
      const { goods } = e.currentTarget.dataset;
      this.triggerEvent('delete', { goods });
    },

    // 清空失效商品

    // 选中商品
    selectGoods(e) {
      const { goods } = e.currentTarget.dataset;
      this.triggerEvent('selectgoods', {
        goods,
      });
    },

    changeQuantity(count, cartItemId) {
      this.triggerEvent('changequantity', {
        count,
        cartItemId,
      });
    },
    changeStepper({
      detail: { value: changeToValue },
      currentTarget: {
        dataset: { goods },
      },
    }) {
      // validation is handled by this.overlimit()
      this.changeQuantity(Number(changeToValue), goods._id);
    },

    input(e) {
      const { value } = e.detail;
      const { goods } = e.currentTarget.dataset;
      const num = Number(value);
      this.changeQuantity(num, goods._id);
    },

    overlimit(e) {
      const text = e.detail.type === 'minus' ? '不能再少了' : '不能再多了';
      this.toast(text);
    },

    // 去凑单/再逛逛

    // 选中门店

    // 展开/收起切换

    // 展示规格popup
    specsTap({
      target: {
        dataset: { goods },
      },
    }) {
      this.isSpecsTap = true;
      this.setData({
        isShowSpecs: true,
        currentGoods: goods,
      });
    },

    hideSpecsPopup() {
      this.setData({
        isShowSpecs: false,
      });
    },

    goGoodsDetail(e) {
      if (this.isSpecsTap) {
        this.isSpecsTap = false;
        return;
      }
      const { goods } = e.currentTarget.dataset;
      this.triggerEvent('goodsclick', { goods });
    },

  },
});
