// src/pages/Reader.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadFormattedPdfPages } from '../utils/pdfUtils';
import { useTelegram, tg } from '../hooks/useTelegram';
import SettingsPanel from '../components/SettingsPanel';
import { IoSettingsSharp, IoChevronBack, IoSearchSharp, IoBookmark } from 'react-icons/io5'; // ← bookmark qo'shildi
import './reader.css';

const HL_KEY = (bookId) => `highlights:${bookId}`;

/* ================= HY­PHEN FALLBACK (lotin + kiril) ================= */
const VOWELS_RE = /[aeiouаеёиоуыэюяAEIOUАЕЁИОУЫЭЮЯ]/;
function insertSoftHyphens(word) {
  const MIN_LEN = 8;
  const MIN_CHUNK = 4;
  const MAX_CHUNK = 7;
  if (!word || word.length < MIN_LEN) return word;

  const parts = [];
  let buf = '';
  const isV = (ch) => VOWELS_RE.test(ch);

  for (let i = 0; i < word.length; i++) {
    buf += word[i];
    const prev = word[i - 1] || '';
    const change = (isV(prev) && !isV(word[i])) || (!isV(prev) && isV(word[i]));
    const dblCons = !isV(prev) && !isV(word[i]);
    const longEnough = buf.length >= MIN_CHUNK;
    const tooLong = buf.length >= MAX_CHUNK;

    if ((longEnough && (change || dblCons)) || tooLong) {
      parts.push(buf);
      buf = '';
    }
  }
  if (buf) parts.push(buf);
  return parts.join('\u00AD');
}
function hyphenateVisible(s) {
  if (!s) return s;
  try {
    return s.replace(/[\p{L}\p{M}]{8,}/gu, (w) => insertSoftHyphens(w));
  } catch {
    return s.replace(/\w{8,}/g, (w) => insertSoftHyphens(w));
  }
}
/* ==================================================================== */

const Reader = () => {
  const { user } = useTelegram();
  const navigate = useNavigate();

  const bookId = 'test.pdf';

  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showJumpModal, setShowJumpModal] = useState(false);
  const [jumpInput, setJumpInput] = useState('');
  const [showReadList, setShowReadList] = useState(false);

  // UI settings
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('fontSize');
    return saved ? parseInt(saved, 10) : 16;
  });
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('fontFamily') || 'Times New Roman');
  const [background, setBackground] = useState(() => localStorage.getItem('background') || '#ffffff');
  const [brightness, setBrightness] = useState(() => {
    const saved = localStorage.getItem('brightness');
    return saved ? parseInt(saved, 10) : 100;
  });

  // Yangi tipografiya sozlamalari
  const [pageMargin, setPageMargin] = useState(() => {
    const v = localStorage.getItem('pageMargin');
    return v !== null ? Number(v) : 24;
  });
  const [wordSpacing, setWordSpacing] = useState(() => {
    const v = localStorage.getItem('wordSpacing');
    return v !== null ? Number(v) : 0;
  });
  const [letterSpacing, setLetterSpacing] = useState(() => {
    const v = localStorage.getItem('letterSpacing');
    return v !== null ? Number(v) : 0;
  });

  // Flow (horizontal/vertical)
  const [flow, setFlow] = useState(() => {
    const saved = localStorage.getItem('readFlow');
    return saved === 'vertical' || saved === 'horizontal' ? saved : 'horizontal';
  });
  useEffect(() => { localStorage.setItem('readFlow', flow); }, [flow]);

  // O'qilgan sahifalar
  const [readPages, setReadPages] = useState(() => {
    try {
      const saved = localStorage.getItem(`read-${bookId}`);
      if (!saved) return new Set();
      const arr = JSON.parse(saved);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch { return new Set(); }
  });
  // Drag vaqtida page area balandligini saqlash
  const [pageBoxH, setPageBoxH] = useState(null);

  useEffect(() => {
    localStorage.setItem(`read-${bookId}`, JSON.stringify(Array.from(readPages)));
  }, [readPages, bookId]);

  const openReadList = () => {
    if (document.activeElement?.blur) document.activeElement.blur();
    setShowReadList(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      });
    });
  };

  const totalPages = pages.length;
  const progress = totalPages ? Math.floor((readPages.size / totalPages) * 100) : 0;
  const isCurrentRead = readPages.has(currentPage);

  const markReadUpToCurrent = () => {
    setReadPages(prev => {
      const next = new Set(prev);
      for (let i = 0; i <= currentPage; i++) next.add(i);
      return next;
    });
  };
  const allUpToCurrentRead = (() => {
    for (let i = 0; i <= currentPage; i++) if (!readPages.has(i)) return false;
    return true;
  })();

  const isColorDark = (hex) => {
    try {
      if (!hex) return false;
      let c = hex.replace('#','');
      if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
      const r = parseInt(c.slice(0,2),16);
      const g = parseInt(c.slice(2,4),16);
      const b = parseInt(c.slice(4,6),16);
      const br = (r*299 + g*587 + b*114) / 1000;
      return br < 140;
    } catch { return false; }
  };
  const clearAllRead = () => {
    if (confirm('Barcha o‘qilgan belgilari o‘chirilsinmi?')) setReadPages(new Set());
  };
// 🔎 Qidiruvdan kelgan vaqtinchalik yoritmalar
const [searchFlash, setSearchFlash] = useState({ page: null, ranges: [] });

