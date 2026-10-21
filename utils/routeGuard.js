const TAB_ROUTES = [
  '/pages/home/home',
  '/pages/goods/category/index',
  '/pages/cart/index',
  '/pages/order/order-list/index',
  '/pages/usercenter/index',
];

export const PHASE_2_ALLOWED_ROUTES = [
  ...TAB_ROUTES,
  '/pages/usercenter/person-info/index',
  '/pages/usercenter/address/list/index',
  '/pages/usercenter/address/edit/index',
  '/pages/goods/list/index',
  '/pages/goods/details/index',
  '/pages/goods/search/index',
  '/pages/goods/result/index',
  '/pages/order/order-confirm/index',
  '/pages/order/pay-result/index',
  '/pages/order/order-detail/index',
];

export function redirectUnavailableFeature(featureName, redirectUrl = '/pages/home/home') {
  console.info('[phase-2-unavailable-route]', featureName);
  wx.showToast({
    title: '该功能暂未开放',
    icon: 'none',
    duration: 1200,
  });
  setTimeout(() => {
    if (TAB_ROUTES.includes(redirectUrl)) {
      wx.switchTab({ url: redirectUrl });
      return;
    }
    wx.redirectTo({ url: redirectUrl });
  }, 300);
  return true;
}
