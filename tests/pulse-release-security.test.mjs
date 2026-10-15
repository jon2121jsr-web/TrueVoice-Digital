import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import serialize from 'serialize-javascript';

test('web release excludes the unrelated upload endpoint, UI and storage grant', () => {
  for (const file of ['api/drop-upload.js', 'src/pages/DropPortal.jsx', 'src/pages/DropPortal.css',
    'DROP_PORTAL_SETUP.md', 'supabase/migrations/20260920140000_drop_uploads_storage_bucket.sql']) {
    assert.equal(fs.existsSync(file), false, file);
  }
});

test('normal release lock excludes optional generator and retains supported Capacitor build tools', () => {
  const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  assert.equal(manifest.workspaces, undefined);
  assert.equal(manifest.overrides, undefined);
  assert.equal(manifest.devDependencies['@capacitor/assets'], undefined);
  for (const [location, entry] of Object.entries(lock.packages)) {
    assert.ok(!/(?:^|\/)node_modules\/(?:@capacitor\/assets|sharp|xcode|@trapezedev\/project)$/.test(location), location);
    if (location.endsWith('/node_modules/tar') || location === 'node_modules/tar') {
      assert.equal(entry.version, '7.5.22', location);
    }
  }
  for (const name of ['cli', 'core', 'ios', 'android']) {
    assert.equal(lock.packages[`node_modules/@capacitor/${name}`].version, '7.6.9');
  }
  assert.ok(!JSON.stringify(manifest.scripts).includes('native-assets'));
  assert.ok(!fs.readFileSync('codemagic.yaml', 'utf8').includes('native-assets'));
});

test('optional generator has a separate exact-version lock and records its unresolved risk', () => {
  const manifest = JSON.parse(fs.readFileSync('tools/native-assets/package.json', 'utf8'));
  const lock = JSON.parse(fs.readFileSync('tools/native-assets/package-lock.json', 'utf8'));
  assert.equal(manifest.private, true);
  assert.deepEqual(manifest.dependencies, { '@capacitor/assets': '3.0.5' });
  assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies);
  for (const [name, version] of Object.entries({
    '@capacitor/assets': '3.0.5', sharp: '0.32.6', '@capacitor/assets/node_modules/@capacitor/cli': '5.7.8',
    '@capacitor/assets/node_modules/tar': '6.2.1', xcode: '3.0.1', 'xcode/node_modules/uuid': '7.0.3',
  })) assert.equal(lock.packages[`node_modules/${name}`].version, version);
  const instructions = fs.readFileSync('tools/native-assets/README.md', 'utf8');
  assert.ok(instructions.includes('--ios --android'));
  assert.ok(instructions.includes('remain vulnerable'));
});

// Execute the generated worker's declarations. These checks verify generated
// routing/caching policy, not browser CacheStorage, network or iOS lifecycle.
function generatedPolicy(filename = 'dist/sw.js') {
  const state = { routes: [], precache: [], skipWaiting: 0, clientsClaim: 0, cleanup: 0, modules: [] };
  const strategy = kind => class { constructor(options = {}) { this.kind = kind; this.options = options; } };
  const workbox = {
    NetworkFirst: strategy('NetworkFirst'), NetworkOnly: strategy('NetworkOnly'),
    CacheFirst: strategy('CacheFirst'), StaleWhileRevalidate: strategy('StaleWhileRevalidate'),
    ExpirationPlugin: class { constructor(options) { this.options = options; } },
    NavigationRoute: class { constructor(handler, options) { this.handler = handler; this.options = options; } },
    clientsClaim: () => state.clientsClaim++, cleanupOutdatedCaches: () => state.cleanup++,
    precacheAndRoute: entries => { state.precache = entries; },
    createHandlerBoundToURL: url => url,
    registerRoute: (match, handler, method) => state.routes.push({ match, handler, method }),
  };
  const define = (modules, callback) => { state.modules = modules; callback(workbox); };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { self: { define, skipWaiting: () => state.skipWaiting++ }, define });
  return state;
}

test('patched serializer sanitizes malicious RegExp flags and rejects spoofed Date output', () => {
  const regex = /safe/g;
  Object.defineProperty(regex, 'flags', { value: 'g"+(globalThis.PULSE_INJECTED=true)+"' });
  const date = new Date('2026-01-01T00:00:00Z');
  date.toISOString = () => '"+(globalThis.PULSE_INJECTED=true)+"';
  const context = { PULSE_INJECTED: false };
  assert.throws(() => serialize({ date }), TypeError);
  const encoded = serialize({ regex });
  assert.ok(!encoded.includes('PULSE_INJECTED'));
  // Sanitization may leave duplicate valid flag letters, which RegExp rejects.
  try { vm.runInNewContext(`(${encoded})`, context); }
  catch (error) { assert.equal(error.name, 'SyntaxError'); }
  assert.equal(context.PULSE_INJECTED, false);
  const result = vm.runInNewContext(`(${serialize({ regex: /safe/g, date: new Date('2026-01-01T00:00:00Z') })})`);
  assert.equal(result.regex.source, 'safe');
  assert.equal(result.regex.flags, 'g');
  assert.equal(result.date.toISOString(), '2026-01-01T00:00:00.000Z');
});