// matndan q so‘zining barcha joyini (case-insensitive) topish
const findAllRanges = useCallback((text, q) => {
  if (!text || !q) return [];
  const tlc = text.toLowerCase();
  const qlc = q.toLowerCase();
  const out = [];
  let i = 0;
  while (true) {
    const idx = tlc.indexOf(qlc, i);
    if (idx === -1) break;
    out.push({ start: idx, end: idx + q.length });
    i = idx + q.length;
  }
  return out;
}, []);

  // Qidiruv
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [showHighlights, setShowHighlights] = useState(false);
// Bottom sheet/panel ochilganda pastga avtomatik scroll
useEffect(() => {
  // Qaysidir biri ochilganmi?
  const opened = showSettings || showSearch || showReadList || showHighlights;
  if (!opened) return;

  // Window yoki root elementni aniqlab scroll qilamiz
  const root = document.scrollingElement || document.documentElement;

  const tick = () => {
    root.scrollTo({
      top: root.scrollHeight,
      behavior: 'smooth'
    });
  };

  // Kichik delay + rAF — panel DOMga tushib bo‘lsin
  const id = setTimeout(() => {
    requestAnimationFrame(tick);
  }, 50);

  return () => clearTimeout(id);
}, [showSettings, showSearch, showReadList, showHighlights]);


  // Sozlamalarni yuklash/saqlash
  useEffect(() => {
    const s1 = localStorage.getItem('fontSize');
    const s2 = localStorage.getItem('fontFamily');
    const s3 = localStorage.getItem('background');
    const s4 = localStorage.getItem('brightness');
    if (s1) setFontSize(parseInt(s1, 10));
    if (s2) setFontFamily(s2);
    if (s3) setBackground(s3);
    if (s4) setBrightness(parseInt(s4, 10));
  }, []);
  useEffect(() => {
    localStorage.setItem('fontSize', String(fontSize));
    localStorage.setItem('fontFamily', fontFamily);
    localStorage.setItem('background', background);
    localStorage.setItem('brightness', String(brightness));
  }, [fontSize, fontFamily, background, brightness]);

  // Yangi tipografiya LS
  useEffect(() => { localStorage.setItem('pageMargin', String(pageMargin)); }, [pageMargin]);
  useEffect(() => { localStorage.setItem('wordSpacing', String(wordSpacing)); }, [wordSpacing]);
  useEffect(() => { localStorage.setItem('letterSpacing', String(letterSpacing)); }, [letterSpacing]);

  // Sahifalarni yuklash + lastPage
  useEffect(() => {
    tg.ready();
    loadFormattedPdfPages('/books/test.pdf')
      .then((loadedPages) => {
        setPages(loadedPages);
        const savedPage = localStorage.getItem(`lastPage-${bookId}`);
        if (savedPage !== null) {
          const page = parseInt(savedPage, 10);
          if (!isNaN(page) && page >= 0 && page < loadedPages.length) setCurrentPage(page);
        }
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (pages.length > 0) localStorage.setItem(`lastPage-${bookId}`, String(currentPage));
  }, [currentPage, pages]);

  // X overflow guard
  useEffect(() => {
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.overflowX = 'hidden';
    return () => {
      document.body.style.overflowX = '';
      document.documentElement.style.overflowX = '';
    };
  }, []);

  // ======== HIGHLIGHT (YORITMA) ========
  const textWrapRef = useRef(null);
  const [highlights, setHighlights] = useState(() => {
    try {
      const raw = localStorage.getItem(HL_KEY(bookId));
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem(HL_KEY(bookId), JSON.stringify(highlights));
  }, [highlights]);

  const [hlMenu, setHlMenu] = useState({
    visible: false, x: 0, y: 0,
    mode: 'add',           // add | remove
    targetHighlightId: null
  });

  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key === 'Escape') {
        setHlMenu(m => ({ ...m, visible: false }));
        window.getSelection()?.removeAllRanges();
      }
    };
    const onSelectionChange = () => {
      const sel = window.getSelection?.();
      if (!sel || sel.isCollapsed) {
        setHlMenu(m => ({ ...m, visible: false }));
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, []);

  const selectionOffsetsRef = useRef({ start: null, end: null });

// 1) getTextOffset ni null-safe qiling (agar hali shunday bo'lmasa)
const getTextOffset = (root, node, nodeOffset) => {
  let offset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let current;
  while ((current = walker.nextNode())) {
    if (current === node) return offset + nodeOffset;
    offset += (current.nodeValue?.length ?? 0);
  }
  return offset;
};

// 2) Soft-hyphen hisoblagich
const countSoftHyphens = (s) => (s.match(/\u00AD/g) || []).length;

// 3) DOM offset -> RAW offset mapping
const mapDomOffsetsToRaw = (root, startDom, endDom) => {
  const domText = root.textContent || '';
  // start/end dan oldingi \u00AD lar sonini topamiz
  const shStart = countSoftHyphens(domText.slice(0, startDom));
  const shEnd   = countSoftHyphens(domText.slice(0, endDom));
  const startRaw = Math.max(0, startDom - shStart);
  const endRaw   = Math.max(0, endDom - shEnd);
  return { start: startRaw, end: endRaw };
};

// 4) getSelectionOffsetsWithin ni DOM->RAW o'giradigan qilib almashtiring
const getSelectionOffsetsWithin = (root) => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

  // DOM indekslari (hyphenation bilan)
  const domStart = getTextOffset(root, range.startContainer, range.startOffset);
  const domEnd   = getTextOffset(root, range.endContainer,   range.endOffset);
  if (domStart === domEnd) return null;

  const minDom = Math.min(domStart, domEnd);
  const maxDom = Math.max(domStart, domEnd);

  // 🔁 RAW indekslarga o‘tkazamiz (soft-hyphenlarni olib tashlab)
  const { start, end } = mapDomOffsetsToRaw(root, minDom, maxDom);

  return { start, end, rect: range.getBoundingClientRect() };
};

  const addHighlight = (page, start, end, color = '#fff59d') => {
    let ns = Math.min(start, end);
    let ne = Math.max(start, end);

    const text = pages[page] || '';
    const slice = text.slice(ns, ne);
    if (!slice || !slice.trim()) {
      setHlMenu(m => ({ ...m, visible:false }));
      window.getSelection()?.removeAllRanges();
      return;
    }

    setHighlights(prev => {
      const keepOther = prev.filter(h => h.page !== page);
      const samePage  = prev.filter(h => h.page === page);

      for (const h of samePage) {
        if (isCoveredBy(h.start, h.end, ns, ne)) return prev;
      }

      let blocks = [...samePage];
      blocks.push({ id: 'tmp', page, start: ns, end: ne, color });

      const merged = mergePageRanges(blocks.map(({ start, end }) => ({ start, end })));
      const normalized = merged.map(r => ({
        id: `${page}-${r.start}-${r.end}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        page, start: r.start, end: r.end, color
      }));

      return [...keepOther, ...normalized];
    });

    setHlMenu({ visible: false, x: 0, y: 0, mode: 'add', targetHighlightId: null });
    selectionOffsetsRef.current = { start: null, end: null };
    window.getSelection()?.removeAllRanges();
  };
  const removeHighlight = (id) => {
    setHighlights(prev => prev.filter(h => h.id !== id));
    setHlMenu({ visible: false, x: 0, y: 0, mode: 'add', targetHighlightId: null });
  };

  const showAddMenuForSelection = (evt) => {
    if (!textWrapRef.current) return;
    const off = getSelectionOffsetsWithin(textWrapRef.current);
    if (!off) {
      setHlMenu(m => ({ ...m, visible: false }));
      return;
    }
    selectionOffsetsRef.current = { start: off.start, end: off.end };

    const pageRect = document.body.getBoundingClientRect();
    const mx = off.rect.left + off.rect.width / 2 - pageRect.left;
    const my = off.rect.top - pageRect.top - 8;

    setHlMenu({
      visible: true,
      x: Math.max(12, Math.min(window.innerWidth - 12, mx)),
      y: Math.max(12, my),
      mode: 'add',
      targetHighlightId: null
    });
  };
  const showRemoveMenuFor = (event, id) => {
    event.stopPropagation();
    event.preventDefault();
    const r = event.currentTarget.getBoundingClientRect();
    const pageRect = document.body.getBoundingClientRect();
    setHlMenu({
      visible: true,
      x: r.left + r.width / 2 - pageRect.left,
      y: r.top - pageRect.top - 8,
      mode: 'remove',
      targetHighlightId: id
    });
  };

  // 🔔 FLASH indikator uchun state
  const [flashId, setFlashId] = useState(null);
const renderWithHighlights = (text, pageIndex) => {
  // 1) oddiy highlightlar
  const base = highlights
    .filter(h => h.page === pageIndex)
    .map(h => ({ ...h, isFlash: false }));

  // 2) qidiruvdan kelgan vaqtinchalik highlightlar
  const flashes = (searchFlash.page === pageIndex)
    ? searchFlash.ranges.map((r, i) => ({
        id: `sf-${i}`,
        page: pageIndex,
        start: r.start,
        end: r.end,
        color: '#fff1a6',   // iliq sariq
        isFlash: true
      }))
    : [];

  // 3) ikkalasini birga, tartiblab
  const pageHls = [...base, ...flashes].sort((a,b) => a.start - b.start || a.end - b.end);

  if (pageHls.length === 0) return hyphenateVisible(text);

  const out = [];
  let cursor = 0;

  for (const h of pageHls) {
    let s = Math.max(0, Math.min(text.length, h.start));
    let e = Math.max(0, Math.min(text.length, h.end));
    if (e <= cursor) continue;
    if (s < cursor) s = cursor;

    if (cursor < s) out.push(hyphenateVisible(text.slice(cursor, s)));
    out.push(
      <mark
        key={`${h.id}-${s}-${e}`}
        data-block-nav="true"
        onMouseDown={(e)=>e.stopPropagation()}
        onTouchStart={(e)=>e.stopPropagation()}
        onClick={(e)=>!h.isFlash && showRemoveMenuFor(e, h.id)}
        style={{
          background: h.color || '#fff59d',
          padding: '0 0.5px',
          borderRadius: '2px',
          wordSpacing: `${wordSpacing}px`,
          letterSpacing: `${letterSpacing}px`,
          // 🔆 flash bo‘lsa, kuchli “glow”
          outline: h.isFlash ? '2px solid rgba(251, 191, 36, 0.95)' : 'none',
          boxShadow: h.isFlash ? '0 0 0 4px rgba(251, 191, 36, 0.25)' : 'none',
          transition: 'outline 180ms ease, box-shadow 180ms ease',
          cursor: h.isFlash ? 'default' : 'pointer'
        }}
      >
        {hyphenateVisible(text.slice(s, e))}
      </mark>
    );
    cursor = e;
  }
  if (cursor < text.length) out.push(hyphenateVisible(text.slice(cursor)));
  return out;
};


  // ======== HIGHLIGHT HELPERS ========
  const rangesOverlap = (aStart, aEnd, bStart, bEnd) => !(aEnd <= bStart || bEnd <= aStart);
  const isCoveredBy = (outerStart, outerEnd, innerStart, innerEnd) =>
    outerStart <= innerStart && innerEnd <= outerEnd;

  const mergePageRanges = (items) => {
    if (!items.length) return [];
    const sorted = [...items].sort((x, y) => x.start - y.start || x.end - y.end);
    const out = [];
    let cur = { ...sorted[0] };
    for (let i = 1; i < sorted.length; i++) {
      const h = sorted[i];
      if (rangesOverlap(cur.start, cur.end, h.start, h.end) || cur.end === h.start) {
        cur.start = Math.min(cur.start, h.start);
        cur.end   = Math.max(cur.end,   h.end);
      } else {
        out.push(cur);
        cur = { ...h };
      }
    }
    out.push(cur);
    return out;
  };
// 2.2 — Joriy sahifa balandligini o‘lchash (drag yo‘q paytda)
useEffect(() => {
  if (!textWrapRef.current) return;

  const el = textWrapRef.current;

  // Rejim: keyingi paintdan keyin o‘lchash — aniqroq bo‘ladi
  const raf = requestAnimationFrame(() => {
    const h = Math.ceil(el.getBoundingClientRect().height);
    if (h && h !== pageBoxH) setPageBoxH(h);
  });

  // (ixtiyoriy) responsive holatlar uchun resize’ga ham yangilash
  const onResize = () => {
    if (!textWrapRef.current) return;
    const h2 = Math.ceil(textWrapRef.current.getBoundingClientRect().height);
    if (h2 && h2 !== pageBoxH) setPageBoxH(h2);
  };
  window.addEventListener('resize', onResize);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
  };
// Sahifa balandligiga ta’sir qiladigan barcha dependencelar:
}, [currentPage, pages, fontSize, fontFamily, wordSpacing, letterSpacing, pageMargin, flow]);

  /* ====================== SWIPE: FOLLOW-FINGER ====================== */
  const containerRef = useRef(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const draggingAxis = useRef(null); // 'horizontal' | 'vertical' | null
  const pointerActive = useRef(false);

  const [drag, setDrag] = useState({
    active: false,
    delta: 0,           // px
    committing: false,  // transition on
    target: null,       // index
    dir: null,          // 'next' | 'prev'
  });

  const dimsRef = useRef({ w: 0, h: 0 });
  const measure = useCallback(() => {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    dimsRef.current = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  // 🛡️ swipe guard — highlight panelini ham hisobga oldik
  const [hlFilter, setHlFilter] = useState('');
 const guardBlocked = useCallback(
   () => showSettings || showJumpModal || showSearch || showReadList || showHighlights || hlMenu.visible,
   [showSettings, showJumpModal, showSearch, showReadList, showHighlights, hlMenu.visible]
 );
  const shouldBlockFromTarget = (t) =>
    (t?.closest && t.closest('[data-block-nav="true"]')) ? true : false;

  const navBusy = drag.active || drag.committing;

const begin = useCallback((x, y, targetEl) => {
  if (guardBlocked() || navBusy) return;
  if (shouldBlockFromTarget(targetEl)) return;

  // Konteyner o‘lchamini yangilab qo‘yamiz (w/h uchun)
  measure();

  // ✅ DRAG BOSHLANISHIDA: joriy matn balandligini "qotirib" qo'yamiz
  if (textWrapRef.current) {
    const h = Math.ceil(textWrapRef.current.getBoundingClientRect().height);
    if (h) setPageBoxH(h); // <-- 2.1 da yaratgan state’ga yozamiz
  }

  startX.current = x;
  startY.current = y;
  draggingAxis.current = null;

  setDrag(d => ({
    ...d,
    active: true,
    delta: 0,
    committing: false,
    target: null,
    dir: null
  }));
}, [guardBlocked, navBusy, measure]);


  const move = useCallback((x, y) => {
    if (!drag.active || drag.committing) return;
    const dx = x - startX.current;
    const dy = y - startY.current;

    // Axisni aniqlash (deadzone ~8px)
    if (!draggingAxis.current) {
      const ax = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      if ((ax === 'horizontal' && Math.abs(dx) < 8) || (ax === 'vertical' && Math.abs(dy) < 8)) return;
      draggingAxis.current = ax;
    }

    // Faqat tanlangan flow bo'yicha kuzatamiz
    if (flow === 'horizontal' && draggingAxis.current !== 'horizontal') return;
    if (flow === 'vertical' && draggingAxis.current !== 'vertical') return;

    const { w, h } = dimsRef.current;
    const size = flow === 'horizontal' ? w : h;
    const rawDelta = flow === 'horizontal' ? dx : dy;

    // Target sahifa: delta < 0 -> next, > 0 -> prev
    let dir = null;
    let target = null;
    if (rawDelta < 0 && currentPage + 1 < pages.length) {
      dir = 'next'; target = currentPage + 1;
    } else if (rawDelta > 0 && currentPage - 1 >= 0) {
      dir = 'prev'; target = currentPage - 1;
    }

    // Chegarada "rubber-band" (target yo'q bo'lsa)
    let delta = rawDelta;
    if (target === null) delta = rawDelta * 0.35;

    // Clamp (± size)
    const maxShift = size;
    if (delta > maxShift) delta = maxShift;
    if (delta < -maxShift) delta = -maxShift;

    setDrag(d => ({ ...d, delta, target, dir }));
  }, [drag.active, drag.committing, flow, currentPage, pages.length]);
// 2.4 — Commit/Revert tugaganda konteyner balandligini qaytarish
const commitOrRevert = useCallback(() => {
  if (!drag.active || drag.committing) return;

  const { w, h } = dimsRef.current;
  const size = flow === 'horizontal' ? w : h;
  const threshold = Math.max(60, size * 0.2); // 20% yoki 60px

  // Tanlov bo'lgan bo'lsa, menyuni ko'rsatish
  if (textWrapRef.current) {
    setTimeout(() => showAddMenuForSelection(), 0);
  }

  // ✅ COMMIT: threshold oshgan bo'lsa — keyingi/oldingi sahifaga o'tamiz
  if (drag.target != null && Math.abs(drag.delta) >= threshold) {
    // drag qatlamini to'liq yoqqa suramiz
    setDrag(d => ({ ...d, committing: true, delta: d.dir === 'next' ? -size : size }));

    // Transition tugagach sahifani almashtirish va height'ni qaytarish
    const finish = () => {
      setCurrentPage(drag.target);
      setDrag({ active: false, delta: 0, committing: false, target: null, dir: null });
      setPageBoxH(null); // 🔙 height -> auto
    };
    setTimeout(finish, 280); // anim davomiga mos
  } else {
    // ❌ REVERT: threshold yetmadi — orqaga qaytaramiz
    setDrag(d => ({ ...d, committing: true, delta: 0 }));
    setTimeout(() => {
      setDrag({ active: false, delta: 0, committing: false, target: null, dir: null });
      setPageBoxH(null); // 🔙 height -> auto
    }, 240);
  }
}, [
  drag.active, drag.committing, drag.delta, drag.target, drag.dir,
  flow, dimsRef, textWrapRef
]);


  // Touch/Pointer handlerlari
  const onTouchStart = useCallback((e) => {
    const t = e.touches?.[0]; if (!t) return;
    begin(t.clientX, t.clientY, e.target);
  }, [begin]);
  const onTouchMove = useCallback((e) => {
    const t = e.touches?.[0]; if (!t) return;
    move(t.clientX, t.clientY);
  }, [move]);
  const onTouchEnd = useCallback((e) => {
    commitOrRevert();
  }, [commitOrRevert]);

  const onPointerDown = useCallback((e) => {
    pointerActive.current = true;
    begin(e.clientX, e.clientY, e.target);
  }, [begin]);
  const onPointerMove = useCallback((e) => {
    if (!pointerActive.current) return;
    move(e.clientX, e.clientY);
  }, [move]);
  const onPointerUp = useCallback((e) => {
    pointerActive.current = false;
    commitOrRevert();
  }, [commitOrRevert]);

  const jumpInstant = useCallback((toIndex) => {
    if (toIndex < 0 || toIndex >= pages.length || toIndex === currentPage) return;
    // Klaviatura uchun yumshoq animatsiya
    const { w, h } = dimsRef.current;
    const size = flow === 'horizontal' ? w : h;
    const dir = toIndex > currentPage ? 'next' : 'prev';
    const startDelta = dir === 'next' ? -size : size;
    setDrag({ active: true, delta: startDelta, committing: true, target: toIndex, dir });
    setTimeout(() => {
      setCurrentPage(toIndex);
      setDrag({ active: false, delta: 0, committing: false, target: null, dir: null });
    }, 260);
  }, [currentPage, pages.length, flow]);

  const onKeyDown = useCallback((e) => {
    if (guardBlocked() || navBusy) return;
    if (flow === 'horizontal') {
      if (e.key === 'ArrowRight') jumpInstant(currentPage + 1);
      if (e.key === 'ArrowLeft')  jumpInstant(currentPage - 1);
    } else {
      if (e.key === 'ArrowDown')  jumpInstant(currentPage + 1);
      if (e.key === 'ArrowUp')    jumpInstant(currentPage - 1);
    }
    if (e.key.toLowerCase() === 'r') markReadUpToCurrent();
  }, [guardBlocked, navBusy, flow, currentPage, jumpInstant]);

  // Qidiruv
  const makeSnippet = (text, pos, qlen) => {
    const start = Math.max(0, pos - 40);
    const end = Math.min(text.length, pos + qlen + 40);
    const raw = text.slice(start, end).replace(/\s+/g, ' ').trim();
    return `${start > 0 ? '… ' : ''}${raw}${end < text.length ? ' …' : ''}`;
  };
  const runSearch = () => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    setSearching(true);
    const qlc = q.toLowerCase();
    const found = [];
    for (let i = 0; i < pages.length; i++) {
      const t = (pages[i] || '').toString();
      const tlc = t.toLowerCase();
      const idx = tlc.indexOf(qlc);
      if (idx !== -1) found.push({ page: i, snippet: makeSnippet(t, idx, q.length) });
    }
    setResults(found);
    setSearching(false);
  };
const jumpToResult = (p) => {
  const q = query.trim();
  setCurrentPage(p);
  setShowSearch(false);
  setQuery('');
  setResults([]);

  if (q) {
    const ranges = findAllRanges(pages[p] || '', q);
    setSearchFlash({ page: p, ranges });
    // 1.8 soniyadan keyin o‘chirib qo‘yamiz
    setTimeout(() => setSearchFlash({ page: null, ranges: [] }), 1800);
  }
};


  const compactRanges = (arr) => {
    const a = [...new Set(arr)].sort((x, y) => x - y);
    const out = [];
    let s = null, p = null;
    for (const n of a) {
      if (s === null) { s = p = n; continue; }
      if (n === p + 1) { p = n; continue; }
      out.push(s === p ? `${s + 1}` : `${s + 1}–${p + 1}`);
      s = p = n;
    }
    if (s !== null) out.push(s === p ? `${s + 1}` : `${s + 1}–${p + 1}`);
    return out.join(', ');
  };

  if (loading) {
    return (
      <div style={{ position:'fixed', inset:0, background:'#fff', display:'flex', justifyContent:'center', alignItems:'center', fontSize:18, color:'#444', zIndex:9999 }}>
        Yuklanmoqda...
      </div>
    );
  }

  const isDark = isColorDark(background);
  const textMuted = isDark ? '#c9c9c9' : '#666';
  const cardBg = isDark ? '#121212' : '#fff';
  const surface = isDark ? '#2a2a2a' : '#ffffff';
  const border = '#e5e7eb';
  const progressTrack = isDark ? '#333' : '#e5e7eb';
  const progressBar = isDark ? '#f5f5f5' : '#1c1c1c';
  const iconColor = isDark ? '#f5f5f5' : '#111';
  const readArr = Array.from(readPages);

  // Lang autodetect (kiril/lotin)
  const sample = (pages[currentPage] || '').slice(0, 200);
  const isCyr = /[\u0400-\u04FF]/.test(sample);
  const langAttr = isCyr ? 'uz-Cyrl' : 'uz';

  // Spacing clamp
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const safeWordSpacing = clamp(wordSpacing, -0.5, 2);
  const safeLetterSpacing = clamp(letterSpacing, -0.5, 1.5);
  const safePageMargin = clamp(pageMargin, 0, 64);

  const pageTextStyle = {
    whiteSpace: 'pre-wrap',
    lineHeight: '1.8',
    fontSize: `${fontSize}px`,
    fontFamily: fontFamily,
    margin: '0 auto 3.6rem',
    maxWidth: 'clamp(52ch, 92vw, 74ch)',
    padding: `${safePageMargin}px`,
    wordSpacing: `${safeWordSpacing}px`,
    letterSpacing: `${safeLetterSpacing}px`,
    overflowX: 'hidden',
    maxInlineSize: '100%',
    userSelect: 'text',
    textAlign: 'justify',
    textJustify: 'inter-character',
    hyphens: 'auto',
    WebkitHyphens: 'auto',
    overflowWrap: 'break-word',
    wordBreak: 'normal',
    fontKerning: 'normal',
    textWrap: 'pretty',
    backgroundColor: 'transparent',
    borderRadius: '12px',
  };

  // Drag transformlari
  const axis = flow === 'horizontal' ? 'X' : 'Y';
  const { w, h } = dimsRef.current;
  const size = flow === 'horizontal' ? w : h;

  // Preview qatlam transformi (follow-finger)
  let currTransform = `translate${axis}(${drag.active || drag.committing ? drag.delta : 0}px)`;
  let previewTransform = null; // null bo'lsa ko'rsatilmaydi
  let previewIndex = drag.target;

  if ((drag.active || drag.committing) && drag.target != null) {
    const delta = drag.delta;
    if (delta < 0) {
      // next: preview o'ngdan/pastdan keladi -> +size + delta
      previewTransform = `translate${axis}(${size + delta}px)`;
    } else if (delta > 0) {
      // prev: preview chapdan/yuqoridan keladi -> -size + delta
      previewTransform = `translate${axis}(${-size + delta}px)`;
    }
  }

  const transitionStyle = drag.committing ? 'transform 260ms ease' : 'none';
  const layerBase = { position: 'absolute', inset: 0, overflow: 'hidden', willChange: 'transform' };

  // 🔎 Highlightlar paneli uchun helperlar
  const makeHlSnippet = (text, start, end, pad = 40) => {
    const s = Math.max(0, start - pad);
    const e = Math.min(text.length, end + pad);
    const raw = text.slice(s, e).replace(/\s+/g, ' ').trim();
    const head = s > 0 ? '… ' : '';
    const tail = e < text.length ? ' …' : '';
    return `${head}${raw}${tail}`;
  };
  const preparedHls = (() => {
    const arr = [...highlights].sort((a,b) => (a.page - b.page) || (a.start - b.start));
    const mapped = arr.map(h => {
      const text = pages[h.page] || '';
      return { ...h, snippet: makeHlSnippet(text, h.start, h.end) };
    });
    const q = hlFilter.trim().toLowerCase();
    if (!q) return mapped;
    return mapped.filter(x => x.snippet.toLowerCase().includes(q));
  })();

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      tabIndex={0}
      style={{
        backgroundColor: background,
        minHeight: '100vh',
        padding: '1rem',
        fontFamily,
        color: isDark ? '#f0f0f0' : '#222',
        filter: `brightness(${brightness}%)`,
        transition: 'filter 0.3s ease',
        position: 'relative',
        overflowX: 'hidden',
        touchAction: flow === 'horizontal' ? 'pan-y' : 'pan-x', // nav uchun default scrollni bloklash
        overscrollBehavior: 'none',
      }}
      onClick={(e) => {
        if (hlMenu.visible && !e.target.closest?.('[data-hl-menu]')) {
          setHlMenu(m => ({ ...m, visible:false }));
        }
      }}
    >
      {/* TOP BAR (sticky) */}
      <div
        data-block-nav="true"
        style={{
          position:'sticky', top:0, zIndex:50,
          display:'flex', justifyContent:'space-between', alignItems:'center',
          paddingBottom:8, marginTop:-8,

        }}
      >
        <button
          data-block-nav="true"
          onClick={(e)=>{e.stopPropagation(); navigate('/');}}
          title="Orqaga"
          style={{ background:'transparent', border:'none', padding:4, cursor:'pointer' }}
        >
          <IoChevronBack size={24} color={iconColor} />
        </button>

        <button
        
          data-block-nav="true"
          onClick={(e)=>{ e.stopPropagation(); openReadList(); }}
          title="O‘qilgan sahifalar"
          style={{
            fontSize:12, padding:'6px 10px', borderRadius:999, border:`1px solid ${border}`,
            background:isDark?'#1b1b1b':'#f8f8f8', color:isDark?'#f3f4f6':'#111',
            minWidth:44, textAlign:'center', userSelect:'none', cursor:'pointer', marginLeft:'80px'
          }}
        >
          {progress}%
        </button>

        <div data-block-nav="true" style={{ display:'flex', gap:12, alignItems:'center' }}>
          {/* 🔖 Bookmark (highlights) tugma */}
          <button
            data-block-nav="true"
            onClick={(e)=>{ e.stopPropagation(); setShowHighlights(true); }}
            title="Belgilangan joylar"
            style={{ background:'transparent', border:'none', padding:4, cursor:'pointer' }}
          >
            <IoBookmark size={22} color={iconColor} />
          </button>

          <button
            data-block-nav="true"
            onClick={(e)=>{ e.stopPropagation(); setShowSearch(v=>!v); }}
            title="Qidiruv"
            style={{ background:'transparent', border:'none', padding:4, cursor:'pointer' }}
          >
            <IoSearchSharp size={22} color={iconColor} />
          </button>
          <button
            data-block-nav="true"
            onClick={(e)=>{ e.stopPropagation(); setShowSettings(true); }}
            title="Sozlamalar"
            style={{ background:'transparent', border:'none', padding:4, cursor:'pointer' }}
          >
            <IoSettingsSharp size={24} color={iconColor} />
          </button>
        </div>
      </div>

      {/* Progress chiziq */}
      <div data-block-nav="true" style={{ height:4, width:'100%', background:progressTrack, borderRadius:999, overflow:'hidden', margin:'10px 0 12px' }}>
        <div style={{ height:'100%', width:`${progress}%`, background:progressBar, borderRadius:999, transition:'width 220ms ease' }} />
      </div>

      {/* HEADER */}
      {currentPage === 0 ? (
        <div style={{ textAlign:'center', marginBottom:'1rem' }}>
          <h1 style={{ fontSize:'32px', fontWeight:'bold', marginBottom:4, fontFamily }}>Икки Эшик Ораси</h1>
          <h2 style={{ fontSize:'18px', color:textMuted, fontFamily }}>1-БОБ Совуқ хабар</h2>
        </div>
      ) : (
        <div style={{ textAlign:'center', fontWeight:600, marginBottom:'1rem', fontSize:'16px', color:textMuted, fontFamily }}>
          {Math.floor(currentPage / 10) + 1} -БОБ
        </div>
      )}

      {/* ======= PAGE AREA ======= */}
      <div ref={containerRef} style={{ position:'relative', minHeight:'40vh',   height: (drag.active || drag.committing) && pageBoxH ? `${pageBoxH}px` : 'auto', }}>
        {/* Normal holat */}
        {!(drag.active || drag.committing) && (
          <pre
            className="reader-text"
            ref={textWrapRef}
            onMouseUp={(e)=>{ if (textWrapRef.current?.contains(e.target)) showAddMenuForSelection(e); }}
            lang={langAttr}
            style={pageTextStyle}
          >
            {renderWithHighlights(pages[currentPage] || '', currentPage)}
          </pre>
        )}

        {/* Drag/Commit holatida: ikki qatlam */}
        {(drag.active || drag.committing) && (
          <>
            {/* joriy qatlam (dragga ergashadi) */}
            <div style={{ ...layerBase, transform: currTransform, transition: transitionStyle }}>
              <pre className="reader-text" lang={langAttr} style={pageTextStyle} ref={textWrapRef}>
                {renderWithHighlights(pages[currentPage] || '', currentPage)}
              </pre>
            </div>

            {/* preview qatlam (keyingi/oldingi) */}
            {previewIndex != null && (
              <div style={{ ...layerBase, transform: previewTransform, transition: transitionStyle }}>
                <pre className="reader-text" lang={langAttr} style={pageTextStyle}>
                  {renderWithHighlights(pages[previewIndex] || '', previewIndex)}
                </pre>
              </div>
            )}
          </>
        )}
      </div>

      {/* HIGHLIGHT MENYUSI */}
      {hlMenu.visible && (
        <div
          data-hl-menu
          data-block-nav="true"
          onClick={(e)=>e.stopPropagation()}
          onMouseDown={(e)=>e.stopPropagation()}
          onTouchStart={(e)=>e.stopPropagation()}
          style={{
            position:'absolute',
            left: Math.max(12, Math.min(window.innerWidth - 12, hlMenu.x)) - 58,
            top:  Math.max(12, hlMenu.y),
            zIndex:1500,
            background: isDark ? '#1f2937' : '#111827',
            color:'#fff',
            borderRadius: 12,
            boxShadow:'0 8px 24px rgba(0,0,0,0.25)',
            padding:'6px',
            display:'flex',
            gap:6,
            alignItems:'center'
          }}
        >
          {hlMenu.mode === 'add' ? (
            <>
              <button
                data-block-nav="true"
                onClick={(e)=>{ 
                  e.stopPropagation(); 
                  const { start, end } = selectionOffsetsRef.current;
                  if (start !== null && end !== null) addHighlight(currentPage, start, end, '#fff59d');
                }}
                style={{ border:'none', background:'#FFD54F', color:'#111', borderRadius:8, padding:'6px 10px', fontSize:13, cursor:'pointer' }}
                title="Highlight"
              >
                Highlight
              </button>
              <button
                data-block-nav="true"
                onClick={(e)=>{ e.stopPropagation(); window.getSelection()?.removeAllRanges(); setHlMenu(m=>({ ...m, visible:false })); }}
                style={{ border:'1px solid #374151', background:'transparent', color:'#fff', borderRadius:8, padding:'6px 10px', fontSize:13, cursor:'pointer' }}
              >
                Bekor
              </button>
            </>
          ) : (
            <>
              <button
                data-block-nav="true"
                onClick={(e)=>{ e.stopPropagation(); if (hlMenu.targetHighlightId) removeHighlight(hlMenu.targetHighlightId); }}
                style={{ border:'none', background:'#ef4444', color:'#fff', borderRadius:8, padding:'6px 10px', fontSize:13, cursor:'pointer' }}
                title="O‘chirish"
              >
                O‘chirish
              </button>
              <button
                data-block-nav="true"
                onClick={(e)=>{ e.stopPropagation(); setHlMenu(m=>({ ...m, visible:false })); }}
                style={{ border:'1px solid #374151', background:'transparent', color:'#fff', borderRadius:8, padding:'6px 10px', fontSize:13, cursor:'pointer' }}
              >
                Yopish
              </button>
            </>
          )}
        </div>
      )}

      {/* "O‘qildi" tugmasi */}
      <button
        data-block-nav="true"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); markReadUpToCurrent(); }}
        title={
          allUpToCurrentRead
            ? 'Bu sahifagacha hammasi allaqachon belgilangan'
            : `0–${currentPage + 1} o'qildi deb belgilash`
        }
        style={{
          position: 'fixed', right: 10, bottom: 18, zIndex: 600,
          padding: '10px 12px', borderRadius: 999, border: `1px solid ${border}`,
          background: isCurrentRead ? (isDark ? '#15361c' : '#e8f5ee') : (isDark ? '#1b1b1b' : '#f8f8f8'),
          color: isCurrentRead ? (isDark ? '#c1f2d3' : '#0f5132') : (isDark ? '#f5f5f5' : '#111'),
          fontSize: 13, boxShadow: '0 2px 6px rgba(0,0,0,0.12)', cursor: 'pointer', userSelect:'none',
        }}
      >
        {isCurrentRead ? 'O‘qilgan' : 'O‘qildi belgilash'}
      </button>

      {/* PAGE INDICATOR */}
      <div
        data-block-nav="true"
        onClick={(e) => { e.stopPropagation(); setShowJumpModal(true); }}
        style={{
          position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)',
          textAlign:'center', zIndex:500, fontSize:14, color:textMuted, cursor:'pointer',
          backgroundColor: isDark ? '#2b2b2b' : '#f2f2f2', padding:'6px 12px', borderRadius:'12px',
          maxWidth:'160px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          boxShadow:'0 2px 6px rgba(0,0,0,0.1)', userSelect:'none',
        }}
      >
        {currentPage + 1} / {pages.length}
      </div>

      {/* READ LIST, SEARCH, JUMP MODAL, SETTINGS */}
      {showSearch && (
        <>
          <div className="search-overlay" data-block-nav="true" onClick={() => setShowSearch(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:1390 }} />
          <div className="search-panel" data-block-nav="true"
            onClick={(e)=>e.stopPropagation()} onTouchStart={(e)=>e.stopPropagation()} onTouchMove={(e)=>e.stopPropagation()} onTouchEnd={(e)=>e.stopPropagation()}
            onPointerDown={(e)=>e.stopPropagation()} onPointerMove={(e)=>e.stopPropagation()} onPointerUp={(e)=>e.stopPropagation()}
            style={{ position:'fixed', left:0, right:0, bottom:0, background:surface, borderTopLeftRadius:24, borderTopRightRadius:24, boxShadow:'0 -8px 24px rgba(0,0,0,0.18)', padding:'14px 14px 18px', zIndex:1400, maxHeight:'70vh', overflowY:'auto', WebkitOverflowScrolling:'touch' }}>
            <div style={{ display:'flex', gap:8 }}>
              <input data-block-nav="true" value={query} onChange={(e)=>setQuery(e.target.value)} onKeyDown={(e)=>{ if (e.key === 'Enter') runSearch(); }} placeholder="Matndan qidirish… (Enter)"
                style={{ flex:1, padding:'10px 12px', borderRadius:10, border:'1px solid #d1d5db', outline:'none', fontSize:14, background:isDark?'#1c1c1c':'#fff', color:isDark?'#f5f5f5':'#111' }}/>
              <button data-block-nav="true" onClick={(e)=>{ e.stopPropagation(); runSearch(); }} style={{ padding:'10px 12px', borderRadius:10, border:'1px solid #d1d5db', background:'#1c1c1c', color:'#fff', cursor:'pointer', fontSize:14 }}>Qidir</button>
            </div>
            <div style={{ marginTop:8, fontSize:12, color:'#6b7280' }}>
              {searching ? 'Qidirilmoqda…' : (results.length ? `${results.length} ta sahifa topildi` : (query ? 'Hech narsa topilmadi' : ''))}
            </div>
            {!!results.length && (
              <div data-block-nav="true" style={{ marginTop:8, borderTop:`1px dashed ${border}`, maxHeight:'48vh', overflow:'auto', paddingTop:8 }}>
                {results.map((r, idx) => (
                  <button key={`${r.page}-${idx}`} data-block-nav="true" onClick={(e)=>{ e.stopPropagation(); jumpToResult(r.page); setShowSearch(false); }}
                    style={{ width:'100%', textAlign:'left', padding:'10px 8px', borderRadius:10, border:`1px solid ${border}`, background:cardBg, color:isDark?'#f3f4f6':'#111', cursor:'pointer', marginBottom:8 }}>
                    <div style={{ fontSize:12, color:'#9ca3af', marginBottom:4 }}>Sahifa {r.page + 1}</div>
                    <div style={{ fontSize:14, lineHeight:1.4 }}>{r.snippet}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {showReadList && (
        <>
          <div className="readlist-overlay" data-block-nav="true" onClick={() => setShowReadList(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:1200 }} />
          <div className="readlist-panel" data-block-nav="true"
            onClick={(e)=>e.stopPropagation()} onTouchStart={(e)=>e.stopPropagation()} onTouchMove={(e)=>e.stopPropagation()} onTouchEnd={(e)=>e.stopPropagation()}
            onPointerDown={(e)=>e.stopPropagation()} onPointerMove={(e)=>e.stopPropagation()} onPointerUp={(e)=>e.stopPropagation()}
            style={{ position:'fixed', bottom:0, left:0, right:0, background:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, boxShadow:'0 -8px 24px rgba(0,0,0,0.18)', padding:'16px 16px 20px', zIndex:1300, maxHeight:'75vh', overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <div style={{ fontWeight:700, fontSize:16, color:'#111' }}>O‘qilganlar ({readArr.length} sahifa)</div>
              <button data-block-nav="true" onClick={(e)=>{ e.stopPropagation(); clearAllRead(); }}
                style={{ background:'#561818ff', border:'1px solid #eee', borderRadius:10, padding:'6px 10px', fontSize:12, cursor:'pointer' }}>
                Tozalash
              </button>
            </div>
              <div style={{ fontSize:13, color:'#555', background:'#f7f7f7', border:'1px solid #eee', borderRadius:10, padding:'8px 10px', marginBottom:10, lineHeight:1.5 }}>
                {readArr.length ? compactRanges(readArr) : 'Hali sahifalar belgilanmagan'}
              </div>
            {!!readArr.length && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {readArr.sort((a,b)=>a-b).map((p)=>(
                  <button key={p} data-block-nav="true" onClick={(e)=>{ e.stopPropagation(); setCurrentPage(p); setShowReadList(false); }}
                    style={{ padding:'8px 10px', borderRadius:999, border:'1px solid #e5e7eb', background:'#fafafa', cursor:'pointer', fontSize:12, color:'#111' }}
                    title={`Sahifa ${p+1}`}>{p+1}</button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* 🔖 HIGHLIGHTS PANEL (Bottom Sheet) */}
      {showHighlights && (
        <>
          <div
            className="hl-overlay"
            data-block-nav="true"
            onClick={() => setShowHighlights(false)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:1450 }}
          />
          <div
            className="hl-panel"
            data-block-nav="true"
            onClick={(e)=>e.stopPropagation()}
            onTouchStart={(e)=>e.stopPropagation()}
            onTouchMove={(e)=>e.stopPropagation()}
            onTouchEnd={(e)=>e.stopPropagation()}
            onPointerDown={(e)=>e.stopPropagation()}
            onPointerMove={(e)=>e.stopPropagation()}
            onPointerUp={(e)=>e.stopPropagation()}
            style={{
              position:'fixed', left:0, right:0, bottom:0, zIndex:1460,
              background: surface, borderTopLeftRadius:24, borderTopRightRadius:24,
              boxShadow:'0 -8px 24px rgba(0,0,0,0.18)', padding:'14px 14px 18px',
              maxHeight:'75vh', overflowY:'auto', WebkitOverflowScrolling:'touch'
            }}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ fontWeight:700, fontSize:16 }}>{`Belgilangan joylar (${preparedHls.length})`}</div>
              <button
                data-block-nav="true"
                onClick={() => setShowHighlights(false)}
                style={{ fontSize:12, border:'1px solid #e5e7eb', background:isDark?'#1b1b1b':'#f8f8f8', borderRadius:10, padding:'6px 10px', cursor:'pointer' }}
              >
                Yopish
              </button>
            </div>

            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              <input
                data-block-nav="true"
                value={hlFilter}
                onChange={(e)=>setHlFilter(e.target.value)}
                placeholder="Belgilanganlardan qidirish…"
                style={{ flex:1, padding:'10px 12px', borderRadius:10, border:'1px solid #d1d5db', outline:'none', fontSize:14,
                         background:isDark?'#1c1c1c':'#fff', color:isDark?'#f5f5f5':'#111' }}
              />
              {hlFilter && (
                <button
                  data-block-nav="true"
                  onClick={()=>setHlFilter('')}
                  style={{ padding:'10px 12px', borderRadius:10, border:'1px solid #d1d5db', background:'#e5e7eb', cursor:'pointer', fontSize:14 }}
                >
                  Toza
                </button>
              )}
            </div>

            {preparedHls.length === 0 ? (
              <div style={{ fontSize:13, color:'#6b7280' }}>Hali belgilangan joy yo‘q.</div>
            ) : (
              <div style={{ display:'grid', gap:8 }}>
                {preparedHls.map((h) => (
                  <button
                    key={h.id}
                    data-block-nav="true"
                    onClick={() => {
                      setShowHighlights(false);
                      setCurrentPage(h.page);
                      // mark DOMga tushishi uchun kichik delay va flash
                      setTimeout(() => { setFlashId(h.id); setTimeout(()=>setFlashId(null), 900); }, 50);
                    }}
                    style={{
                      textAlign:'left', border:`1px solid ${border}`, background:cardBg,
                      color:isDark?'#f3f4f6':'#111', borderRadius:12, padding:'10px 12px', cursor:'pointer'
                    }}
                    title={`Sahifa ${h.page + 1}`}
                  >
                    <div style={{ fontSize:12, color:'#9ca3af', marginBottom:4 }}>
                      Sahifa {h.page + 1}
                    </div>
                    <div style={{ fontSize:14, lineHeight:1.5 }}>
                      {h.snippet}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {showJumpModal && (
        <div onClick={() => setShowJumpModal(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div data-block-nav="true"
            onClick={(e)=>e.stopPropagation()} onTouchStart={(e)=>e.stopPropagation()} onTouchMove={(e)=>e.stopPropagation()} onTouchEnd={(e)=>e.stopPropagation()}
            onPointerDown={(e)=>e.stopPropagation()} onPointerMove={(e)=>e.stopPropagation()} onPointerUp={(e)=>e.stopPropagation()}
            style={{ background:'#fff', paddingBottom:'14px', borderRadius:'16px', width:'100%', maxWidth:'340px', boxShadow:'0 8px 24px rgba(0,0,0,0.2)', textAlign:'center', transition:'all 0.3s ease' }}>
            <h3 style={{ marginBottom:'1rem', fontSize:'18px', fontWeight:600, color:'#222' }}>
              Sahifa: {currentPage + 1} / {pages.length}
            </h3>
            <input data-block-nav="true" type="number" placeholder="Sahifa raqamini kiriting" value={jumpInput}
              onChange={(e)=>setJumpInput(e.target.value)}
              onKeyDown={(e)=>{ if (e.key==='Enter'){ const p=parseInt(jumpInput,10); if(!isNaN(p)&&p>=1&&p<=pages.length){ setCurrentPage(p-1); setShowJumpModal(false); setJumpInput(''); }}}}
              style={{ width:'200px', padding:'10px 12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'15px', background:'#f9f9f9', color:'#333', outline:'none', transition:'all 0.2s ease' }}/>
            <p style={{ marginTop:8, fontSize:12, color:'#999' }}>Enter tugmasini bosing</p>
          </div>
        </div>
      )}

      {showSettings && (
        <>
          <div className="settings-overlay" data-block-nav="true" onClick={() => setShowSettings(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:1390 }} />
          <div className="settings-panel" data-block-nav="true"
            onClick={(e)=>e.stopPropagation()} onTouchStart={(e)=>e.stopPropagation()} onTouchMove={(e)=>e.stopPropagation()} onTouchEnd={(e)=>e.stopPropagation()}
            onPointerDown={(e)=>e.stopPropagation()} onPointerMove={(e)=>e.stopPropagation()} onPointerUp={(e)=>e.stopPropagation()}
            style={{ position:'fixed', bottom:0, left:0, right:0, background:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, boxShadow:'0 -8px 24px rgba(0,0,0,0.18)', padding:'20px', zIndex:1400, maxHeight:'90vh', overflowY:'auto', transition:'transform 0.3s ease' }}>
            <SettingsPanel
              fontSize={fontSize}
              setFontSize={setFontSize}
              fontFamily={fontFamily}
              setFontFamily={setFontFamily}
              background={background}
              setBackground={setBackground}
              brightness={brightness}
              setBrightness={setBrightness}
              flow={flow}
              setFlow={setFlow}
              onClose={() => setShowSettings(false)}
              pageMargin={pageMargin}
              setPageMargin={setPageMargin}
              wordSpacing={wordSpacing}
              setWordSpacing={setWordSpacing}
              letterSpacing={letterSpacing}
              setLetterSpacing={setLetterSpacing}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default Reader;
