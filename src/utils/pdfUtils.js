// src/utils/pdfUtils.js
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker.js';

const ZWSP = '\u200B'; // Zero-width space (ko‘rinmaydi, lekin break beradi)

// --- Bo'shliqlarni normallashtirish (ZWSP-ni o‘chirmaymiz) ---
function normalizeSpaces(str) {
  return str
    .replace(/&nbsp;/g, ' ')
    // NBSP va turli narrow space’lar -> oddiy bo‘shliq (LEKIN \u200B EMAS!)
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000\uFEFF]/g, ' ')
    .replace(/[ \t]+/g, ' ')   // ketma-ket bo‘shliqlar
    .replace(/ +\n/g, '\n')    // qator bosh-oxirini silliqlash
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

// --- Juda uzun tokenlar ichiga ehtiyotkor ZWSP kiritish ---
function softBreakLongTokens(str, minLen = 18, chunk = 8) {
  const re = new RegExp(`([^\\s-]{${minLen},})`, 'gu'); // bo‘shliq ham, '-' ham yo‘q
  return str.replace(re, (m) => {
    // URL/email/path/time kabi ifodalarga tegmaymiz
    if (/[\\/]|@|https?:/i.test(m)) return m;
    const parts = [];
    for (let i = 0; i < m.length; i += chunk) parts.push(m.slice(i, i + chunk));
    return parts.join(ZWSP);
  });
}

// --- PDF matnini tozalovchi asosiy post-process ---
function postProcessPdfText(raw) {
  if (!raw) return '';

  let s = raw;

  // 1) Unicode normalization (stabil)
  try { s = s.normalize('NFC'); } catch {}

  // 2) Ligaturalar
  s = s.replace(/\uFB01/g, 'fi').replace(/\uFB02/g, 'fl');

  // 3) Oldindan silliqlash
  s = normalizeSpaces(s);

  // 4) Hyphen bilan qator uzilishi: "so-\n'z" -> "soz"
  //    Faqat keyingi belgining kichik harf ekanini tekshiramiz (lotin/kiril)
  s = s.replace(/-\s*\n\s*(?=\p{Ll})/gu, '');

  // 5) Paragraf chegarasini saqlab qolamiz:
  //    - Ikki va undan ortiq \n -> paragraf markeri
  //    - Yolg‘iz \n -> bo‘shliq (gap ichida)
  s = s.replace(/\n{2,}/g, '¶¶'); // vaqtinchalik marker
  s = s.replace(/\n/g, ' ');
  s = s.replace(/¶¶/g, '\n\n');

  // 6) Punktuatsiya oldidan bo‘shliqni olib tashlash
  s = s.replace(/\s+([.,!?;:»”’])/g, '$1');

  // 7) Ko‘p bo‘shliqni bitta bo‘shliqqa keltirish
  s = s.replace(/[ \t]{2,}/g, ' ');

  // 8) Chekka bo‘shliqlar
  s = s.trim();

  return s;
}

// --- Sahifalash (so‘z soni bo‘yicha) ---
function paginateByWords(text, wordsPerPage = 150) {
  const words = text.split(/\s+/);
  const pages = [];
  for (let i = 0; i < words.length; i += wordsPerPage) {
    pages.push(words.slice(i, i + wordsPerPage).join(' '));
  }
  return pages;
}

export async function loadFormattedPdfPages(url) {
  const loadingTask = pdfjsLib.getDocument(url);
  const pdf = await loadingTask.promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    let prevY = null;
    let lineBuf = '';

    for (const item of content.items) {
      let str = (item.str || '').trim();
      if (!str) continue;

      // Y koordinata sezilarli o‘zgarsa — yangi qatorga o‘tamiz
      const y = item.transform?.[5] ?? null;
      if (prevY !== null && y !== null && Math.abs(y - prevY) > 5) {
        if (lineBuf.trim()) {
          fullText += lineBuf.trim() + '\n';
          lineBuf = '';
        }
      }
      prevY = y;

      // So‘zlar orasida bitta bo‘shliq
      if (lineBuf && !lineBuf.endsWith(' ') && !str.startsWith(' ')) lineBuf += ' ';
      lineBuf += str;

      // Gap tugashi ehtimoli — ozroq konservativ: faqat satr oxiri emas, matn oqimi
      if (/[.?!:…]$/.test(str)) {
        fullText += lineBuf.trim() + '\n';
        lineBuf = '';
      }
    }

    // Sahifa oxiri
    if (lineBuf.trim()) {
      fullText += lineBuf.trim() + '\n';
      lineBuf = '';
    }

    // Sahifalar orasiga bo‘sh qator (paragraf ko‘rinishida)
    fullText += '\n';
  }

  // --- Post-process + ehtiyotkor ZWSP ---
  const cleaned = postProcessPdfText(fullText);
  const withSoftBreaks = softBreakLongTokens(cleaned, 18, 8);

  // --- Sahifalash (so‘z bo‘yicha) ---
  const pages = paginateByWords(withSoftBreaks, 100);

  return pages;
}
