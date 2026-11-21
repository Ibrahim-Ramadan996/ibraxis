/** Conservative Arabic/English request-to-code templates (no LLM and no fabricated data). */
import { createHash } from 'node:crypto';
import { posix } from 'node:path';
function safeHtml(s) { return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function simpleTitle(text, keyword) {
  const normalized = text.replace(/[\r\n]+/g, ' ').trim();
  const re = keyword === 'page'
    ? /(?:صفحة|page)(?:\s+جديدة)?\s+(?:بعنوان|باسم|عن|for|called|named)?\s*([^،,.!?؛:]{2,80})/i
    : keyword === 'section'
      ? /(?:قسم|section)\s+(?:جديد|جديدة|خاص|عن|for|called|named|بعنوان)?\s*([^،,.!?؛:]{2,80})/i
      : /(?:زر|button)(?:\s+لـ|\s+ل)?\s*([^،,.!?؛:]{2,80})/i;
  const match = normalized.match(re);
  const title = match?.[1]?.replace(/\s+(?:في|على|داخل|in|on)\s+(?:الموقع|الصفحة|site|page).*$/i,'').trim();
  return title && title.length <= 80 ? title : '';
}
function slug(title) {
  const raw = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36);
  return raw || `arabic-${createHash('sha256').update(title).digest('hex').slice(0,10)}`;
}
function insertBefore(source, block, closes) {
  for (const close of closes) {
    const re = new RegExp(`</${close}\\s*>`, 'i');
    const match = source.match(re);
    if (match) return source.slice(0, match.index) + block + '\n' + source.slice(match.index);
  }
  throw Object.assign(new Error('لا يوجد موضع معروف وآمن لإضافة المحتوى في الصفحة الرئيسية'), { code: 'UNSUPPORTED_LAYOUT' });
}
function checkHtml(index) {
  if (typeof index !== 'string' || !/<html[\s>]/i.test(index) || !/<body[\s>]/i.test(index)) {
    throw Object.assign(new Error('القالب الحالي ليس HTML مباشر؛ يلزم تكامل مخصص مع إطار عمل الموقع'), {code: 'UNSUPPORTED_LAYOUT'});
  }
}
function getKind(request) {
  if (/(?:صفحة|page)/i.test(request)) return 'page';
  if (/(?:زر|button)/i.test(request)) return 'button';
  if (/(?:قسم|section)/i.test(request)) return 'section';
  throw Object.assign(new Error('القالب الحالي يدعم إنشاء صفحة أو قسم أو زر. الميزات المعقدة تحتاج مخطط تغييرات كود للمراجعة.'), {code: 'UNSUPPORTED_FEATURE'});
}
function linkUrl(href) {
  if (typeof href !== 'string' || href.length > 500) throw new TypeError('A verified link is required for a button');
  const value = href.trim();
  if (/^https:\/\/[a-z0-9.-]+(?::443)?(?:[/?#][^\s<>"']*)?$/i.test(value)) return safeHtml(value);
  if (/^(?:\.?\.?\/)?[a-zA-Z0-9][a-zA-Z0-9_./%-]*(?:#[a-zA-Z0-9_-]+)?$/.test(value) && !value.split('/').includes('..') && !value.startsWith('//')) return safeHtml(value);
  throw Object.assign(new Error('استخدم رابط HTTPS أو مسارًا نسبيًا آمنًا'), {code: 'BAD_URL'});
}

export async function stageTextSiteFeature(builder, context, { request, indexPath, title, description = '', url } = {}) {
  if (typeof request !== 'string' || request.trim().length < 5 || request.length > 1500) throw new TypeError('Write a clear short request');
  if (typeof description !== 'string' || description.length > 2500) throw new TypeError('Description too long');
  if (typeof indexPath !== 'string' || !indexPath.endsWith('.html')) throw new TypeError('Host must identify the real HTML entry point');
  const kind = getKind(request);
  const heading = (title ?? simpleTitle(request, kind)).trim();
  if (!heading || heading.length > 80) throw new TypeError('Request needs a short title for the new element');
  const featureSlug = slug(heading);
  const index = await builder.readText(context, indexPath);
  checkHtml(index);
  const marker = `data-ibraxis-feature="${featureSlug}"`;
  if (index.includes(marker)) throw Object.assign(new Error('هذه الإضافة موجودة بالفعل'), { code: 'POSSIBLE_DUPLICATE' });
  const safeTitle = safeHtml(heading), safeDesc = safeHtml(description).replace(/\n/g,'<br>');
  const desc = safeDesc ? `\n    <p>${safeDesc}</p>` : '';
  let content, changes;
  if (kind === 'section') {
    content = `\n  <section ${marker} aria-labelledby="ibraxis-${featureSlug}">\n    <h2 id="ibraxis-${featureSlug}">${safeTitle}</h2>${desc}\n  </section>`;
    changes = [{ action: 'update', path: indexPath, content: insertBefore(index, content, ['main', 'body']) }];
  } else if (kind === 'button') {
    if (!url) throw Object.assign(new Error('لازم تكتب رابط الزر قبل ما نجهز الكود'), { code: 'MISSING_LINK' });
    const safeUrl = linkUrl(url);
    content = `\n  <a ${marker} class="ibraxis-added-button" href="${safeUrl}" rel="noopener noreferrer">${safeTitle}</a>`;
    changes = [{ action: 'update', path: indexPath, content: insertBefore(index, content, ['main', 'body']) }];
  } else {
    const dirname = posix.dirname(indexPath);
    const pagePath = `${dirname}/pages/${featureSlug}.html`;
    const page = `<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${safeTitle} | IBRAXIS</title>\n<meta name="description" content="${safeHtml(description).slice(0,160)}">\n</head>\n<body>\n<main ${marker}>\n  <h1>${safeTitle}</h1>${desc}\n  <p><a href="../index.html">العودة للرئيسية</a></p>\n</main>\n</body>\n</html>\n`;
    const navBlock = `\n  <a ${marker} href="pages/${featureSlug}.html">${safeTitle}</a>`;
    changes = [
      { action: 'create', path: pagePath, content: page },
      { action: 'update', path: indexPath, content: insertBefore(index, navBlock, ['nav', 'main', 'body']) },
    ];
  }
  return builder.stage(context, { description: `طلب: ${request.slice(0,180)} | إضافة ${kind}: ${heading}`, changes });
}