test('patched serializer bounds crafted array-like input in an isolated process', () => {
  // A regression must fail within the child deadline rather than hang the runner.
  const script = `import serialize from 'serialize-javascript';
    const value = Object.create(Array.prototype);
    value.length = 1000000000;
    const output = serialize(value);
    if (output.length > 200) throw new Error('Unbounded array-like serialization');
    process.stdout.write('bounded');`;
  assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', script], { timeout: 3000, encoding: 'utf8' }), 'bounded');
});

test('generated PWA retains activation, complete precache and real bridge navigation', () => {
  const policy = generatedPolicy();
  assert.equal(policy.skipWaiting, 1);
  assert.equal(policy.clientsClaim, 1);
  assert.equal(policy.cleanup, 1);
  assert.equal(policy.modules.length, 1);
  assert.ok(fs.existsSync(path.join('dist', `${policy.modules[0]}.js`)));
  const urls = policy.precache.map(item => item.url);
  assert.equal(new Set(urls).size, urls.length);
  for (const url of urls) assert.ok(fs.existsSync(path.join('dist', url)), `Missing precache asset ${url}`);
  for (const url of ['index.html', 'yt-embed.html', 'manifest.webmanifest', 'registerSW.js', 'icon-192.png', 'icon-512.png']) assert.ok(urls.includes(url));
  const navigation = policy.routes[0].match;
  assert.equal(navigation.handler, '/index.html');
  assert.ok(navigation.options.denylist.some(pattern => pattern.test('/yt-embed.html?v=fixture')));
  assert.ok(navigation.options.denylist.some(pattern => pattern.test('/api/youtube')));
  assert.ok(!navigation.options.denylist.some(pattern => pattern.test('/explore')));
  assert.equal(fs.readFileSync('dist/yt-embed.html', 'utf8'), fs.readFileSync('public/yt-embed.html', 'utf8'));
  assert.ok(fs.readFileSync('dist/registerSW.js', 'utf8').includes('serviceWorker.register'));
});

test('generated worker preserves LIVE365 network-only and metadata/font/image caching policies', () => {
  const routes = generatedPolicy().routes.slice(1);
  const find = url => routes.find(route => route.match.test(url));
  const live = find('https://streaming.live365.com/a61535');
  assert.equal(live.handler.kind, 'NetworkOnly');
  assert.equal(live.method, 'GET');
  assert.equal(live.handler.options.cacheName, undefined);
  const metadata = find('https://stream.truevoice.digital/api/nowplaying/1');
  assert.equal(metadata.handler.kind, 'NetworkFirst');
  assert.equal(metadata.handler.options.cacheName, 'azuracast-api');
  assert.equal(metadata.handler.options.plugins[0].options.maxAgeSeconds, 30);
  const fonts = find('https://fonts.googleapis.com/css2?family=Fixture');
  assert.equal(fonts.handler.kind, 'CacheFirst');
  assert.equal(fonts.handler.options.plugins[0].options.maxEntries, 10);
  assert.equal(fonts.handler.options.plugins[0].options.maxAgeSeconds, 31536000);
  const images = find('https://www.truevoice.digital/fixture.png');
  assert.equal(images.handler.kind, 'StaleWhileRevalidate');
  assert.equal(images.handler.options.plugins[0].options.maxEntries, 60);
  assert.equal(images.handler.options.plugins[0].options.maxAgeSeconds, 2592000);
  assert.equal(find('https://www.youtube.com/embed/fixture'), undefined);
});

test('checked-in native assets exist for catalog and Android launcher/splash references', () => {
  const tracked = new Set(execFileSync('git', ['ls-files', 'ios/App/App/Assets.xcassets', 'android/app/src/main/res'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n'));
  for (const catalog of ['AppIcon.appiconset', 'Splash.imageset']) {
    const directory = `ios/App/App/Assets.xcassets/${catalog}`;
    const contents = JSON.parse(fs.readFileSync(`${directory}/Contents.json`, 'utf8'));
    for (const image of contents.images) {
      const file = `${directory}/${image.filename}`;
      assert.ok(tracked.has(file), `Asset must be tracked: ${file}`);
      const bytes = fs.readFileSync(file);
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
      if (catalog === 'AppIcon.appiconset') {
        assert.equal(bytes.readUInt32BE(16), 1024);
        assert.equal(bytes.readUInt32BE(20), 1024);
      }
    }
  }
  const android = [...tracked].filter(file => file.startsWith('android/'));
  for (const density of ['ldpi', 'mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    for (const name of ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground', 'ic_launcher_background']) {
      const file = `android/app/src/main/res/mipmap-${density}/${name}.png`;
      assert.ok(android.includes(file), `Missing tracked launcher asset ${file}`);
      assert.ok(fs.statSync(file).size > 0);
    }
  }
  assert.ok(android.includes('android/app/src/main/res/drawable/splash.png'));
  for (const name of ['ic_launcher', 'ic_launcher_round']) {
    const file = `android/app/src/main/res/mipmap-anydpi-v26/${name}.xml`;
    assert.ok(tracked.has(file));
    const xml = fs.readFileSync(file, 'utf8');
    assert.ok(xml.includes('@mipmap/ic_launcher_background'));
    assert.ok(xml.includes('@mipmap/ic_launcher_foreground'));
  }
  // Existing CI consumes stored assets; this does not prove native signing/build.
  const workflow = fs.readFileSync('codemagic.yaml', 'utf8');
  assert.ok(workflow.includes('npm run build'));
  assert.ok(workflow.includes('npx cap sync ios'));
  assert.ok(!workflow.includes('capacitor-assets'));
});
