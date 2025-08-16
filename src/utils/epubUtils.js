import ePub from 'epubjs';

const ZWSP = '\u200B'; // zero width space

// 1) Bo'shliqlarni normallashtirish — ZWSP ni O'CHIRMAYMIZ!
function normalizeSpaces(str) {
  return str
    .replace(/&nbsp;/g, ' ')
    // NBSP va turli "narrow space"lar -> odatiy bo'shliq (LEKIN \u200B EMAS!)
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000\uFEFF]/g, ' ')
    // ketma-ket bo'shliqlarni qisqartirish
    .replace(/[ \t]+/g, ' ')
    // qator bosh-oxiridagi bo'shliqlarni silliqlash
    .replace(/ +\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

// 2) Faqat juda UZUN tokenlar ichiga ZWSP kiritamiz (justification yirtilmasin)
function softBreakLongTokens(str, minLen = 18, chunk = 8) {
  // \p{L}\p{N} va "-" dan iborat, ichida bo'shliq yo‘q tokenlar
  const re = new RegExp(`([^\\s-]{${minLen},})`, 'gu');
  return str.replace(re, (m) => {
    // URL/email/yo'llar/datetime ko‘rinishlari — tegmaymiz
    if (/[\\/]|@|https?:/i.test(m)) return m;

    const parts = [];
    for (let i = 0; i < m.length; i += chunk) {
      parts.push(m.slice(i, i + chunk));
    }
    return parts.join(ZWSP);
  });
}

export async function loadFormattedEpubPages(url) {
  const book = ePub(url);
  await book.ready;

  const spineItems = book.spine.spineItems;
  let fullText = '';

  for (let i = 0; i < spineItems.length; i++) {
    const item = spineItems[i];
    try {
      const text = await item.load(book.load.bind(book)).then(() => {
        return item.render().then(() => {
          const doc = item.document;

          // Inline stylelarni olib tashlash (keraksiz spacing ta'sirlarini yo'qotish)
          if (doc) {
            doc.querySelectorAll('*').forEach(el => el.removeAttribute('style'));
          }

          // Faqat oddiy matn
          let rawText = (doc?.body?.innerText || doc?.body?.textContent || '');
          rawText = normalizeSpaces(rawText);
          return rawText;
        });
      });

      fullText += text + ' ';
    } catch (err) {
      console.warn(`[EPUB] Bo‘lim ${i + 1} yuklanmadi:`, err);
    } finally {
      item.unload();
    }
  }

  // Yakuniy tozalash + EHTIYOTKOR soft break
  const cleaned = normalizeSpaces(fullText);
  const withSoftBreaks = softBreakLongTokens(cleaned, 18, 8);

  // Sahifalash (xohishga ko‘ra 150–180)
  const words = withSoftBreaks.split(/\s+/);
  const pages = [];
  for (let i = 0; i < words.length; i += 150) {
    pages.push(words.slice(i, i + 150).join(' '));
  }

  return pages;
}
