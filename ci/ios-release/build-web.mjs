// Real local Vite compilation only. Exit before the separate emitted-code check.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { validateRuntime } from './validate.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
process.chdir(root);
validateRuntime(process.env);
assert.ok(!fs.readdirSync(root).some(p => /^\.env(?:\.|$)/.test(p)), 'No environment files may enter the release build');
Object.assign(process.env, {
  VERCEL: '1', VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production',
  VITE_STREAM_DELAY_SEC: '15', VITE_AZURACAST_METADATA_DELAY_SEC: '2', VITE_LIVE365_METADATA_DELAY_SEC: '55',
  VITE_YOUTUBE_API_KEY: '',
});
await build({ root, configLoader: 'runner', envDir: path.join(root, '.native-validation/release-environment'), cacheDir: path.join(root, '.native-validation/release-vite-cache') });
const html = fs.readFileSync('dist/index.html', 'utf8');
const asset = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
assert.ok(asset, 'Missing main web bundle');
const bundle = fs.readFileSync('dist' + asset, 'utf8');
assert.ok(bundle.includes('https://streaming.live365.com/a61535'), 'Missing approved listener URL');
assert.doesNotMatch(bundle, /https:\/\/stream\.truevoice\.digital\/(?:listen|hls)\//, 'Direct-origin listener URL emitted');
console.log('RELEASE_WEB_ASSETS_BUILT: approved runtime inputs; no native sync, signing or upload');
