import ePub from 'epubjs';

// Yordamchi: har xil "space" va entitylarni 1 dona odatiy bo'shliqqa keltirish
function normalizeSpaces(str) {
  return str
    // HTML entity va turli no-break/narrow bo'shliqlar
    .replace(/&nbsp;/g, ' ')
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
    // ketma-ket whitespace -> bitta bo'shliq
    .replace(/\s+/g, ' ')
    .trim();
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

          // 1) Ichki inline style va formatlarni bekor qilish (ba'zan spacing cho'zilishiga sabab bo'ladi)
          if (doc) {
            doc.querySelectorAll('*').forEach(el => {
              el.removeAttribute('style'); // agressiv lekin bo'shliq muammolarini kesadi
            });
          }

          // 2) Faqat oddiy matnni olamiz (HTML'ni tashlab yuboramiz)
          let rawText = (doc?.body?.innerText || doc?.body?.textContent || '');

          // 3) Matnni normallashtirish
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

  // Yakuniy tozalash
  const cleaned = normalizeSpaces(fullText);

  // 200 so'zdan iborat sahifalarga bo'lish (istasa o‘zgartirishingiz mumkin)
  const words = cleaned.split(/\s+/);
  const pages = [];
  for (let i = 0; i < words.length; i += 150) {
    pages.push(words.slice(i, i + 150).join(' '));
  }

  return pages;
}
