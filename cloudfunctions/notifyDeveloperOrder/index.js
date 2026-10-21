const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const FALLBACK_FEISHU_WEBHOOK_URL = 'https://open.feishu.cn/open-apis/bot/v2/hook/7837c823-ce56-4cc3-b57d-bea423c37fc3';

function yuan(price = 0) {
  return (Number(price || 0) / 100).toFixed(2);
}

function buildOrderText({ orderId, goodsList = [], remark = '', totalPrice = 0, openid = '' }) {
  console.log('[notifyDeveloperOrder:build-text:start]', {
    orderId,
    goodsCount: goodsList.length,
    hasRemark: Boolean(remark),
    totalPrice,
    openid,
  });

  const goodsText = goodsList.length
    ? goodsList.map((item, index) => `${index + 1}. ${item.title || '未命名'} x${item.num || 1}  ￥${yuan(item.price)}`).join('\n')
    : '无商品明细';

  const text = [
    '你收到一份新的点单',
    '',
    `订单号：${orderId || '暂无'}`,
    `下单人 openid：${openid || '未知'}`,
    `备注：${remark || '无备注'}`,
    `总价：￥${yuan(totalPrice)}`,
    '',
    '商品：',
    goodsText,
  ].join('\n');

  console.log('[notifyDeveloperOrder:build-text:done]', text);
  return text;
}

function buildWebhookPayload(text, type) {
  console.log('[notifyDeveloperOrder:build-payload:start]', { type, textLength: text.length });

  if (type === 'feishu') {
    const payload = {
      msg_type: 'text',
      content: { text },
    };
    console.log('[notifyDeveloperOrder:build-payload:feishu]', payload);
    return payload;
  }

  if (type === 'serverchan') {
    const payload = {
      title: '新的小程序点单',
      desp: text,
    };
    console.log('[notifyDeveloperOrder:build-payload:serverchan]', payload);
    return payload;
  }

  const payload = {
    msgtype: 'text',
    text: { content: text },
  };
  console.log('[notifyDeveloperOrder:build-payload:wecom]', payload);
  return payload;
}

async function postJson(url, data) {
  const body = JSON.stringify(data);
  console.log('[notifyDeveloperOrder:webhook:request:start]', {
    urlHost: (() => {
      try {
        return new URL(url).host;
      } catch (e) {
        return 'invalid-url';
      }
    })(),
    bodyLength: body.length,
    body,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
      },
      (res) => {
        console.log('[notifyDeveloperOrder:webhook:response:headers]', {
          statusCode: res.statusCode,
          headers: res.headers,
        });

        let response = '';
        res.on('data', (chunk) => {
          response += chunk;
          console.log('[notifyDeveloperOrder:webhook:response:chunk]', String(chunk));
        });
        res.on('end', () => {
          console.log('[notifyDeveloperOrder:webhook:response:end]', {
            statusCode: res.statusCode,
            response,
          });
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Webhook failed: ${res.statusCode} ${response}`));
            return;
          }
          resolve(response);
        });
      },
    );

    req.on('error', (error) => {
      console.error('[notifyDeveloperOrder:webhook:request:error]', error);
      reject(error);
    });

    req.write(body);
    req.end();
    console.log('[notifyDeveloperOrder:webhook:request:sent]');
  });
}

exports.main = async (event) => {
  console.log('[notifyDeveloperOrder:main:start]', event);

  const wxContext = cloud.getWXContext();
  console.log('[notifyDeveloperOrder:main:wx-context]', wxContext);

  const webhookUrl = process.env.ORDER_NOTIFY_WEBHOOK_URL || FALLBACK_FEISHU_WEBHOOK_URL;
  const webhookType = process.env.ORDER_NOTIFY_WEBHOOK_TYPE || 'feishu';
  console.log('[notifyDeveloperOrder:main:config]', {
    hasEnvWebhookUrl: Boolean(process.env.ORDER_NOTIFY_WEBHOOK_URL),
    hasFallbackWebhookUrl: Boolean(FALLBACK_FEISHU_WEBHOOK_URL),
    webhookType,
    webhookHost: (() => {
      try {
        return new URL(webhookUrl).host;
      } catch (e) {
        return 'invalid-url';
      }
    })(),
  });

  const text = buildOrderText({
    orderId: event.orderId,
    goodsList: event.goodsList,
    remark: event.remark,
    totalPrice: event.totalPrice,
    openid: wxContext.OPENID,
  });

  if (!webhookUrl) {
    console.warn('[notifyDeveloperOrder:main:no-webhook-url]');
    return {
      sent: false,
      reason: 'ORDER_NOTIFY_WEBHOOK_URL is not configured',
      text,
    };
  }

  try {
    const payload = buildWebhookPayload(text, webhookType);
    const result = await postJson(webhookUrl, payload);
    console.log('[notifyDeveloperOrder:main:success]', result);
    return { sent: true, result };
  } catch (error) {
    console.error('[notifyDeveloperOrder:main:failed]', error);
    return {
      sent: false,
      errorMessage: error?.message || String(error),
      text,
    };
  }
};
