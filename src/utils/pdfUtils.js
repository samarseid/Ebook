// src/utils/pdfUtils.js
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker.js';

/* ---------- Normalizatsiya ---------- */
function normalizeSpaces(str) {
  if (!str) return '';
  return str
    // no-break va boshqa maxsus bo'shliqlarni oddiy bo'shliqqa
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
    // ko'p bo'shliqlar -> bitta
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n+ ?/g, '\n') // satr atrofidagi bo'shliqlarni siqish
    .trim();
}

/* ---------- Hyphenation fallback (lotin + kiril) ---------- */
const VOWELS_RE = /[aeiouаеёиоуыэюяAEIOUАЕЁИОУЫЭЮЯ]/;
const APOST = /[\u02BC\u2019'`]/; // ʼ ’ ' `
function insertSoftHyphens(word) {
  // 7+ dan boshlab ham bo'linish nuqtasi qo'yamiz — justify stretch kamayadi
  const MIN_LEN = 7;
  if (!word || word.length < MIN_LEN) return word;

  const parts = [];
  let buf = '';
  const isV = (ch) => VOWELS_RE.test(ch);

  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    buf += ch;

    const next = word[i + 1] || '';
    const change =
      (!APOST.test(ch) && (isV(ch) && !isV(next))) ||
      (!APOST.test(ch) && (!isV(ch) && isV(next)));

    // bo'g'in topilsa 4+ dan kesamiz; topilmasa 6 da majburan
    const enough = buf.length >= 4 && change;
    const force  = buf.length >= 6;

    if (enough || force) {
      parts.push(buf);
      buf = '';
    }
  }
  if (buf) parts.push(buf);

  return parts.join('\u00AD'); // soft hyphen
}

// Juda qisqa so'zlarda ham breakpoint berish uchun (ixtiyoriy)
function sprinkleZwsp(word) {
  // 6+ bo'lsa har 5 belgida \u200B qo'yamiz (ko'rinmaydi, lekin bo'linadi)
  if (!word || word.length < 6) return word;
  let out = '';
  for (let i = 0; i < word.length; i++) {
    out += word[i];
    if ((i + 1) % 5 === 0 && i !== word.length - 1) out += '\u200B';
  }
  return out;
}

function hyphenateLine(line, useZwsp = true) {
  // Unicode so'zlar: lotin + kiril + apostroflar
  return line.replace(/[\p{L}\p{M}\u02BC\u2019'`]+/gu, (w) => {
    // avval soft-hyphen bilan bo'linadi
    let h = insertSoftHyphens(w);
    // keyin qo'shimcha breakpointlar uchun (ixtiyoriy)
    return useZwsp ? sprinkleZwsp(h) : h;
  });
}

/* ---------- Asosiy yuklovchi ---------- */
export async function loadFormattedPdfPages(
  url,
  {
    wordsPerPage = 150,
    yThreshold = 5,        // qatorni aniqlash uchun Y farqi
    gapXThreshold = 6,     // x bo'shliq bo'yicha space qo'yish
    addZwsp = true,        // zero-width space qo'yish
  } = {}
) {
  // PDF ni yuklash
  const loadingTask = pdfjsLib.getDocument(url); // agar kerak bo'lsa { url } ham ishlaydi
  const pdf = await loadingTask.promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent({
      // normalizeWhitespace: true, // ba'zi buildlarda mavjud
      // disableCombineTextItems: false,
    });

    let prevY = null;
    let prevX = null;

    for (const item of content.items) {
      let str = normalizeSpaces(item.str);

      if (!str) continue;

      const y = item.transform[5];
      const x = item.transform[4];

      // Y o'zgarsa -> yangi qator
      if (prevY !== null && Math.abs(y - prevY) > yThreshold) {
        fullText += '\n';
        prevX = null; // yangi qator — x ni reset qilamiz
      } else if (prevX !== null && x - prevX > gapXThreshold) {
        // bir qatorda x differensiya katta bo'lsa, bitta space
        fullText += ' ';
      }

      // Matnni ichida space bilan tugallanmagan bo'lsa so'ngida space qo'shmaymiz —
      // keyin normalizeSpaces baribir yig'adi.
      fullText += str;

      // Gap tugadi deb hisoblasak new line (satr segmentlari ko'payadi — break imkoniyatlari ko'p)
      if (/[.!?:…]$/.test(str)) {
        fullText += '\n';
      } else {
        fullText += ' ';
      }

      prevY = y;
      prevX = x;
    }

    fullText += '\n\n'; // sahifa chegarasi
  }

  // Tozalash
  fullText = normalizeSpaces(fullText);

  // Har bir qatorni hyphenate qilamiz (fallback):
  const lines = fullText.split('\n').map((ln) => normalizeSpaces(hyphenateLine(ln, addZwsp)));
  const hyphenated = lines.join('\n');

  // Sahifalash (so'z bo'yicha)
  const words = hyphenated.split(/\s+/);
  const pages = [];
  for (let i = 0; i < words.length; i += wordsPerPage) {
    pages.push(words.slice(i, i + wordsPerPage).join(' '));
  }

  return pages;
}
