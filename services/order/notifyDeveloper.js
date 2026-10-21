export async function notifyDeveloperOrder({ orderId, goodsList = [], remark = '', totalPrice = 0 }) {
  console.log('[notify-developer-order:miniprogram:start]', {
    orderId,
    goodsCount: goodsList.length,
    hasRemark: Boolean(remark),
    totalPrice,
  });

  if (!wx.cloud?.callFunction) {
    console.warn('[notify-developer-order:miniprogram:skip]', 'wx.cloud.callFunction is not available');
    return { skipped: true };
  }

  const payload = {
    orderId,
    remark,
    totalPrice,
    goodsList: goodsList.map((item) => ({
      title: item.title,
      num: item.num,
      price: item.price,
      specs: item.specs,
    })),
  };

  console.log('[notify-developer-order:miniprogram:payload]', payload);

  try {
    console.log('[notify-developer-order:miniprogram:call-function:start]', {
      name: 'notifyDeveloperOrder',
      mode: 'use wx.cloud.init default env',
    });
    const result = await wx.cloud.callFunction({
      name: 'notifyDeveloperOrder',
      data: payload,
    });
    console.log('[notify-developer-order:miniprogram:call-function:success:raw]', result);
    console.log('[notify-developer-order:miniprogram:call-function:success:result]', result?.result);
    return result?.result || result;
  } catch (e) {
    console.warn('[notify-developer-order:miniprogram:call-function:failed]', {
      message: e?.message,
      errCode: e?.errCode,
      errMsg: e?.errMsg,
      stack: e?.stack,
      error: e,
    });
    return { failed: true, error: e };
  }
}
