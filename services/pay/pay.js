import { cloudbaseTemplateConfig } from '../../config/index';

/**
 *
 * @param {{id: String, totalPrice: Number}} order
 * @returns
 */
export async function pay(order) {
  if (cloudbaseTemplateConfig.useMock) {
    console.info('[pay:mock]', { orderId: order.id, totalPrice: order.totalPrice });
    return;
  }

  try {
    console.info('[pay:start]', { orderId: order.id, totalPrice: order.totalPrice });
    const res = await wx.cloud.callFunction({
      // 云函数名称
      name: 'shop_pay',
      data: {
        orderId: order.id
      },
    });
    const paymentData = res.result?.data;
    if (!paymentData) {
      return Promise.reject({ reason: 'PAYMENT_DATA_EMPTY', res });
    }
    // 唤起微信支付组件，完成支付
    try {
      await wx.requestPayment({
        timeStamp: paymentData?.timeStamp,
        nonceStr: paymentData?.nonceStr,
        package: paymentData?.packageVal,
        paySign: paymentData?.paySign,
        signType: 'RSA', // 该参数为固定值
      });
      console.info('[pay:success]', { orderId: order.id });
    } catch (e) {
      console.warn('[pay:requestPayment:failed]', { orderId: order.id, error: e });
      return Promise.reject(e);
    }
  } catch (e) {
    console.warn('[pay:failed]', { orderId: order.id, error: e });
    return Promise.reject(e);
  }
}

export async function refund(orderId) {
  if (cloudbaseTemplateConfig.useMock) {
    console.info('[refund:mock]', { orderId });
    return;
  }

  const res = await wx.cloud.callFunction({
    // 云函数名称
    name: 'shop_refund',
    data: {
      orderId,
    },
  });
  if (!res?.result?.data) {
    throw new Error("refund failed", res);
  }
  return res;
}
