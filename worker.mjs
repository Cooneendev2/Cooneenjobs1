/* Tests for worker.js (the Cloudflare Workers entry point) with the network and the static-asset store faked:
     node --no-warnings tests/worker.mjs
   The vacancy below is an obvious test record, not real data. */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TALOS_URL = 'https://api-careers-sites.talos360.com/api/careerssite/vacancies/search';
const FIXTURE = JSON.stringify({
  careersSiteVacancies: [{
    jobPostId: '1', jobReference: 'TEST0001', jobTitle: 'Test vacancy',
    jobDescription: '<p>Test description.</p>', employmentType: 'Permanent', employment: 'Full-time',
    applyUrlRoute: '/Apply/TEST?i=x', remoteWork: false,
    metadata: [{ name: 'Location', value: 'Test town' }, { name: 'Skill or Department', value: 'Testing' }],
    dateCreated: '2026-09-30T10:00:00.000+00:00', expiryDate: '2099-01-01T22:59:59+00:00'
  }]
});

// worker.js and the handler are copied to a temporary folder for every test, so each test starts with an empty
// in-memory cache (the handler keeps one for the life of the server).
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmpDirs = [];
async function load() {
  const dir = mkdtempSync(join(tmpdir(), 'cooneen-worker-'));
  tmpDirs.push(dir);
  mkdirSync(join(dir, 'functions', 'api'), { recursive: true });
  copyFileSync(join(ROOT, 'worker.js'), join(dir, 'worker.js'));
  copyFileSync(join(ROOT, 'functions', 'api', 'jobs.js'), join(dir, 'functions', 'api', 'jobs.js'));
  return import(pathToFileURL(join(dir, 'worker.js')).href);
}
after(() => { for (const d of tmpDirs) rmSync(d, { recursive: true, force: true }); });
const mkEnv = () => {
  const seen = [];
  return {
    seen,
    ASSETS: { async fetch(req) { seen.push(new URL(req.url).pathname); return new Response('<!doctype html>ASSET', { status: 200, headers: { 'content-type': 'text/html' } }); } }
  };
};
const mkCtx = () => ({ waitUntil() {} });
function installFetch() {
  const calls = [];
  globalThis.fetch = async (u) => { calls.push(String(u)); return new Response(FIXTURE, { status: 200, headers: { 'content-type': 'application/json' } }); };
  return calls;
}
function installCache() {
  const store = new Map(); let puts = 0, matches = 0;
  globalThis.caches = { default: {
    async match(r) { matches++; const x = store.get(r.url); return x && x.clone(); },
    async put(r, x) { puts++; store.set(r.url, x.clone()); }
  } };
  return { get puts() { return puts; }, get matches() { return matches; } };
}

test('/api/jobs goes to the handler; everything else goes to the static files', async () => {
  const calls = installFetch(); installCache();
  const w = (await load()).default; const env = mkEnv(); const ctx = mkCtx();
  let r = await w.fetch(new Request('https://x.example/api/jobs'), env, ctx);
  const b = await r.json();
  assert.equal(r.status, 200);
  assert.equal(b.jobs.length, 1);
  assert.equal(b.jobs[0].title, 'Test vacancy');
  assert.match(b.jobs[0].url, /^https:\/\/cooneensgroup1\.talosats-careers\.com\//);
  assert.deepEqual(env.seen, []);
  r = await w.fetch(new Request('https://x.example/?mode=kiosk'), env, ctx);
  assert.equal(await r.text(), '<!doctype html>ASSET');
  r = await w.fetch(new Request('https://x.example/admin'), env, ctx);
  assert.deepEqual(env.seen, ['/', '/admin']);
  assert.deepEqual(calls, [TALOS_URL]);
});

test('only the exact path /api/jobs is handled (no open-proxy paths); other methods are refused', async () => {
  installFetch(); installCache();
  const w = (await load()).default; const env = mkEnv(); const ctx = mkCtx();
  await w.fetch(new Request('https://x.example/api/jobs/extra'), env, ctx);
  await w.fetch(new Request('https://x.example/api/jobs.json'), env, ctx);
  assert.deepEqual(env.seen, ['/api/jobs/extra', '/api/jobs.json']);
  let r = await w.fetch(new Request('https://x.example/api/jobs', { method: 'POST', body: '{}' }), env, ctx);
  assert.equal(r.status, 405);
  r = await w.fetch(new Request('https://x.example/api/jobs', { method: 'HEAD' }), env, ctx);
  assert.equal(r.status, 200);
  assert.equal(await r.text(), '');
});

test('on *.workers.dev: no Cache API, memory cache still prevents repeat Talos calls, diagnostics say why', async () => {
  const calls = installFetch(); const cache = installCache();
  const w = (await load()).default; const env = mkEnv(); const ctx = mkCtx();
  let r = await w.fetch(new Request('https://cooneenjobs.example.workers.dev/api/jobs?diag=1'), env, ctx);
  const b = await r.json();
  assert.equal(r.status, 200);
  assert.equal(b.diagnostics.cache.edgeCacheAvailable, false);
  assert.match(b.diagnostics.cache.edgeCacheNote, /workers\.dev/);
  assert.equal(cache.puts, 0); assert.equal(cache.matches, 0);
  for (let i = 0; i < 10; i++) {
    r = await w.fetch(new Request('https://cooneenjobs.example.workers.dev/api/jobs'), env, ctx);
    assert.equal(r.headers.get('x-jobs-cache'), 'HIT');
  }
  assert.equal(calls.length, 1);
});

test('on a custom domain the Cache API is used', async () => {
  installFetch(); const cache = installCache();
  const w = (await load()).default; const env = mkEnv(); const ctx = mkCtx();
  const r = await w.fetch(new Request('https://jobs.example.com/api/jobs?diag=1'), env, ctx);
  const b = await r.json();
  assert.equal(b.diagnostics.cache.edgeCacheAvailable, true);
  assert.equal(b.diagnostics.cache.edgeCacheNote, null);
  assert.equal(cache.puts, 1);
});
