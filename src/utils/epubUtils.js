import ePub from 'epubjs';

export async function loadFormattedEpubPages(url) {
  const book = ePub(url);
  await book.ready;

  const spineItems = book.spine.spineItems; // spine.getSections() o‘rniga mana shu
  let fullText = '';

  for (let i = 0; i < spineItems.length; i++) {
    const item = spineItems[i];
    try {
      const text = await item.load(book.load.bind(book)).then((res) => {
        return item.render().then(() => {
          return item.document.body.textContent;
        });
      });

      fullText += text + '\n\n';
    } catch (err) {
      console.warn(`[EPUB] Bo‘lim ${i + 1} yuklanmadi:`, err);
      continue;
    } finally {
      item.unload(); // resursni bo‘shatish
    }
  }

  // Tozalash va 200ta so‘zdan iborat sahifalarga bo‘lish
  const cleaned = fullText
    .replace(/\s{2,}/g, ' ')
    .replace(/\n\s*/g, '\n')
    .trim();

  const words = cleaned.split(/\s+/);
  const pages = [];

  for (let i = 0; i < words.length; i += 150) {
    pages.push(words.slice(i, i + 150).join(' '));
  }

  return pages;
}
