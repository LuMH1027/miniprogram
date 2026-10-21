Component({
  properties: {
    imgUrl: {
      type: String,
      value:
        'https://cdn-we-retail.ym.tencent.com/miniapp/template/empty-cart.png',
    },
    tip: {
      type: String,
      value: '还没选好？慢慢挑一份喜欢的。',
    },
    btnText: {
      type: String,
      value: '去挑好吃的',
    },
  },
  data: {},
  methods: {
    handleClick() {
      this.triggerEvent('handleClick');
    },
  },
});
