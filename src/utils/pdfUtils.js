import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker.js';



export async function loadFormattedPdfPages(url) {
  const loadingTask = pdfjsLib.getDocument(url);
  const pdf = await loadingTask.promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    let prevY = null;

    for (const item of content.items) {
      const str = item.str.trim();

      // ➤ Skip bo‘sh string
      if (!str) continue;

      // ➤ Yangi qator aniqlash: pozitsiya (transform[5]) o‘zgargan bo‘lsa
      const y = item.transform[5];
      if (prevY !== null && Math.abs(y - prevY) > 5) {
        fullText += '\n';
      }

      fullText += str + ' ';
      prevY = y;

      // ➤ Dialog belgisi alohida yangi qatorga o‘tkazilishi uchun
      if (str.endsWith('.') || str.endsWith(':') || str.endsWith('?') || str.endsWith('!')) {
        fullText += '\n';
      }
    }

    fullText += '\n\n'; // Sahifani tugatish
  }

  // ➤ Sahifalarga ajratish: har 200 so‘zda bitta sahifa
  const words = fullText
    .replace(/\s{2,}/g, ' ')
    .replace(/\n\s*/g, '\n') // Yangi qatordan keyingi bo‘sh joylarni olib tashlash
    .trim()
    .split(' ');

  const pages = [];
  for (let i = 0; i < words.length; i += 150) {
    pages.push(words.slice(i, i + 150).join(' '));
  }

  return pages;
}
