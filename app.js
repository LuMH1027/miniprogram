import updateManager from './common/updateManager';
import { init } from '@cloudbase/wx-cloud-client-sdk';

const CLOUD_ENV_ID = 'cloud1-d0gru9zol585a4f55';

console.log('[app:cloud:init:start]', { env: CLOUD_ENV_ID });
wx.cloud.init({
  env: CLOUD_ENV_ID,
});
console.log('[app:cloud:init:done]', { env: CLOUD_ENV_ID });

const client = init(wx.cloud);
const models = client.models;
globalThis.dataModel = models;
// 接下来就可以调用 models 上的数据模型增删改查等方法了

App({
  onLaunch: function () {},
  onShow: function () {
    updateManager();
  },
});
