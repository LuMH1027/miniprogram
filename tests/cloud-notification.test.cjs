const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

function cloudRuntime(env = {}, localUrls = [], responses = []) {
  const requests = [];
  const context = {
    exports: {}, process: { env }, URL, Buffer,
    console: { log() {}, warn() {}, error() {} },
    require(name) {
      if (name === 'wx-server-sdk') return { init() {}, DYNAMIC_CURRENT_ENV: 'test', getWXContext: () => ({ OPENID: 'test' }) };
      if (name === './webhooks.local.json') {
        if (localUrls === null) { const error = new Error('missing local config'); error.code = 'MODULE_NOT_FOUND'; throw error; }
        return { urls: localUrls };
      }
      if (name === 'https') return {
        request(url, options, callback) {
          const index = requests.length;
          const req = new EventEmitter();
          req.setTimeout = () => {};
          req.write = body => requests.push({ url, body: JSON.parse(body) });
          req.end = () => queueMicrotask(() => {
            const response = responses[index] || { code: 0 };
            if (response instanceof Error) { req.emit('error', response); return; }
            const res = new EventEmitter();
            res.statusCode = 200; res.headers = {};
            callback(res);
            res.emit('data', JSON.stringify(response));
            res.emit('end');
          });
          return req;
        },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  };
  const filename = path.join(__dirname, '../cloudfunctions/notifyDeveloperOrder/index.js');
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return { main: context.exports.main, requests };
}
const order = { orderId: 'test-order', goodsList: [{ title: 'test', num: 2, price: 52 }], totalPrice: 104 };

test('cloud function sends to every unique configured group and preserves amount units', async () => {
  const r = cloudRuntime({ ORDER_NOTIFY_WEBHOOK_URLS: 'https://example.com/a,https://example.com/b https://example.com/a' });
  const result = await r.main(order);
  assert.equal(result.sentCount, 2);
  assert.equal(r.requests.length, 2);
  assert(r.requests[0].body.content.text.includes('￥1.04'));
});

test('environment configuration overrides deployment-local fallback and supports legacy variable', async () => {
  const r = cloudRuntime({ ORDER_NOTIFY_WEBHOOK_URL: 'https://example.com/legacy' }, ['https://example.com/local']);
  await r.main(order);
  assert.equal(r.requests.length, 1);
  assert.equal(r.requests[0].url, 'https://example.com/legacy');
});

test('deployment-local config works and absent config sends no notification', async () => {
  const local = cloudRuntime({}, ['https://example.com/a', 'https://example.com/b']);
  assert.equal((await local.main(order)).sentCount, 2);
  const empty = cloudRuntime({}, null);
  assert.equal((await empty.main(order)).sent, false);
  assert.equal(empty.requests.length, 0);
});

test('one failed group does not block other groups and does not expose its URL', async () => {
  const url = 'https://example.com/private';
  const r = cloudRuntime({ ORDER_NOTIFY_WEBHOOK_URLS: `${url},https://example.com/ok` }, [], [new Error(`request failed ${url}`), { code: 0 }]);
  const result = await r.main(order);
  assert.equal(result.partial, true);
  assert.equal(result.sentCount, 1);
  assert.equal(result.failedCount, 1);
  assert(!result.results[0].errorMessage.includes(url));
  const business = cloudRuntime({ ORDER_NOTIFY_WEBHOOK_URL: 'https://example.com/business' }, [], [{ code: 100, msg: 'failed' }]);
  assert.equal((await business.main(order)).failedCount, 1);
});
