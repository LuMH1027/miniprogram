const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');

// Loads the real mini-program modules in isolated memory. No network or user storage.
function createRuntime() {
  const cache = new Map();
  const overrides = new Map();
  const storage = new Map();
  const messages = [];
  const navigation = [];
  const notifications = [];
  const timers = new Map();
  let nextTimer = 1;
  const wx = {
    getStorageSync: key => structuredClone(storage.get(key)),
    setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
    removeStorageSync: key => storage.delete(key),
    navigateTo: data => navigation.push(data.url),
    switchTab: data => navigation.push(data.url),
    navigateBack() {}, stopPullDownRefresh() {}, pageScrollTo() {}, setNavigationBarTitle() {},
    showToast: data => messages.push(data.title),
    cloud: {
      async callFunction(args) {
        if (args.name !== 'notifyDeveloperOrder') throw new Error(`Unexpected cloud call: ${args.name}`);
        notifications.push(structuredClone(args.data));
        return { result: { sent: true } };
      },
      getTempFileURL() { throw new Error('Unexpected image network request'); },
    },
    requestPayment() { throw new Error('Real payments are forbidden in tests'); },
  };
  const setTimer = fn => { const id = nextTimer++; timers.set(id, fn); return id; };
  function load(relative, from = root + '/entry.js') {
    if (!relative.startsWith('.') && !path.isAbsolute(relative)) {
      if (relative === 'tdesign-miniprogram/toast/index') return args => messages.push(args.message);
      if (relative === 'tdesign-miniprogram/dialog/index') return { confirm: async () => {} };
      if (relative === 'dayjs') return () => ({ format() { throw new Error('Date formatter is outside this test'); } });
      throw new Error(`Unmocked dependency: ${relative}`);
    }
    let filename = path.resolve(path.dirname(from), relative);
    if (!path.extname(filename)) filename += '.js';
    if (overrides.has(filename)) return overrides.get(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const record = { exports: {}, definition: null };
    cache.set(filename, record);
    let source = fs.readFileSync(filename, 'utf8');
    const names = [...source.matchAll(/export\s+(?:async\s+)?(?:const|let|function|class)\s+(\w+)/g)].map(x => x[1]);
    source = source.replace(/^import\s+([^;\n]+?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm, (_, bindings, target) => {
      const rhs = `__import(${JSON.stringify(target)})`;
      if (bindings.startsWith('{')) return `const ${bindings.replace(/\s+as\s+/g, ': ')} = ${rhs};`;
      return `const ${bindings} = ${rhs};`;
    }).replace(/\bexport\s+(?=(?:async\s+)?(?:const|let|function|class))/g, '');
    const context = {
      console: { log() {}, info() {}, warn() {}, error() {} }, wx,
      setTimeout: setTimer, clearTimeout: id => timers.delete(id),
      Page: def => { record.definition = def; }, Component: def => { record.definition = def; },
      module: record, exports: record.exports,
      __import: target => load(target, filename),
      require: target => load(target, filename),
    };
    vm.runInNewContext(source + '\n' + names.map(name => `Object.defineProperty(module.exports, '${name}', { enumerable: true, get: () => ${name} });`).join('\n'), context, { filename });
    return record.exports;
  }
  function instance(file, properties = {}) {
    load('./' + file);
    const def = cache.get(path.join(root, file)).definition;
    const obj = {
      ...def, ...def.methods,
      data: { ...structuredClone(def.data || {}), ...properties }, properties,
      events: [],
      getTabBar: () => ({ init() {} }),
      triggerEvent(name, detail) { this.events.push({ name, detail }); },
      setData(patch, cb) {
        for (const [key, value] of Object.entries(patch)) {
          const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.');
          let target = this.data;
          for (const part of parts.slice(0, -1)) target = target[part];
          target[parts.at(-1)] = value;
        }
        for (const [watch, observer] of Object.entries(def.observers || {})) {
          const keys = watch.split(',').map(key => key.trim());
          if (keys.some(key => Object.keys(patch).some(changed => changed.split(/[.\[]/)[0] === key))) {
            observer.call(this, ...keys.map(key => this.data[key]));
          }
        }
        if (cb) cb();
      },
      setProperty(name, value) {
        this.properties[name] = value;
        this.setData({ [name]: value });
        def.properties?.[name]?.observer?.call(this, value);
      },
    };
    return obj;
  }
  return {
    load: file => load(file.startsWith('.') ? file : './' + file), instance,
    override: (file, value) => overrides.set(path.join(root, file), value),
    wx, storage, messages, navigation, notifications, timers,
    async runTimers() { const pending = [...timers.values()]; timers.clear(); for (const fn of pending) await fn(); },
  };
}
module.exports = { createRuntime };
