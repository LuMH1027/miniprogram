const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRuntime } = require('./helpers/miniprogram.cjs');
const root = path.resolve(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json')));
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
const ownFiles = ['pages', 'components', 'services', 'model', 'utils', 'common', 'custom-tab-bar']
  .flatMap(dir => files(path.join(root, dir)));

test('registered pages, tab bar and development shortcuts all resolve', () => {
  const registered = new Set(app.pages);
  for (const page of registered) {
    for (const ext of ['.js', '.json', '.wxml', '.wxss']) {
      assert(fs.existsSync(path.join(root, page + ext)), page + ext);
    }
  }
  for (const entry of app.tabBar.list) assert(registered.has(entry.pagePath), entry.pagePath);
  const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json')));
  for (const entry of project.condition?.miniprogram?.list || []) {
    assert(registered.has(entry.pathName), entry.pathName);
  }
  for (const file of ownFiles.filter(f => f.endsWith('.js'))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\/pages\/[\w/-]+/g)) {
      assert(registered.has(match[0].slice(1)), `${file}: ${match[0]}`);
    }
  }
});

test('local imports, templates, styles and component registrations have no deleted targets', () => {
  for (const file of ownFiles) {
    const ext = path.extname(file);
    if (!['.js', '.json', '.wxml', '.wxss', '.wxs'].includes(ext)) continue;
    const source = fs.readFileSync(file, 'utf8');
    let refs = [];
    if (['.js', '.wxs'].includes(ext)) {
      refs = [...source.matchAll(/(?:\bfrom\s*|\brequire\(\s*|\bimport\s*)['"]([^'"]+)['"]/g)]
        .map(m => m[1]).filter(ref => ref.startsWith('.'));
    } else if (ext === '.wxss') {
      refs = [...source.matchAll(/@import\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
    } else if (ext === '.wxml') {
      refs = [...source.matchAll(/<(?:wxs|import|include)\b[^>]*\bsrc=['"]([^'"]+)/g)].map(m => m[1]);
    } else {
      const components = JSON.parse(source).usingComponents || {};
      const markup = fs.readFileSync(file.replace(/\.json$/, '.wxml'), 'utf8');
      for (const [tag, ref] of Object.entries(components)) {
        assert(markup.includes(`<${tag}`), `${file}: unused component ${tag}`);
        const base = ref.startsWith('/') ? path.join(root, ref.slice(1)) : ref.startsWith('.')
          ? path.resolve(path.dirname(file), ref) : path.join(root, 'miniprogram_npm', ref);
        for (const suffix of ['.js', '.json', '.wxml', '.wxss']) {
          assert(fs.existsSync(base + suffix), `${file}: ${ref}${suffix}`);
        }
      }
    }
    for (const ref of refs) {
      let target = ref.startsWith('/') ? path.join(root, ref.slice(1)) : path.resolve(path.dirname(file), ref);
      if (!path.extname(target)) target += '.js';
      assert(fs.existsSync(target), `${file}: ${ref}`);
    }
  }
});

test('unused image, album, file and location APIs are absent from application source', () => {
  for (const file of ownFiles.filter(f => /\.(js|json)$/.test(f))) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /wx\.(?:chooseImage|chooseMedia|chooseMessageFile|setClipboardData|getClipboardData|saveImageToPhotosAlbum|getLocation|chooseAddress)\b|tdesign-miniprogram\/upload\//, file);
  }
});

test('retained address service can create, update, list and delete an address', async () => {
  const r = createRuntime();
  const service = r.load('services/address/address.js');
  const before = (await service.getAllAddress()).length;
  await service.createAddress({ name: '测试', address: '测试地址', phone: '13800000000' });
  let items = await service.getAllAddress();
  assert.equal(items.length, before + 1);
  const created = items.at(-1);
  await service.updateAddress({ ...created, address: '修改后的地址' });
  items = await service.getAllAddress();
  assert.equal(items.find(i => i._id === created._id).address, '修改后的地址');
  await service.deleteAddress({ id: created._id });
  assert.equal((await service.getAllAddress()).length, before);
});
