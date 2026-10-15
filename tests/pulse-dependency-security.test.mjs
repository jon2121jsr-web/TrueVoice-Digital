import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Buffer } from 'node:buffer';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import WebSocket, { WebSocketServer } from 'ws';
import { RealtimeClient } from '@supabase/realtime-js';
import postcss from 'postcss';

async function localServer(t, options = {}) {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0, ...options });
  t.after(async () => {
    for (const client of server.clients) client.terminate();
    await new Promise(resolve => server.close(resolve));
  });
  await once(server, 'listening');
  return server;
}

test('ws sends the complete TypedArray close reason without uninitialized bytes', { timeout: 5000 }, async t => {
  const server = await localServer(t);
  const connection = once(server, 'connection');
  const client = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
  t.after(() => client.terminate());
  const opened = once(client, 'open');
  const closed = once(client, 'close');
  const [peer] = await connection;
  await opened;
  assert.throws(() => peer.close(1000, new Uint16Array(40)), TypeError, 'unsupported multi-byte views must be rejected');
  const values = new Uint8Array(80).fill(0x61);
  peer.close(1000, values);
  const [code, reason] = await closed;
  assert.equal(code, 1000);
  assert.deepEqual(reason, Buffer.from(values.buffer), 'all 80 initialized bytes must be transmitted');
});

test('ws rejects excessive tiny fragments within the message-size limit', { timeout: 5000 }, async t => {
  const server = await localServer(t, { maxFragments: 4, maxPayload: 1024 });
  const connection = once(server, 'connection');
  const client = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
  t.after(() => client.terminate());
  const opened = once(client, 'open');
  const closed = once(client, 'close');
  const [peer] = await connection;
  await opened;
  const rejected = once(peer, 'error');
  for (let i = 0; i < 5; i++) client.send('a', { fin: false });
  const [error] = await rejected;
  assert.equal(error.code, 'WS_ERR_TOO_MANY_BUFFERED_PARTS');
  const [code] = await closed;
  assert.equal(code, 1008, 'fragment policy closes the connection before unbounded allocation');
});

test('unchanged Supabase Realtime client connects and disconnects with patched ws transport', { timeout: 5000 }, async t => {
  const server = await localServer(t);
  const connection = once(server, 'connection');
  let resolveOpen;
  const opened = new Promise(resolve => { resolveOpen = resolve; });
  class ObservedWebSocket extends WebSocket {
    constructor(...args) { super(...args); this.once('open', resolveOpen); }
  }
  const realtime = new RealtimeClient(`ws://127.0.0.1:${server.address().port}/socket`, { transport: ObservedWebSocket, params: { apikey: 'fixture' } });
  t.after(async () => { await realtime.disconnect(); });
  realtime.connect();
  const [peer] = await connection;
  await opened;
  assert.equal(realtime.isConnected(), true);
  const closed = once(peer, 'close');
  await realtime.disconnect();
  await closed;
  assert.equal(realtime.isConnected(), false);
});

test('PostCSS ignores untrusted external map annotations without from or outside the CSS directory', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'pulse-postcss-security-'));
  const temporaryPath = relative(tmpdir(), directory);
  assert.ok(!isAbsolute(temporaryPath) && !temporaryPath.startsWith('..') && temporaryPath.startsWith('pulse-postcss-security-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const cssDirectory = join(directory, 'css');
  await mkdir(cssDirectory);
  const map = { version: 3, file: 'input.css', sources: ['private-fixture'], names: [], mappings: 'AAAA', sourcesContent: ['PULSE_PRIVATE_MAP_FIXTURE'] };
  const mapFile = join(directory, 'outside.map');
  await writeFile(mapFile, JSON.stringify(map));
  const css = 'a { color: teal; }';
  const noFrom = postcss.parse(`${css}\n/*# sourceMappingURL=${mapFile.replaceAll('\\', '/')} */`);
  assert.equal(noFrom.source.input.map?.text, undefined, 'no origin path means no implicit file read');
  const traversal = postcss.parse(`${css}\n/*# sourceMappingURL=../outside.map */`, { from: join(cssDirectory, 'input.css') });
  assert.equal(traversal.source.input.map?.text, undefined, 'annotation cannot escape the CSS directory');
  const explicit = postcss.parse(css, { map: { prev: map } });
  assert.ok(explicit.source.input.map.text.includes('PULSE_PRIVATE_MAP_FIXTURE'), 'explicit trusted previous maps remain supported');
});
