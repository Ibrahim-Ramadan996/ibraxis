/**
 * IBRAXIS: Conservative, source-backed suggestions. No fabricated credentials,
 * translations, organisations, achievements, dates, writes or publication.
 */
import { sha256 } from './safety.mjs';

export const SUPPORTED_CATEGORIES = Object.freeze(['education', 'career', 'certifications', 'skills']);
const CATEGORIES = new Set(SUPPORTED_CATEGORIES);
const MAX_PROPOSALS = 100;
const SKILLS = [
  ['Python', /\bpython\b/i], ['SQL', /\bsql\b/i], ['Power BI', /\bpower\s*bi\b/i],
  ['Excel', /\bexcel\b/i], ['Pandas', /\bpandas\b/i], ['Matplotlib', /\bmatplotlib\b/i],
  ['Jupyter Notebook', /\bjupyter(?:\s+notebook)?\b/i], ['Git', /\bgit\b/i],
  ['Machine Learning', /\bmachine\s+learning\b|تعلم الآلة|تعلّم الآلة/i],
];

export function normalizeMatch(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

const SECTION_MARKERS = [
  ['education', /^(?:education|academic\s*(?:background|qualifications?)|التعليم|المؤهلات(?:\s+العلمية)?|الدراسة)\s*[:：]?\s*$/i],
  ['career', /^(?:experience|work\s+experience|employment|internships?|الخبرات(?:\s+العملية)?|العمل|التدريب)\s*[:：]?\s*$/i],
  ['certifications', /^(?:certifications?|certificates?|courses|الشهادات|الدورات|الاعتمادات)\s*[:：]?\s*$/i],
  ['skills', /^(?:skills?|technical\s+skills?|technologies|المهارات|التقنيات)\s*[:：]?\s*$/i],
];

function sectionHeading(text) {
  return SECTION_MARKERS.find(([, re]) => re.test(text.trim()))?.[0] ?? null;
}

function guessCategory(text) {
  if (/\b(education|university|bachelor|b\.sc|degree|graduated|college)\b|جامع[ةه]|بكالوريوس|تخرجت|اتخرجت|المؤهل|الدراسة/i.test(text)) return 'education';
  if (/\b(experience|internship|intern|worked|employment|employer)\b|تدريب|تدربت|اشتغلت|عملت في|خبرة|وظيفة|متدرب/i.test(text)) return 'career';
  if (/\b(certificate|certification|certified|credential)\b|شهادة|شهادات|اعتماد مهني/i.test(text)) return 'certifications';
  if (/\b(skills|proficient|technologies|tools)\b|مهارات|أتقن|اجيد|أجيد|التقنيات/i.test(text)) return 'skills';
  return null;
}

function evidence(source, segment) {
  return {
    source: source.kind === 'file' ? source.filename : 'text input',
    sourceHash: source.sha256 ?? null,
    location: structuredClone(segment.location ?? {}),
    quote: segment.text.trim().slice(0, 240),
  };
}

function commonFields(text) {
  const years = [...text.matchAll(/\b(?:19|20)\d{2}\b/g)].map(m => Number(m[0]));
  return {
    originalText: text.slice(0, 1200),
    years: [...new Set(years)].slice(0, 8),
    language: /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en',
  };
}

function extractEducation(text) {
  const universityAr = text.match(/(?:جامعة|جامعه)\s+([\p{Script=Arabic}\s]{2,45}?)(?=\s+(?:سنة|عام|في|من|بكالوريوس|ليسانس|قسم|تخصص|خلال|حتي|حتى)|[،,.\n]|$)/u);
  const universityEn = text.match(/\b([A-Z][a-zA-Z\s]{2,45}\bUniversity)\b/);
  const degreeAr = text.match(/(?:بكالوريوس|ليسانس)(?:\s+(?:في|علوم))?\s*[\p{Script=Arabic}\s]{0,65}?(?=\s+(?:من|في|جامعة|سنة|عام|خلال)|[،,.\n]|$)/u);
  const degreeEn = text.match(/\bBachelor(?:'s|’s)?(?:\s+Degree)?(?:\s+in\s+[A-Za-z ]{2,45})?/i);
  return {
    institution: universityAr ? `جامعة ${universityAr[1].trim()}` : universityEn?.[1]?.trim() ?? null,
    degree: degreeAr?.[0]?.trim() || degreeEn?.[0]?.trim() || null,
  };
}

function extractCareer(text) {
  const companyAr = text.match(/(?:في|لدى|بشركة|بـ)\s+([\p{Script=Arabic}A-Za-z][\p{Script=Arabic}A-Za-z0-9&.\s-]{2,45}?)(?=\s+(?:خلال|سنة|عام|من|لمدة|كتدريب|كمتدرب)|[،,\n]|$)/u);
  const atEnglish = text.match(/\b(?:at|with)\s+([A-Z][\w\s.&-]{2,40}?)(?=\s+(?:from|during|in|as)|[,\n]|$)/);
  return {
    organization: companyAr?.[1]?.trim() || atEnglish?.[1]?.trim() || null,
    position: /تدريب|تدربت|intern/i.test(text) ? 'Internship' : null,
  };
}

function extractCertification(text) {
  const nameAr = text.match(/(?:شهادة|شهاده|كورس|دورة)\s+([^،,.\n]{3,90})/u);
  const nameEn = text.match(/(?:certificate|certification|certified in)\s*[:—-]?\s*([^,;.\n]{3,90})/i);
  return { name: nameAr?.[0]?.trim() || nameEn?.[0]?.trim() || null, issuer: null };
}

function identityKey(category, fields) {
  if (category === 'skills') return `${category}:${normalizeMatch(fields.name)}`;
  if (category === 'education') return `${category}:${normalizeMatch(fields.institution)}:${normalizeMatch(fields.degree)}`;
  if (category === 'career') return `${category}:${normalizeMatch(fields.organization)}:${normalizeMatch(fields.position)}`;
  return `${category}:${normalizeMatch(fields.name)}`;
}

function duplicate(proposal, existingRecords) {
  const records = existingRecords?.[proposal.category] ?? [];
  if (!Array.isArray(records)) return false;
  const values = proposal.fields;
  return records.some(record => {
    const names = [record.name, record.title, record.titleAr, record.titleEn,
      record.nameAr, record.nameEn, record.provider, record.institution,
      record.institutionAr, record.institutionEn, record.degree, record.organization,
      record.company].filter(Boolean).map(normalizeMatch);
    if (proposal.category === 'education') {
      // Multiple degrees at the same university are legitimate distinct records.
      const institution = normalizeMatch(values.institution);
      const degree = normalizeMatch(values.degree);
      return institution && degree && names.includes(institution) && names.includes(degree);
    }
    if (proposal.category === 'career') {
      // Employer alone is insufficient to conclude two roles are identical.
      return normalizeMatch(values.organization) && normalizeMatch(values.position) &&
        names.includes(normalizeMatch(values.organization)) && names.includes(normalizeMatch(values.position));
    }
    const needle = normalizeMatch(values.name);
    return Boolean(needle && names.includes(needle));
  });
}

function proposal(category, fields, source, segments, needsVerification = []) {
  const ev = segments.map(s => evidence(source, s));
  const key = identityKey(category, fields);
  return {
    id: sha256(Buffer.from(`${key}:${ev.map(e => e.quote).join('|')}`)).slice(0, 20),
    category, operation: 'propose_create_draft', fields,
    status: 'review_required', evidence: ev,
    needsVerification, confidence: needsVerification.length ? 'partial' : 'source_supported',
    generatedText: false,
  };
}

function isYearOnly(line) {
  return /^(?:(?:from|to|since|until|present|حتي|حتى|من|إلى|الى|سنة|عام)\s*)?(?:(?:19|20)\d{2})(?:\s*[-–—/]\s*(?:(?:19|20)\d{2}|present|الآن|حاليا))?\s*$/i.test(line);
}
function gapBetween(prev, next) {
  if (prev.location?.line && next.location?.line) return next.location.line - prev.location.line;
  if (prev.location?.paragraph && next.location?.paragraph) return next.location.paragraph - prev.location.paragraph;
  return 1;
}

/** Group multi-line CV sections without carrying a category into unrelated prose. */
function blocksFromSegments(segments) {
  const blocks = [];
  let current = null, declaredSection = null, lastSheet = null;
  function flush() { if (current?.segments.length) blocks.push(current); current = null; }
  for (const segment of segments.slice(0, 2000)) {
    const text = String(segment.text ?? '').trim();
    if (!text) continue;
    const sheet = segment.location?.sheet ?? null;
    if (sheet !== lastSheet) {
      flush();
      declaredSection = sheet ? sectionHeading(sheet) || guessCategory(sheet) : null;
      lastSheet = sheet;
    }
    const heading = sectionHeading(text);
    if (heading) { flush(); declaredSection = heading; continue; }
    const guessed = guessCategory(text);
    const category = guessed || declaredSection || (current && isYearOnly(text) ? current.category : null);
    if (!category || !CATEGORIES.has(category)) {
      flush();
      blocks.push({ category: null, segments: [segment] });
      if (!isYearOnly(text)) declaredSection = null;
      continue;
    }
    const last = current?.segments.at(-1);
    const breakingGap = last && gapBetween(last, segment) > 1;
    const startsNewRecord = current?.category === 'education' &&
      extractEducation(current.segments.map(s => s.text).join('\n')).institution &&
      extractEducation(text).institution;
    const bulletRecord = /^\s*[-•*]\s/.test(segment.text) && current?.segments.length;
    const splitSkills = category === 'skills';
    if (!current || current.category !== category || breakingGap || startsNewRecord || bulletRecord || splitSkills) {
      flush();
      current = { category, segments: [] };
    }
    current.segments.push(segment);
    if (guessed && guessed !== declaredSection) declaredSection = null;
  }
  flush();
  return blocks;
}

export function proposeRecords(extracted, { existingRecords = {} } = {}) {
  if (!extracted || !Array.isArray(extracted.segments)) throw new TypeError('Extracted segments are required');
  const proposals = [], skippedDuplicates = [], unclassified = [], warnings = [...(extracted.warnings ?? [])];
  const dedupBatch = new Set();
  if (extracted.segments.length > 2000) warnings.push('تم فحص أول 2000 مقطع من النص للحفاظ على الأداء؛ راجع الباقي يدويًا.');
  const blocks = blocksFromSegments(extracted.segments);
  for (const block of blocks) {
    const text = block.segments.map(s => s.text.trim()).join('\n');
    const category = block.category;
    if (!category) { unclassified.push(...block.segments.map(s => evidence(extracted.source, s))); continue; }
    const common = commonFields(text);
    let candidates = [];
    if (category === 'education') {
      const fields = extractEducation(text);
      if (fields.institution || fields.degree) candidates = [proposal(category, { ...common, ...fields }, extracted.source, block.segments,
        [!fields.institution && 'institution', !fields.degree && 'degree'].filter(Boolean))];
    } else if (category === 'career') {
      const fields = extractCareer(text);
      if (fields.organization || fields.position) candidates = [proposal(category, { ...common, ...fields }, extracted.source, block.segments,
        [!fields.organization && 'organization', !fields.position && 'position'].filter(Boolean))];
    } else if (category === 'certifications') {
      const fields = extractCertification(text);
      if (fields.name) candidates = [proposal(category, { ...common, ...fields }, extracted.source, block.segments,
        ['issuer', 'evidenceOfAward'])];
    } else if (category === 'skills') {
      candidates = SKILLS.filter(([, re]) => re.test(text)).map(([name]) =>
        proposal(category, { name, originalText: text, language: common.language }, extracted.source, block.segments));
    }
    if (!candidates.length) { unclassified.push(...block.segments.map(s => evidence(extracted.source, s))); continue; }
    for (const item of candidates) {
      const identity = identityKey(item.category, item.fields);
      if (dedupBatch.has(identity) || duplicate(item, existingRecords)) {
        skippedDuplicates.push({ category: item.category, evidence: item.evidence, reason: 'possible_duplicate' });
        continue;
      }
      if (proposals.length >= MAX_PROPOSALS) {
        if (!warnings.includes('تم بلوغ الحد الأقصى للمقترحات في المعاينة.')) warnings.push('تم بلوغ الحد الأقصى للمقترحات في المعاينة.');
        continue;
      }
      dedupBatch.add(identity);
      proposals.push(item);
    }
  }
  if (!proposals.length) warnings.push('لم تُكتشف بيانات كافية لإنشاء مسودة موثوقة؛ يمكنك مراجعة النص يدويًا.');
  if (unclassified.length) warnings.push('بعض النصوص لم تُصنّف تلقائيًا وسيتم عرضها للمراجعة دون إنشاء سجلات.');
  return {
    version: 2, mode: 'preview_only', source: extracted.source,
    proposals, skippedDuplicates, unclassified: unclassified.slice(0, 100), warnings,
    requiresOwnerApproval: true, writesPerformed: 0,
  };
}
