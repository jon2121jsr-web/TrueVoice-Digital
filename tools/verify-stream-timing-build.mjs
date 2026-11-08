// Read emitted code only: no network, environment dumps, or application execution.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const html = fs.readFileSync('dist/index.html', 'utf8');
const asset = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
assert.ok(asset, 'Main bundle must be referenced by index.html');
const source = fs.readFileSync(`dist${asset}`, 'utf8');
assert.ok(source.includes('https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3'), 'Approved standard AzuraCast listener must be emitted');
assert.ok(!source.includes('https://streaming.live365.com/a61535'), 'Rollback listener must remain unselected in the website bundle');
assert.ok(!source.includes('https://stream.truevoice.digital/listen/truevoice_digital/live365.mp3'), 'Dedicated relay mount must not be selected');
const ast = parse(source, { sourceType: 'module' });
const functions = new Map(ast.program.body.filter(n => n.type === 'FunctionDeclaration').map(n => [n.id.name, n]));
const classifier = [...functions.values()].find(n => source.slice(n.start, n.end).includes('.cdnstream.com'));
assert.ok(classifier, 'Emitted source classifier must exist');
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(n => walk(n, visit)); return; }
  visit(node);
  Object.values(node).forEach(value => { if (value && typeof value === 'object') walk(value, visit); });
}
const names = new Set();
function include(fn) {
  if (names.has(fn.id.name)) return;
  names.add(fn.id.name);
  walk(fn, n => {
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && functions.has(n.callee.name)) include(functions.get(n.callee.name));
  });
}
include(classifier);
const declarations = [...names].map(name => { const n = functions.get(name); return source.slice(n.start, n.end); }).join('\n');
assert.ok(names.size <= 5 && declarations.length < 4500, 'Evaluate only the small pure timing helpers');
const helpers = new Function(`${declarations}; return {${[...names].join(',')}};`)();
let settings;
for (const fn of functions.values()) {
  const vars = new Map(), calls = [];
  walk(fn, n => {
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') vars.set(n.id.name, n.init);
    if (n.type === 'CallExpression' && n.callee.name === classifier.id.name && n.arguments[0]?.type === 'MemberExpression' && n.arguments[0].property.name === 'currentSrc') calls.push(n);
  });
  function value(n) {
    if (!n) return undefined;
    if (n.type === 'StringLiteral' || n.type === 'NumericLiteral') return n.value;
    if (n.type === 'Identifier' && vars.has(n.name)) return value(vars.get(n.name));
    if (n.type === 'UnaryExpression' && n.operator === 'void') return undefined;
    if (n.type === 'CallExpression' && names.has(n.callee.name)) return helpers[n.callee.name](...n.arguments.map(value));
    throw new Error('Unexpected timing constant shape in emitted controller');
  }
  for (const call of calls) settings = call.arguments.slice(1).map(value);
}
assert.ok(settings, 'Controller must select timing from currentSrc');
const select = url => helpers[classifier.id.name](url, ...settings).seconds;
assert.equal(select('https://streaming.live365.com/a61535'), 55);
assert.equal(select('https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3'), 2);
assert.equal(select('https://unknown.invalid/radio'), 15);
assert.ok(fs.existsSync('dist/sw.js'), 'PWA service worker must be generated');
console.log(`BUNDLE_TIMING_VERIFIED ${asset}: currentSrc -> Live365=55 AzuraCast=2 unknown=15; PWA generated`);
