// Local web artifacts only: does not sync Capacitor, sign, deploy, or upload.
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { build } from 'vite';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
// The shared build policy requires an explicit classification. Use its existing
// production policy for this local native candidate, in this process only.
// No hosted environment settings or source policy are changed.
Object.assign(process.env, {
  VERCEL: '1', VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production',
  VITE_STREAM_DELAY_SEC: '15', VITE_AZURACAST_METADATA_DELAY_SEC: '2',
  VITE_LIVE365_METADATA_DELAY_SEC: '55',
  // Native catalogs and admin analytics already use the hosted APIs.
  VITE_YOUTUBE_API_KEY: '',
});
// The baseline's tracked .env predates the accepted release. Do not import it
// into the emitted native candidate. Public app configuration is supplied by
// the caller; backend credentials are never loaded from another checkout.
const publicUrl = process.env.VITE_SUPABASE_URL;
const publicKey = process.env.VITE_SUPABASE_ANON_KEY;
assert.ok(publicUrl && new URL(publicUrl).protocol === 'https:', 'Supply public VITE_SUPABASE_URL');
assert.ok(publicKey, 'Supply public VITE_SUPABASE_ANON_KEY');
const isPublicKey = publicKey.startsWith('sb_publishable_') || (() => {
  try { return JSON.parse(Buffer.from(publicKey.split('.')[1], 'base64url')).role === 'anon'; }
  catch { return false; }
})();
assert.ok(isPublicKey, 'Only a public Supabase key may enter the client bundle');
await build({ root, configLoader: 'runner', envDir: path.join(root, '.native-validation/environment'), cacheDir: path.join(root, '.native-validation/vite-cache') });
const timing = spawnSync(process.execPath, ['tools/verify-stream-timing-build.mjs'], { cwd: root, stdio: 'inherit', windowsHide: true });
assert.equal(timing.status, 0, 'Emitted metadata timing verification failed');
const html = fs.readFileSync('dist/index.html', 'utf8');
const asset = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
assert.ok(asset, 'Missing main bundle');
const source = fs.readFileSync('dist' + asset, 'utf8');
assert.ok(source.includes('https://streaming.live365.com/a61535'), 'Missing approved Live365 endpoint');
assert.doesNotMatch(source, /https:\/\/stream\.truevoice\.digital\/(?:listen|hls)\//, 'Direct-origin listener URL emitted');
console.log(JSON.stringify({ asset, live365OnlyListener: true, capacitorSynced: false }));
