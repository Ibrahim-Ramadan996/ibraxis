/**
 * IBRAXIS Site Builder: local, allowlisted, approval-gated source changes.
 * No arbitrary shell, Git push, deletion, deployment, or secrets access.
 * This module is intentionally framework-neutral and does not assume an IBRAXIS database schema.
 */
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {validatePublicFeatures} from '../../site-features.js';
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const MAX_FILES = 12;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024;
const TTL_MS = 15 * 60 * 1000;
const ALLOWED_EXT = /\.(?:html|css|js|mjs|json|md)$/i;
const BANNED_PARTS = new Set(['.git', '.github', '.env', '.vscode', 'node_modules', 'secrets', 'private', 'credentials', 'certs', 'keys', 'data', 'database', 'backups', 'dist', 'build', 'coverage', '.ibraxis-ai-manager']);
const PROTECTED_CODE = new Set(['app/server.mjs','app/integrations.mjs','app/file-store.mjs','app/hybrid-codec.mjs','app/publisher.mjs','app/ai-manager.mjs','app/manager-upgrade.mjs','app/site-home-features.mjs','app/manager-input-panel.js','app/manager-site-panel.js','app/premium-admin.js','app/manager-workflows.js','app/site-features.js']);
const BANNED_BASENAMES = /^(?:package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|\.env(?:\..*)?|.*\.(?:pem|key|p12|pfx|crt)|(?:vite|webpack|eslint|next|nuxt|tailwind)\.config\..*)$/i;
const enc = new TextEncoder();
function sha(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function fail(code, message) { const e = new Error(message); e.code = code; throw e; }
function exact(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
async function statOrNull(path) {
  try { return await lstat(path); } catch (err) { if (err?.code === 'ENOENT') return null; throw err; }
}
function inside(root, full) {
  const rel = relative(root, full);
  return Boolean(rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}
function validateRelative(path, allowedRoots) {
  if (typeof path !== 'string' || path.length > 300 || !path || path.includes('\\') || path.includes('\0') || path.includes('//') || path.includes(':') || isAbsolute(path)) fail('UNSAFE_PATH', 'Path must be a short relative POSIX path');
  const parts = path.split('/');
  if (parts.some(x => !x || x === '.' || x === '..' || x.startsWith('.') || BANNED_PARTS.has(x.toLowerCase()))) fail('UNSAFE_PATH', 'Protected or dot path is not editable');
  if (PROTECTED_CODE.has(path) || path.startsWith('app/ai-kit/') || !ALLOWED_EXT.test(path) || BANNED_BASENAMES.test(parts.at(-1))) fail('UNSAFE_FILE', 'This file type or configuration is protected');
  if (!allowedRoots.some(r => path === r || path.startsWith(`${r}/`))) fail('OUTSIDE_ALLOWLIST', 'Path is outside approved source roots');
  return path;
}
function validateRoots(roots) {
  if (!Array.isArray(roots) || !roots.length || roots.length > 8) throw new TypeError('Explicit allowedRoots are required');
  return roots.map(root => {
    if (typeof root !== 'string' || !root || root.includes('\\') || root.startsWith('/') || root.includes(':') || root.split('/').some(p => !p || p.startsWith('.') || p === '..' || BANNED_PARTS.has(p.toLowerCase()))) throw new TypeError('Invalid allowed root');
    return root;
  });
}
function validateBody(body, path = '') {
  if (typeof body !== 'string' || !body.length || body.includes('\0')) fail('UNSAFE_CONTENT', 'Only nonempty UTF-8 text source files can be edited');
  const bytes = enc.encode(body);
  if (bytes.length > MAX_FILE_BYTES) fail('FILE_LIMIT', 'Proposed file exceeds 256 KiB');
  if (/\.json$/i.test(path)) {
    let parsed;
    try {parsed=JSON.parse(body)} catch {fail('INVALID_JSON','Proposed JSON is malformed')}
    if(path==='app/site-features.json') {
      try {validatePublicFeatures(parsed)} catch {fail('INVALID_FEATURES','Proposed website feature data is invalid')}
    }
  }
  if (/\.(?:js|mjs)$/i.test(path)) {
    // Syntax verification only: generated JavaScript is never evaluated here.
    const result=spawnSync(process.execPath,['--check','--input-type=module','-'],{input:Buffer.from(bytes),timeout:5000,maxBuffer:131072});
    if(result.error||result.status!==0)fail('SYNTAX_ERROR','Proposed JavaScript has invalid syntax or exceeded the syntax-check limit');
  }
  return Buffer.from(bytes);
}
async function verifyPath(root, full, { finalMayBeMissing = false } = {}) {
  if (!inside(root, full)) fail('OUTSIDE_WORKSPACE', 'Path leaves workspace');
  const pieces = relative(root, full).split(sep);
  let cursor = root;
  const base = await lstat(root);
  if (!base.isDirectory() || base.isSymbolicLink()) fail('BAD_WORKSPACE', 'Workspace root must be a real directory');
  for (let i = 0; i < pieces.length; i++) {
    cursor = join(cursor, pieces[i]);
    const st = await statOrNull(cursor);
    if (!st) {
      if (!finalMayBeMissing) fail('FILE_MISSING', 'Expected file is missing');
      // Ensure the remaining path is free of traversal; created directories are checked again later.
      return false;
    }
    if (st.isSymbolicLink()) fail('SYMLINK_DENIED', 'Symbolic links cannot be used in edits');
    if (i < pieces.length - 1 && !st.isDirectory()) fail('NOT_DIRECTORY', 'Parent path is not a directory');
    if (i === pieces.length - 1 && !st.isFile()) fail('NOT_FILE', 'Only regular text files can be edited');
  }
  return true;
}
function makeSummary(before, after) {
  const a = (before ?? '').split('\n'), b = after.split('\n');
  let start = 0; while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length, endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  // Deliberately do not shorten diffs: hidden generated code must never be approved.
  const lines = [ `@@ -${start + 1},${endA - start} +${start + 1},${endB - start} @@` ];
  for (const line of a.slice(start, endA)) lines.push(`-${line}`);
  for (const line of b.slice(start, endB)) lines.push(`+${line}`);
  return { summary: lines.join('\n'), removedLines: endA - start, addedLines: endB - start, abbreviated: false };
}
function riskWarnings(path, before, after) {
  const a=before??''; let start=0,endA=a.length,endB=after.length;
  while(start<endA&&start<endB&&a[start]===after[start])start++;
  while(endA>start&&endB>start&&a[endA-1]===after[endB-1]){endA--;endB--;}
  const changes = after.slice(start,endB);
  const checks = [
    [/\beval\s*\(|\bFunction\s*\(/i, 'DYNAMIC_CODE'],
    [/\bchild_process\b|\bexecSync\s*\(|\bspawnSync\s*\(/i, 'PROCESS_EXECUTION'],
    [/\bprocess\.env\b|\bdocument\.cookie\b/i, 'SENSITIVE_RUNTIME_ACCESS'],
    [/https?:\/\/[^\s"'<>]+/i, 'EXTERNAL_REFERENCE'],
    [/<script\b|\bfetch\s*\(|\bWebSocket\s*\(/i, 'SCRIPT_OR_NETWORK_CHANGE'],
  ];
  return checks.filter(([re]) => re.test(changes)).map(([,code])=>`${path}: ${code}`);
}

async function atomicWrite(root, full, content, exists, expectedHash = undefined) {
  await verifyPath(root, full, { finalMayBeMissing: true });
  const parent = resolve(full, '..');
  await mkdir(parent, { recursive: true, mode: 0o700 });
  await verifyPath(root, full, { finalMayBeMissing: true });
  const tmp = `${full}.ibraxis-tmp-${randomUUID()}`;
  try {
    await writeFile(tmp, content, { flag: 'wx', mode: 0o600 });
    const current = await statOrNull(full);
    if (!exists && current) fail('STALE_PLAN', 'A newly proposed file already exists');
    if (exists && (!current?.isFile() || current.isSymbolicLink())) fail('STALE_PLAN', 'Expected file changed');
    if (exists && expectedHash !== undefined && sha(await readFile(full)) !== expectedHash) fail('STALE_PLAN', 'File changed since preview');
    await rename(tmp, full);
  } finally { await rm(tmp, { force: true }).catch(() => {}); }
}

export function createSiteBuilder({ workspaceRoot, allowedRoots, assertOwner, assertCsrf, audit = async () => {}, now = () => Date.now() } = {}) {
  if (typeof workspaceRoot !== 'string' || !isAbsolute(workspaceRoot)) throw new TypeError('An absolute workspaceRoot is required');
  if (typeof assertOwner !== 'function' || typeof assertCsrf !== 'function' || typeof audit !== 'function') throw new TypeError('Real owner, CSRF and audit callbacks are required');
  const root = resolve(workspaceRoot);
  const roots = validateRoots(allowedRoots);
  const proposals = new Map(), applied = new Map();
  let lock = false;
  async function guard(ctx) { await assertOwner(ctx); await assertCsrf(ctx); }
  async function inspect(path, shouldExist = undefined) {
    validateRelative(path, roots);
    const full = resolve(root, path);
    const exists = await verifyPath(root, full, { finalMayBeMissing: shouldExist !== true });
    if (shouldExist === false && exists) fail('ALREADY_EXISTS', 'New file already exists');
    if (shouldExist === true && !exists) fail('FILE_MISSING', 'File to edit does not exist');
    const bytes = exists ? await readFile(full) : null;
    if (bytes && bytes.length > MAX_FILE_BYTES) fail('FILE_LIMIT', 'Existing file too large for safe edit');
    if (bytes && bytes.toString('utf8').includes('\uFFFD')) fail('NOT_UTF8', 'Existing source must be UTF-8');
    return { path, full, exists, bytes, hash: bytes === null ? null : sha(bytes) };
  }
  async function stage(context, { description, changes } = {}) {
    await guard(context);
    if (typeof description !== 'string' || !description.trim() || description.length > 500) fail('BAD_PLAN', 'Short change description is required');
    if (!Array.isArray(changes) || changes.length === 0 || changes.length > MAX_FILES) fail('PLAN_LIMIT', 'Plan must change 1 to 12 files');
    const out = [], seen = new Set(), warnings = [];
    let byteCount = 0;
    for (const c of changes) {
      if (!c || !['create', 'update'].includes(c.action)) fail('UNSAFE_ACTION', 'Only create and update are permitted');
      if (seen.has(c.path)) fail('DUPLICATE_PATH', 'Duplicate file in plan');
      seen.add(c.path);
      const snapshot = await inspect(c.path, c.action === 'update');
      if (c.action === 'create' && snapshot.exists) fail('ALREADY_EXISTS', 'File already exists');
      const newBytes = validateBody(c.content,c.path);
      byteCount += newBytes.length + (snapshot.bytes?.length ?? 0);
      if (byteCount > MAX_TOTAL_BYTES) fail('PLAN_LIMIT', 'Total change set too large');
      if (snapshot.hash === sha(newBytes)) fail('NO_CHANGE', 'Proposed content matches existing content');
      warnings.push(...riskWarnings(c.path, snapshot.bytes?.toString('utf8') ?? '', newBytes.toString('utf8')));
      out.push({ ...snapshot, after: newBytes, afterHash: sha(newBytes), action: c.action,
        diff: makeSummary(snapshot.bytes?.toString('utf8') ?? '', newBytes.toString('utf8')) });
    }
    const planId = randomUUID();
    const digest = sha(Buffer.from(JSON.stringify({ description, files: out.map(x => [x.path, x.hash, x.afterHash, x.action]) })));
    const record = { planId, digest, description, changes: out, expiresAt: now() + TTL_MS, state: 'awaiting_approval' };
    proposals.set(planId, record);
    await audit({ event: 'site_plan_staged', planId, count: out.length }, context);
    return { planId, reviewDigest: digest, description, expiresAt: record.expiresAt, status: 'awaiting_approval',
      changes: out.map(x => ({ path: x.path, action: x.action, beforeSha256: x.hash, afterSha256: x.afterHash, ...x.diff })),
      securityWarnings: warnings, requiresExplicitApproval: true, deploys: false, writesPerformed: 0 };
  }
  async function approve(context, { planId, reviewDigest, acknowledge } = {}) {
    await guard(context);
    if (acknowledge !== true) fail('APPROVAL_REQUIRED', 'User must explicitly approve the exact reviewed plan');
    const p = proposals.get(planId);
    if (!p || p.state !== 'awaiting_approval' || now() >= p.expiresAt || !exact(reviewDigest, p.digest)) fail('PLAN_INVALID', 'Plan missing, expired, reused, or mismatched');
    if (lock) fail('BUSY', 'Another workspace change is in progress');
    lock = true;
    p.state = 'applying';
    const written = [];
    try {
      for (const change of p.changes) {
        const current = await inspect(change.path);
        if (current.hash !== change.hash || current.exists !== change.exists) fail('STALE_PLAN', 'Workspace changed since preview; make a new plan');
      }
      await audit({ event: 'site_plan_approved', planId }, context);
      for (const change of p.changes) {
        await atomicWrite(root, change.full, change.after, change.exists, change.hash);
        written.push(change);
      }
      const changeId = randomUUID();
      applied.set(changeId, { changeId, planId, changes: p.changes, state: 'applied' });
      p.state = 'applied';
      try { await audit({ event: 'site_changes_applied', planId, changeId, count: written.length }, context); }
      catch { /* Changes are applied; retain state for undo even if post-write audit fails. */ }
      return { changeId, status: 'applied_to_workspace', filesChanged: written.map(x => x.path),
        requiresTests: true, requiresReviewBeforeDeploy: true, published: false, gitPushed: false };
    } catch (err) {
      // Best effort automatic rollback only for changes this transaction wrote and still owns.
      const failures = [];
      for (const c of written.reverse()) {
        try {
          const current = await inspect(c.path);
          if (current.hash !== c.afterHash) { failures.push(`${c.path}: modified during rollback`); continue; }
          if (c.exists) await atomicWrite(root, c.full, c.bytes, true, c.afterHash);
          else await rm(c.full);
        } catch { failures.push(c.path); }
      }
      p.state = 'failed';
      try { await audit({ event: 'site_change_failed', planId, code: err.code ?? 'ERROR', rollbackIncomplete: failures.length > 0 }, context); } catch {}
      if (failures.length) fail('ROLLBACK_INCOMPLETE', `Rollback needs manual review: ${failures.join(', ')}`);
      throw err;
    } finally { lock = false; }
  }
  async function undo(context, { changeId, acknowledge } = {}) {
    await guard(context);
    if (acknowledge !== true) fail('APPROVAL_REQUIRED', 'Undo also requires explicit approval');
    if (lock) fail('BUSY', 'Another workspace change is in progress');
    const record = applied.get(changeId);
    if (!record || record.state !== 'applied') fail('UNDO_INVALID', 'Change not found or already undone');
    lock = true;
    const reverted = [];
    try {
      for (const c of record.changes) {
        const current = await inspect(c.path, true);
        if (current.hash !== c.afterHash) fail('STALE_UNDO', 'Cannot undo after further edits');
      }
      await audit({ event: 'site_undo_approved', changeId }, context);
      for (const c of [...record.changes].reverse()) {
        if (c.exists) await atomicWrite(root, c.full, c.bytes, true, c.afterHash);
        else await rm(c.full);
        reverted.push(c);
      }
      record.state = 'undone';
      try { await audit({ event: 'site_change_undone', changeId }, context); } catch {}
      return { changeId, status: 'undone_in_workspace', published: false };
    } catch(err) {
      const failures=[];
      for (const c of reverted.reverse()) {
        try {
          if (c.exists) await atomicWrite(root, c.full, c.after, true, c.hash);
          else await atomicWrite(root, c.full, c.after, false);
        } catch { failures.push(c.path); }
      }
      if (failures.length) fail('UNDO_ROLLBACK_INCOMPLETE', `Restore failed: ${failures.join(', ')}`);
      throw err;
    } finally { lock = false; }
  }
  async function reject(context, { planId } = {}) {
    await guard(context);
    const p = proposals.get(planId);
    if (!p || p.state !== 'awaiting_approval') fail('PLAN_INVALID', 'Plan not awaiting review');
    p.state = 'rejected';
    await audit({ event: 'site_plan_rejected', planId }, context);
    return { planId, status: 'rejected', writesPerformed: 0 };
  }
  return Object.freeze({ stage, approve, undo, reject, inspect: async (context, path) => { await guard(context); const a = await inspect(path); return { path, exists: a.exists, sha256: a.hash }; },
    readText: async (context, path) => { await guard(context); const a = await inspect(path, true); return a.bytes.toString('utf8'); },
    capabilities: Object.freeze({ createFile: true, editFile: true, undo: true, deleteFile: false, runShell: false, readSecrets: false, gitPush: false, publicDeploy: false, approvedRoots: roots }) });
}
