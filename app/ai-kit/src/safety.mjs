/** Defensive helpers; never calls the network or mutates application state. */
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function safeFilename(value) {
  // Accept both POSIX and Windows-style paths; never trust a client-supplied path.
  const name = basename(String(value ?? '').replaceAll('\\', '/'))
    .replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return name.slice(0, 180) || 'unnamed';
}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const MAX_ENTRIES = 800;
const MAX_UNCOMPRESSED = 32 * 1024 * 1024;
const MAX_ENTRY = 12 * 1024 * 1024;
const MAX_RATIO = 250;

/**
 * Fail-closed OOXML ZIP preflight. Validates central directory before a third-party
 * decoder touches it. ZIP64, encrypted, multi-disk or suspiciously large archives
 * are deliberately unsupported. This is not an antivirus scanner or sandbox.
 */
export function checkOfficeZip(content, type) {
  const buf = Buffer.from(content);
  if (buf.length < 22 || buf.readUInt32LE(0) !== 0x04034b50) {
    throw zipError('FILE_SIGNATURE', 'Expected a valid Office ZIP archive');
  }
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === EOCD && i + 22 + buf.readUInt16LE(i + 20) === buf.length) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw zipError('BAD_OFFICE_ZIP', 'ZIP central directory not found');
  if (buf.readUInt16LE(eocd + 4) !== 0 || buf.readUInt16LE(eocd + 6) !== 0) {
    throw zipError('UNSAFE_OFFICE_ZIP', 'Multi-disk archives are not accepted');
  }
  const entries = buf.readUInt16LE(eocd + 10);
  const size = buf.readUInt32LE(eocd + 12);
  const offset = buf.readUInt32LE(eocd + 16);
  if (entries !== buf.readUInt16LE(eocd + 8) || entries > MAX_ENTRIES ||
      entries === 0xffff || size === 0xffffffff || offset === 0xffffffff ||
      offset + size > eocd) {
    throw zipError('UNSAFE_OFFICE_ZIP', 'Invalid or oversized ZIP central directory');
  }
  let cursor = offset, total = 0;
  const names = new Set();
  for (let index = 0; index < entries; index++) {
    if (cursor + 46 > offset + size || buf.readUInt32LE(cursor) !== CENTRAL) {
      throw zipError('BAD_OFFICE_ZIP', 'Malformed Office ZIP entry');
    }
    const flags = buf.readUInt16LE(cursor + 8);
    const compression = buf.readUInt16LE(cursor + 10);
    const compressed = buf.readUInt32LE(cursor + 20);
    const uncompressed = buf.readUInt32LE(cursor + 24);
    const nameLength = buf.readUInt16LE(cursor + 28);
    const extraLength = buf.readUInt16LE(cursor + 30);
    const commentLength = buf.readUInt16LE(cursor + 32);
    const externalAttributes = buf.readUInt32LE(cursor + 38);
    const end = cursor + 46 + nameLength + extraLength + commentLength;
    if (end > offset + size || compressed === 0xffffffff || uncompressed === 0xffffffff) {
      throw zipError('BAD_OFFICE_ZIP', 'Malformed or ZIP64 Office entry');
    }
    const name = buf.toString('utf8', cursor + 46, cursor + 46 + nameLength).replaceAll('\\', '/');
    if (!name || name.startsWith('/') || /^[A-Za-z]:/.test(name) ||
        name.split('/').includes('..') || names.has(name) || name.includes('\0')) {
      throw zipError('UNSAFE_OFFICE_ZIP', 'Unsafe or duplicate Office archive entry path');
    }
    const unixFileType = ((externalAttributes >>> 16) & 0xf000);
    if (flags & 1 || ![0, 8].includes(compression) || unixFileType === 0xa000) {
      throw zipError('UNSAFE_OFFICE_ZIP', 'Encrypted, symlink or unsupported archive entry');
    }
    total += uncompressed;
    if (uncompressed > MAX_ENTRY || total > MAX_UNCOMPRESSED ||
        (uncompressed && (!compressed || uncompressed / compressed > MAX_RATIO))) {
      throw zipError('ZIP_RESOURCE_LIMIT', 'Office document exceeds safe extraction limits');
    }
    names.add(name);
    cursor = end;
  }
  if (cursor !== offset + size) throw zipError('BAD_OFFICE_ZIP', 'Unexpected ZIP central directory bytes');
  const expected = type === '.docx' ? 'word/document.xml' : 'xl/workbook.xml';
  if (!names.has('[Content_Types].xml') || !names.has(expected)) {
    throw zipError('BAD_OFFICE_ZIP', 'Document is not a supported Office file');
  }
  return { entries, uncompressedBytes: total };
}

function zipError(code, message) {
  const error = new Error(message);
  error.name = 'IngestError';
  error.code = code;
  return error;
}
