import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFile } from '../app/ai-kit/src/file-extractor.mjs';

// No real PDF or external service is involved: parser lifecycle is simulated
// so that successful extraction followed by failed cleanup is reproducible.
const fakePdfBytes = Buffer.from('%PDF-1.4\nfixture\n');

function fakeLoader({ cleanupError = false, readError = null } = {}) {
  const calls = [];
  const task = {
    promise: Promise.resolve({
      numPages: 1,
      async getPage() {
        return {
          async getTextContent() {
            if (readError) throw readError;
            return { items: [
              { str: 'Fayoum University', hasEOL: true },
              { str: 'Computer Science', hasEOL: true },
            ] };
          },
          cleanup() { calls.push('page-cleanup'); },
        };
      },
      async destroy() {
        calls.push('pdf-destroy');
        if (cleanupError) throw Error('internal worker shutdown failed');
      },
    }),
    async destroy() { calls.push('task-destroy'); },
  };
  return {
    calls,
    load: async () => ({ getDocument: () => task }),
  };
}

test('PDF preview retains extracted text when PDF worker cleanup throws', async () => {
  const mock = fakeLoader({ cleanupError: true });
  const result = await extractFile({
    filename: 'CV.pdf', bytes: fakePdfBytes, localPdfLoader: mock.load,
  });
  assert.equal(result.text, 'Fayoum University\nComputer Science');
  assert.equal(result.segments[0].location.page, 1);
  assert.match(result.warnings.join(' '), /الإغلاق/);
  assert.deepEqual(mock.calls, ['page-cleanup', 'pdf-destroy', 'task-destroy']);
});

test('PDF preview retains clean result with no warning when cleanup succeeds', async () => {
  const mock = fakeLoader();
  const result = await extractFile({
    filename: 'CV.pdf', bytes: fakePdfBytes, localPdfLoader: mock.load,
  });
  assert.equal(result.text, 'Fayoum University\nComputer Science');
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(mock.calls, ['page-cleanup', 'pdf-destroy']);
});

test('PDF extraction failure is not hidden by a later cleanup failure', async () => {
  const mock = fakeLoader({ cleanupError: true, readError: new Error('failed to parse page') });
  await assert.rejects(
    () => extractFile({filename: 'CV.pdf', bytes: fakePdfBytes, localPdfLoader: mock.load}),
    { code: 'PDF_READ_FAILED' },
  );
  assert.deepEqual(mock.calls, ['page-cleanup', 'pdf-destroy', 'task-destroy']);
});
