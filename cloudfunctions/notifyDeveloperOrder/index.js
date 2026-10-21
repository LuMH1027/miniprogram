const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// Deployment-local fallback; real webhook credentials stay out of Git.
let fallbackUrls = [];
try {
  const localConfig = require('./webhooks.local.json');
  if (Array.isArray(localConfig.urls)) fallbackUrls = localConfig.urls;
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}
const FALLBACK_FEISHU_WEBHOOK_URLS = fallbackUrls.join(',');

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
    req.setTimeout(10000, () => req.destroy(new Error('Webhook request timed out')));

    req.write(body);
    req.end();
    console.log('[notifyDeveloperOrder:webhook:request:sent]');
  });
}

exports.main = async (event) => {
  console.log('[notifyDeveloperOrder:main:start]', event);

  const wxContext = cloud.getWXContext();
  console.log('[notifyDeveloperOrder:main:wx-context]', wxContext);

  const configuredUrls = process.env.ORDER_NOTIFY_WEBHOOK_URLS || process.env.ORDER_NOTIFY_WEBHOOK_URL;
  const webhookUrls = [...new Set((configuredUrls || FALLBACK_FEISHU_WEBHOOK_URLS)
    .split(/[,\s]+/)
    .map((url) => url.trim())
    .filter(Boolean))];
  const webhookType = process.env.ORDER_NOTIFY_WEBHOOK_TYPE || 'feishu';
  console.log('[notifyDeveloperOrder:main:config]', {
    hasEnvWebhookUrl: Boolean(configuredUrls),
    hasFallbackWebhookUrl: Boolean(FALLBACK_FEISHU_WEBHOOK_URLS),
    webhookType,
    webhookCount: webhookUrls.length,
  });

  const text = buildOrderText({
    orderId: event.orderId,
    goodsList: event.goodsList,
    remark: event.remark,
    totalPrice: event.totalPrice,
    openid: wxContext.OPENID,
  });

  if (!webhookUrls.length) {
    console.warn('[notifyDeveloperOrder:main:no-webhook-url]');
    return {
      sent: false,
      reason: 'No notification webhook URL is configured',
      text,
    };
  }

  const payload = buildWebhookPayload(text, webhookType);
  const results = await Promise.all(webhookUrls.map(async (url, index) => {
    try {
      const result = await postJson(url, payload);
      if (webhookType === 'feishu') {
        const response = JSON.parse(result);
        const code = response.code ?? response.StatusCode;
        if (code === undefined || Number(code) !== 0) {
          throw new Error(`Feishu webhook failed: ${result}`);
        }
      }
      return { index, sent: true, result };
    } catch (error) {
      // Only return the index: webhook URLs contain credentials.
      const errorMessage = (error?.message || String(error)).split(url).join('[webhook]');
      console.error('[notifyDeveloperOrder:main:failed]', { index, errorMessage });
      return { index, sent: false, errorMessage };
    }
  }));
  const sentCount = results.filter((result) => result.sent).length;
  return {
    sent: sentCount === webhookUrls.length,
    partial: sentCount > 0 && sentCount < webhookUrls.length,
    sentCount,
    failedCount: webhookUrls.length - sentCount,
    results,
  };
};
