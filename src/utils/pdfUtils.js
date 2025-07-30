import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/src/pdf-worker.js';

export async function loadFormattedPdfPages(relativeUrl) {
  const url = import.meta.env.BASE_URL + relativeUrl; // ✔️ to‘liq path
  const loadingTask = pdfjsLib.getDocument(url);
  const pdf = await loadingTask.promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    let prevY = null;

    for (const item of content.items) {
      const str = item.str.trim();
      if (!str) continue;

      const y = item.transform[5];
      if (prevY !== null && Math.abs(y - prevY) > 5) {
        fullText += '\n';
      }

      fullText += str + ' ';
      prevY = y;

      if (str.endsWith('.') || str.endsWith(':') || str.endsWith('?') || str.endsWith('!')) {
        fullText += '\n';
      }
    }

    fullText += '\n\n';
  }

  const words = fullText
    .replace(/\s{2,}/g, ' ')
    .replace(/\n\s*/g, '\n')
    .trim()
    .split(' ');

  const pages = [];
  for (let i = 0; i < words.length; i += 150) {
    pages.push(words.slice(i, i + 150).join(' '));
  }

  return pages;
}
