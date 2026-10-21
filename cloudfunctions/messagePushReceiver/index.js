const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function getQuery(event = {}) {
  return event.queryStringParameters || event.query || {};
}

function getBody(event = {}) {
  if (!event.body) return '';
  if (event.isBase64Encoded) return Buffer.from(event.body, 'base64').toString('utf8');
  return typeof event.body === 'string' ? event.body : JSON.stringify(event.body);
}

function checkSignature({ token, signature, timestamp, nonce }) {
  if (!token || !signature || !timestamp || !nonce) return false;
  const raw = [token, timestamp, nonce].sort().join('');
  const digest = crypto.createHash('sha1').update(raw).digest('hex');
  return digest === signature;
}

function textResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
    body,
  };
}

exports.main = async (event) => {
  const token = process.env.WECHAT_MESSAGE_PUSH_TOKEN;
  const query = getQuery(event);
  const method = event.httpMethod || event.requestContext?.httpMethod || 'POST';

  if (method === 'GET') {
    const ok = checkSignature({
      token,
      signature: query.signature,
      timestamp: query.timestamp,
      nonce: query.nonce,
    });

    return textResponse(ok ? 200 : 403, ok ? query.echostr || '' : 'invalid signature');
  }

  const body = getBody(event);
  console.log('[message-push:received]', {
    query,
    body,
  });

  return textResponse(200, 'success');
};
