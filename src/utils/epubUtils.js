import ePub from 'epubjs';

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
          let rawText = item.document.body.innerText || item.document.body.textContent || '';

          // HTML entity va keraksiz bo‘sh joylarni tozalash
          rawText = rawText
            .replace(/&nbsp;/g, ' ')        // HTML no-break space → oddiy space
            .replace(/\u00A0/g, ' ')        // Unicode no-break space → oddiy space
            .replace(/\s+/g, ' ')           // Ketma-ket bo‘sh joylarni 1 space
            .replace(/\n\s*/g, '\n')        // Keraksiz bo‘sh qatordan keyin bo‘sh joylarni olib tashlash
            .replace(/\r/g, '')             // Keraksiz \r belgilarini olib tashlash
            .replace(/[ ]{2,}/g, ' ');      // 2 yoki undan ortiq bo‘sh joy → 1 space

          return rawText.trim();
        });
      });

      fullText += text + ' ';
    } catch (err) {
      console.warn(`[EPUB] Bo‘lim ${i + 1} yuklanmadi:`, err);
      continue;
    } finally {
      item.unload();
    }
  }

  // Yakuniy tozalash
  const cleaned = fullText
    .replace(/\s+/g, ' ')
    .trim();

  // 200 so‘zdan iborat sahifalarga bo‘lish
  const words = cleaned.split(/\s+/);
  const pages = [];

  for (let i = 0; i < words.length; i += 150) {
    pages.push(words.slice(i, i + 150).join(' '));
  }

  return pages;
}
