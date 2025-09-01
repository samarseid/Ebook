// src/pages/ReaderEpub.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadFormattedEpubPages } from '../utils/epubUtils';
import { useTelegram, tg } from '../hooks/useTelegram';
import SettingsPanel from '../components/SettingsPanel';
import { IoSettingsSharp, IoChevronBack, IoSearchSharp, IoBookmark } from 'react-icons/io5';
const HL_KEY = (bookId) => `highlights:${bookId}`;

/* ================= HY­PHEN FALLBACK (lotin + kiril) ================= */
const VOWELS_RE = /[aeiouаеёиоуыэюяAEIOUАЕЁИОУЫЭЮЯ]/;
function insertSoftHyphens(word) {
  const MIN_LEN = 8, MIN_CHUNK = 4, MAX_CHUNK = 7;
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
    if ((longEnough && (change || dblCons)) || tooLong) { parts.push(buf); buf = ''; }
  }
  if (buf) parts.push(buf);
  return parts.join('\u00AD');
}
function hyphenateVisible(s) {
  if (!s) return s;
  try { return s.replace(/[\p{L}\p{M}]{8,}/gu, (w) => insertSoftHyphens(w)); }
  catch { return s.replace(/\w{8,}/g, (w) => insertSoftHyphens(w)); }
}
/* ==================================================================== */

/* ====================== Anchored Modal (Reusable) ====================== */
function useViewport() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return vp;
}
function rectFrom(el) {
  if (!el || !el.getBoundingClientRect) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height, x: r.x, y: r.y };
}
function fallbackAnchor(offsetTop = 80) {
  const w = Math.min(720, window.innerWidth * 0.92);
  return { top: offsetTop, bottom: offsetTop, left: (window.innerWidth - w) / 2, right: (window.innerWidth + w) / 2, width: w, height: 0, x: (window.innerWidth - w) / 2, y: offsetTop };
}

const AnchoredModal = ({
  open, onClose, anchorRect, prefer = 'below', maxW = 720, maxH = 0.8,
  background = '#fff', zIndex = 1400, children, isDark = false, border = '#e5e7eb'
}) => {
  const panelRef = useRef(null);
  const { w: vw, h: vh } = useViewport();
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, transformOrigin: 'top center' });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) { setReady(false); return; }
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current; if (!panel) return;
      const margin = 12;
      const usableMaxW = Math.min(maxW, vw - margin * 2);
      const cssMaxH = typeof maxH === 'number' && maxH < 1
        ? Math.floor(vh * maxH)
        : (typeof maxH === 'number' ? Math.floor(Math.min(maxH, vh - margin * 2)) : Math.floor(vh * 0.8));
      panel.style.visibility = 'hidden';
      panel.style.maxWidth = `${usableMaxW}px`;
      panel.style.maxHeight = `${cssMaxH}px`;
      panel.style.width = 'auto';
      const pw = Math.min(panel.scrollWidth, usableMaxW);
      const ph = Math.min(panel.scrollHeight, cssMaxH);

      const a = anchorRect || fallbackAnchor(80);
      const anchorCenterX = a.left + (a.width || 0) / 2;
      let left = Math.round(anchorCenterX - pw / 2);
      left = Math.max(margin, Math.min(left, vw - pw - margin));
      let topCandidateBelow = Math.round((a.bottom || a.top) + 8);
      let topCandidateAbove = Math.round((a.top || a.bottom) - ph - 8);
      const spaceBelow = vh - (a.bottom || a.top);
      const spaceAbove = (a.top || a.bottom);
      const canBelow = spaceBelow >= ph + margin;
      const canAbove = spaceAbove >= ph + margin;

      let top, origin;
      if (prefer === 'below') {
        if (canBelow || (!canAbove && spaceBelow >= spaceAbove)) { top = Math.min(topCandidateBelow, vh - ph - margin); origin = 'top center'; }
        else { top = Math.max(margin, topCandidateAbove); origin = 'bottom center'; }
      } else {
        if (canAbove || (!canBelow && spaceAbove >= spaceBelow)) { top = Math.max(margin, topCandidateAbove); origin = 'bottom center'; }
        else { top = Math.min(topCandidateBelow, vh - ph - margin); origin = 'top center'; }
      }
      top = Math.max(margin, Math.min(top, vh - ph - margin));
      setPos({ top, left, width: pw, transformOrigin: origin });
      panel.style.visibility = '';
      setReady(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [open, anchorRect, vw, vh, maxW, maxH]);

  if (!open) return null;
  return (
    <>
      <div data-block-nav="true" onClick={onClose}
        style={{ position:'fixed', inset:0, zIndex: zIndex - 10, background:'rgba(0,0,0,0.28)', backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)' }} />
      <div ref={panelRef} data-block-nav="true" role="dialog" aria-modal="true" onClick={(e)=>e.stopPropagation()}
        style={{
          position:'fixed', top:pos.top, left:pos.left,
          width: pos.width ? pos.width : 'auto',
          maxWidth: Math.min(maxW, vw - 24),
          maxHeight: typeof maxH === 'number' && maxH < 1 ? `${Math.floor(vh * maxH)}px` : (typeof maxH === 'number' ? `${Math.min(maxH, vh - 24)}px` : `${Math.floor(vh * 0.8)}px`),
          zIndex, background, color: isDark ? '#f3f4f6' : '#111',
          borderRadius:16, boxShadow:'0 12px 36px rgba(0,0,0,0.24)', border:`1px solid ${border}`,
          overflowY:'auto', WebkitOverflowScrolling:'touch', padding:14,
          transformOrigin: pos.transformOrigin, transform: ready ? 'scale(1)' : 'scale(0.98)', opacity: ready ? 1 : 0,
          transition:'opacity 120ms ease, transform 120ms ease'
        }}>
        {children}
      </div>
    </>
  );
};
/* ===================================================================== */

const ReaderEpub = () => {
  const { user } = useTelegram();
  const navigate = useNavigate();

 const bookId = 'test2.epub';

  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Panels
  const [showSettings, setShowSettings] = useState(false);
  const [showJumpModal, setShowJumpModal] = useState(false);
  const [jumpInput, setJumpInput] = useState('');
  const [showReadList, setShowReadList] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);

  // Anchors
  const [anchorSettings, setAnchorSettings] = useState(null);
  const [anchorSearch, setAnchorSearch] = useState(null);
  const [anchorReadList, setAnchorReadList] = useState(null);
  const [anchorHighlights, setAnchorHighlights] = useState(null);

  // UI
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('fontSize') || '16', 10));
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('fontFamily') || 'Times New Roman');
  const [background, setBackground] = useState(() => localStorage.getItem('background') || '#ffffff');
  const [brightness, setBrightness] = useState(() => parseInt(localStorage.getItem('brightness') || '100', 10));

  // Typography
  const [pageMargin, setPageMargin] = useState(() => Number(localStorage.getItem('pageMargin') ?? 24));
  const [wordSpacing, setWordSpacing] = useState(() => Number(localStorage.getItem('wordSpacing') ?? 0));
  const [letterSpacing, setLetterSpacing] = useState(() => Number(localStorage.getItem('letterSpacing') ?? 0));

  // Flow
  const [flow, setFlow] = useState(() => {
    const saved = localStorage.getItem('readFlow');
    return saved === 'vertical' || saved === 'horizontal' ? saved : 'horizontal';
  });
  useEffect(() => { localStorage.setItem('readFlow', flow); }, [flow]);

  // Read flags
  const [readPages, setReadPages] = useState(() => {
    try {
      const saved = localStorage.getItem(`read-${bookId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  useEffect(() => {
    localStorage.setItem(`read-${bookId}`, JSON.stringify(Array.from(readPages)));
  }, [readPages, bookId]);

  const totalPages = pages.length;
  const progress = totalPages ? Math.floor((readPages.size / totalPages) * 100) : 0;
  const isCurrentRead = readPages.has(currentPage);

  const markReadUpTo = (toIdx) => {
    if (toIdx == null || toIdx < 0) return;
    setReadPages(prev => {
      const next = new Set(prev);
      for (let i = 0; i <= Math.min(toIdx, pages.length - 1); i++) next.add(i);
      return next;
    });
  };
  const markReadUpToCurrent = () => markReadUpTo(currentPage);

  const allUpToCurrentRead = (() => { for (let i = 0; i <= currentPage; i++) if (!readPages.has(i)) return false; return true; })();

  const isColorDark = (hex) => {
    try {
      if (!hex) return false;
      let c = hex.replace('#','');
      if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
      const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
      const br = (r*299 + g*587 + b*114) / 1000;
      return br < 140;
    } catch { return false; }
  };
  const clearAllRead = () => { if (confirm('Barcha o‘qilgan belgilari o‘chirilsinmi?')) setReadPages(new Set()); };

  // Search flash
  const [searchFlash, setSearchFlash] = useState({ page: null, ranges: [] });
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const findAllRanges = useCallback((text, q) => {
    if (!text || !q) return [];
    const tlc = text.toLowerCase(), qlc = q.toLowerCase();
    const out = []; let i = 0;
    while (true) { const idx = tlc.indexOf(qlc, i); if (idx === -1) break; out.push({ start: idx, end: idx + q.length }); i = idx + q.length; }
    return out;
  }, []);

  // Persist UI
  useEffect(() => {
    localStorage.setItem('fontSize', String(fontSize));
    localStorage.setItem('fontFamily', fontFamily);
    localStorage.setItem('background', background);
    localStorage.setItem('brightness', String(brightness));
  }, [fontSize, fontFamily, background, brightness]);
  useEffect(() => { localStorage.setItem('pageMargin', String(pageMargin)); }, [pageMargin]);
  useEffect(() => { localStorage.setItem('wordSpacing', String(wordSpacing)); }, [wordSpacing]);
  useEffect(() => { localStorage.setItem('letterSpacing', String(letterSpacing)); }, [letterSpacing]);

  // Load pages
  useEffect(() => {
    tg.ready();
    loadFormattedEpubPages('/books/test2.epub')
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
  useEffect(() => { if (pages.length > 0) localStorage.setItem(`lastPage-${bookId}`, String(currentPage)); }, [currentPage, pages]);

  // X overflow guard
  useEffect(() => {
    document.body.style.overflowX = 'hidden'; document.documentElement.style.overflowX = 'hidden';
    return () => { document.body.style.overflowX = ''; document.documentElement.style.overflowX = ''; };
  }, []);

  // ======== HIGHLIGHT ========
  const textWrapRef = useRef(null);     // horizontal page text
  const verticalRootRef = useRef(null);
  const pageRefs = useRef([]);
  const [highlights, setHighlights] = useState(() => {
    try { const raw = localStorage.getItem(HL_KEY(bookId)); return raw ? JSON.parse(raw) : []; }
    catch { return []; }
  });
  useEffect(() => { localStorage.setItem(HL_KEY(bookId), JSON.stringify(highlights)); }, [highlights]);

  const [hlMenu, setHlMenu] = useState({ visible: false, x: 0, y: 0, mode: 'add', targetHighlightId: null });

  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key === 'Escape') { setHlMenu(m => ({ ...m, visible: false })); window.getSelection()?.removeAllRanges(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, []);

  const selectionOffsetsRef = useRef({ start: null, end: null, page: null });

  const getTextOffset = (root, node, nodeOffset) => {
    let offset = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let current;
    while ((current = walker.nextNode())) {
      if (current === node) return offset + (current.nodeValue ? nodeOffset : 0);
      offset += (current.nodeValue?.length ?? 0);
    }
    return offset;
  };
  const countSoftHyphens = (s) => (s.match(/\u00AD/g) || []).length;
  const mapDomOffsetsToRaw = (root, startDom, endDom) => {
    const domText = root.textContent || '';
    const shStart = countSoftHyphens(domText.slice(0, startDom));
    const shEnd   = countSoftHyphens(domText.slice(0, endDom));
    return { start: Math.max(0, startDom - shStart), end: Math.max(0, endDom - shEnd) };
  };
  const getSelectionOffsetsWithin = (root) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
    const domStart = getTextOffset(root, range.startContainer, range.startOffset);
    const domEnd   = getTextOffset(root, range.endContainer,   range.endOffset);
    if (domStart === domEnd) return null;
    const minDom = Math.min(domStart, domEnd);
    const maxDom = Math.max(domStart, domEnd);
    const { start, end } = mapDomOffsetsToRaw(root, minDom, maxDom);
    return { start, end, rect: range.getBoundingClientRect() };
  };

  const addHighlight = (page, start, end, color = '#fff59d') => {
    let ns = Math.min(start, end), ne = Math.max(start, end);
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
      for (const h of samePage) { if (h.start <= ns && ne <= h.end) return prev; }
      const blocks = [...samePage, { start: ns, end: ne }];
      const merged = mergePageRanges(blocks);
      const normalized = merged.map(r => ({
        id: `${page}-${r.start}-${r.end}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        page, start: r.start, end: r.end, color
      }));
      return [...keepOther, ...normalized];
    });
    setHlMenu({ visible: false, x: 0, y: 0, mode: 'add', targetHighlightId: null });
    selectionOffsetsRef.current = { start: null, end: null, page: null };
    window.getSelection()?.removeAllRanges();
  };
  const removeHighlight = (id) => { setHighlights(prev => prev.filter(h => h.id !== id)); setHlMenu({ visible:false, x:0, y:0, mode:'add', targetHighlightId:null }); };

  const showAddMenuForSelection = () => {
    const sel = window.getSelection?.(); if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    let root = textWrapRef.current; let pageIdx = currentPage;
    if (flow === 'vertical') {
      let node = sel.anchorNode;
      if (node && node.nodeType === 3) node = node.parentNode;
      const pageEl = node?.closest?.('[data-page-idx]');
      if (pageEl) { root = pageEl; pageIdx = parseInt(pageEl.getAttribute('data-page-idx'), 10); }
    }
    if (!root) return;
    const off = getSelectionOffsetsWithin(root); if (!off) return;
    selectionOffsetsRef.current = { start: off.start, end: off.end, page: pageIdx };
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

  const [flashId, setFlashId] = useState(null);
  const [hlFilter, setHlFilter] = useState('');

  const rangesOverlap = (aStart, aEnd, bStart, bEnd) => !(aEnd <= bStart || bEnd <= aStart);
  const mergePageRanges = (items) => {
    if (!items.length) return [];
    const sorted = [...items].sort((x, y) => x.start - y.start || x.end - y.end);
    const out = []; let cur = { ...sorted[0] };
    for (let i = 1; i < sorted.length; i++) {
      const h = sorted[i];
      if (rangesOverlap(cur.start, cur.end, h.start, h.end) || cur.end === h.start) { cur.start = Math.min(cur.start, h.start); cur.end = Math.max(cur.end, h.end); }
      else { out.push(cur); cur = { ...h }; }
    }
    out.push(cur); return out;
  };

  /* ====================== Swipe / Drag (horizontal only) ====================== */
  const outerRef = useRef(null);
  const pageAreaRef = useRef(null);
  const startX = useRef(0), startY = useRef(0);
  const draggingAxis = useRef(null);
  const pointerActive = useRef(false);
  const [pageBoxH, setPageBoxH] = useState(null);

  const [drag, setDrag] = useState({ active:false, delta:0, committing:false, target:null, dir:null });
  const dimsRef = useRef({ w: 0, h: 0 });
  const measure = useCallback(() => {
    const r = pageAreaRef.current?.getBoundingClientRect();
    if (!r) return;
    dimsRef.current = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  }, []);
  useEffect(() => { measure(); window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); }, [measure]);

  const guardBlocked = useCallback(
    () => showSettings || showJumpModal || showSearch || showReadList || showHighlights || hlMenu.visible,
    [showSettings, showJumpModal, showSearch, showReadList, showHighlights, hlMenu.visible]
  );
  const shouldBlockFromTarget = (t) => (t?.closest && t.closest('[data-block-nav="true"]')) ? true : false;
  const navBusy = drag.active || drag.committing;

  const begin = useCallback((x, y, targetEl) => {
    if (flow === 'vertical') return; // swipe yo‘q
    if (guardBlocked() || navBusy) return;
    if (shouldBlockFromTarget(targetEl)) return;
    measure();
    if (textWrapRef.current) {
      const h = Math.ceil(textWrapRef.current.getBoundingClientRect().height);
      if (h) setPageBoxH(h);
    }
    startX.current = x; startY.current = y;
    draggingAxis.current = null;
    setDrag(d => ({ ...d, active:false, delta:0, committing:false, target:null, dir:null }));
  }, [guardBlocked, navBusy, measure, flow]);

  const move = useCallback((x, y) => {
    if (flow === 'vertical' || drag.committing) return;
    const dx = x - startX.current, dy = y - startY.current;
    if (!draggingAxis.current) {
      const ax = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      if ((ax === 'horizontal' && Math.abs(dx) < 8) || (ax === 'vertical' && Math.abs(dy) < 8)) return;
      draggingAxis.current = ax;
    }
    if (draggingAxis.current !== 'horizontal') return;

    if (!drag.active) setDrag(d => ({ ...d, active:true }));

    const { w } = dimsRef.current;
    const size = w;
    const rawDelta = dx;

    let dir = null, target = null;
    if (rawDelta < 0 && currentPage + 1 < pages.length) { dir = 'next'; target = currentPage + 1; }
    else if (rawDelta > 0 && currentPage - 1 >= 0) { dir = 'prev'; target = currentPage - 1; }

    let delta = target === null ? rawDelta * 0.35 : rawDelta;
    const maxShift = size;
    delta = Math.max(-maxShift, Math.min(delta, maxShift));
    setDrag(d => ({ ...d, delta, target, dir }));
  }, [drag.committing, drag.active, flow, currentPage, pages.length]);

  const commitOrRevert = useCallback(() => {
    // tanlov bo‘lsa — menyu
    setTimeout(() => showAddMenuForSelection(), 0);

    if (flow === 'vertical' || !drag.active || drag.committing) {
      setDrag({ active:false, delta:0, committing:false, target:null, dir:null });
      setPageBoxH(null);
      return;
    }
    const { w } = dimsRef.current;
    const size = w;
    const threshold = Math.max(60, size * 0.2);

    if (drag.target != null && Math.abs(drag.delta) >= threshold) {
      setDrag(d => ({ ...d, committing:true, delta: d.dir === 'next' ? -size : size }));
      setTimeout(() => {
        setCurrentPage(drag.target);
        setDrag({ active:false, delta:0, committing:false, target:null, dir:null });
        setPageBoxH(null);
      }, 260);
    } else {
      setDrag(d => ({ ...d, committing:true, delta:0 }));
      setTimeout(() => { setDrag({ active:false, delta:0, committing:false, target:null, dir:null }); setPageBoxH(null); }, 220);
    }
  }, [drag.active, drag.committing, drag.delta, drag.target, drag.dir, flow]);

  const onTouchStart = useCallback((e) => { const t = e.touches?.[0]; if (!t) return; begin(t.clientX, t.clientY, e.target); }, [begin]);
  const onTouchMove  = useCallback((e) => { const t = e.touches?.[0]; if (!t) return; move(t.clientX, t.clientY); }, [move]);
  const onTouchEnd   = useCallback(() => commitOrRevert(), [commitOrRevert]);
  const onPointerDown= useCallback((e) => { pointerActive.current = true; begin(e.clientX, e.clientY, e.target); }, [begin]);
  const onPointerMove= useCallback((e) => { if (!pointerActive.current) return; move(e.clientX, e.clientY); }, [move]);
  const onPointerUp  = useCallback(() => { pointerActive.current = false; commitOrRevert(); }, [commitOrRevert]);

  const jumpInstant = useCallback((toIndex) => {
    if (toIndex < 0 || toIndex >= pages.length || toIndex === currentPage) return;
    const { w } = dimsRef.current;
    const size = w;
    const dir = toIndex > currentPage ? 'next' : 'prev';
    const startDelta = dir === 'next' ? -size : size;
    setDrag({ active:true, delta:startDelta, committing:true, target:toIndex, dir });
    setTimeout(() => { setCurrentPage(toIndex); setDrag({ active:false, delta:0, committing:false, target:null, dir:null }); }, 240);
  }, [currentPage, pages.length]);

  const onKeyDown = useCallback((e) => {
    if (guardBlocked() || (drag.active || drag.committing)) return;
    if (flow === 'horizontal') {
      if (e.key === 'ArrowRight') jumpInstant(currentPage + 1);
      if (e.key === 'ArrowLeft')  jumpInstant(currentPage - 1);
    } else {
      if (e.key.toLowerCase() === 'r') markReadUpToCurrent();
    }
  }, [guardBlocked, drag.active, drag.committing, flow, currentPage, jumpInstant]);

  // Search
  const makeSnippet = (text, pos, qlen) => {
    const start = Math.max(0, pos - 40), end = Math.min(text.length, pos + qlen + 40);
    const raw = text.slice(start, end).replace(/\s+/g, ' ').trim();
    return `${start > 0 ? '… ' : ''}${raw}${end < text.length ? ' …' : ''}`;
  };
  const runSearch = () => {
    const q = query.trim(); if (!q) { setResults([]); return; }
    setSearching(true);
    const qlc = q.toLowerCase(); const found = [];
    for (let i = 0; i < pages.length; i++) {
      const t = (pages[i] || '').toString(); const tlc = t.toLowerCase(); const idx = tlc.indexOf(qlc);
      if (idx !== -1) found.push({ page: i, snippet: makeSnippet(t, idx, q.length) });
    }
    setResults(found); setSearching(false);
  };
  const jumpToResult = (p) => {
    const q = query.trim(); setCurrentPage(p); setShowSearch(false); setQuery(''); setResults([]);
    if (q) { const ranges = findAllRanges(pages[p] || '', q); setSearchFlash({ page:p, ranges }); setTimeout(() => setSearchFlash({ page:null, ranges:[] }), 1800); }
  };

  // Vertical: update currentPage on scroll
  useEffect(() => {
    if (flow !== 'vertical') return;
    const obs = new IntersectionObserver((entries) => {
      let best = null;
      for (const e of entries) if (e.isIntersecting) { if (!best || e.intersectionRatio > best.intersectionRatio) best = e; }
      if (best) {
        const idx = Number(best.target.getAttribute('data-page-idx'));
        setCurrentPage((p) => (p !== idx ? idx : p));
      }
    }, { root: null, threshold: [0.15, 0.35, 0.55, 0.75] });
    pageRefs.current.forEach(el => el && obs.observe(el));
    return () => obs.disconnect();
  }, [flow, pages.length]);

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

  const sample = (pages[currentPage] || '').slice(0, 200);
  const isCyr = /[\u0400-\u04FF]/.test(sample);
  const langAttr = isCyr ? 'uz-Cyrl' : 'uz';

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const safeWordSpacing = clamp(wordSpacing, -0.5, 2);
  const safeLetterSpacing = clamp(letterSpacing, -0.5, 1.5);
  const safePageMargin = clamp(pageMargin, 0, 64);

  const pageTextStyle = {
    whiteSpace: 'pre-wrap',
    lineHeight: '1.8',
    fontSize: `${fontSize}px`,
    fontFamily: fontFamily,
    margin: '0 auto 2rem',
    maxWidth: 'clamp(52ch, 92vw, 74ch)',
    padding: `${safePageMargin}px`,
    wordSpacing: `${safeWordSpacing}px`,
    letterSpacing: `${safeLetterSpacing}px`,
    overflowX: 'hidden',
    maxInlineSize: '100%',
    userSelect: drag.active ? 'none' : 'text',
    textAlign: 'justify',
    textJustify: 'inter-character',
    hyphens: 'auto',
    WebkitHyphens: 'auto',
    overflowWrap: 'break-word',
    wordBreak: 'normal',
    fontKerning: 'normal',
    textWrap: 'pretty',
    backgroundColor: 'transparent',
    borderRadius: '12px'
  };

  const makeHlSnippet = (text, start, end, pad = 40) => {
    const s = Math.max(0, start - pad), e = Math.min(text.length, end + pad);
    const raw = text.slice(s, e).replace(/\s+/g, ' ').trim();
    return `${s > 0 ? '… ' : ''}${raw}${e < text.length ? ' …' : ''}`;
  };
  const preparedHls = (() => {
    const arr = [...highlights].sort((a,b) => (a.page - b.page) || (a.start - b.start));
    const mapped = arr.map(h => { const text = pages[h.page] || ''; return { ...h, snippet: makeHlSnippet(text, h.start, h.end) }; });
    const q = hlFilter.trim().toLowerCase(); if (!q) return mapped;
    return mapped.filter(x => x.snippet.toLowerCase().includes(q));
  })();

  const openWithAnchor = (e, setAnchor, setOpen, topFallback = 80) => {
    const rect = e?.currentTarget ? rectFrom(e.currentTarget) : fallbackAnchor(topFallback);
    setAnchor(rect || fallbackAnchor(topFallback)); setOpen(true);
  };

  // transforms for horizontal swipe
  const axis = 'X';
  const { w } = dimsRef.current;
  const size = w;

  let currTransform = `translate${axis}(${drag.active || drag.committing ? drag.delta : 0}px)`;
  let previewTransform = null;
  let previewIndex = drag.target;
  if ((drag.active || drag.committing) && drag.target != null) {
    const delta = drag.delta;
    if (delta < 0) previewTransform = `translate${axis}(${size + delta}px)`;
    else if (delta > 0) previewTransform = `translate${axis}(${-size + delta}px)`;
  }
  const transitionStyle = drag.committing ? 'transform 260ms ease' : 'none';
  const layerBase = { position: 'absolute', inset: 0, overflow: 'hidden', willChange: 'transform' };

  const markCommonProps = { 'data-block-nav':'true', 'data-hl':'true' };

  const renderWithHighlights = (text, pageIndex) => {
    const base = highlights.filter(h => h.page === pageIndex).map(h => ({ ...h, isFlash: h.id === flashId }));
    const flashes = (searchFlash.page === pageIndex)
      ? searchFlash.ranges.map((r, i) => ({ id:`sf-${i}`, page:pageIndex, start:r.start, end:r.end, color:'#fff1a6', isFlash:true }))
      : [];
    const pageHls = [...base, ...flashes].sort((a,b) => a.start - b.start || a.end - b.end);
    if (pageHls.length === 0) return hyphenateVisible(text);
    const out = []; let cursor = 0;
    for (const h of pageHls) {
      let s = Math.max(0, Math.min(text.length, h.start));
      let e = Math.max(0, Math.min(text.length, h.end));
      if (e <= cursor) continue;
      if (s < cursor) s = cursor;
      if (cursor < s) out.push(hyphenateVisible(text.slice(cursor, s)));
      out.push(
        <mark
          key={`${h.id}-${s}-${e}`}
          {...markCommonProps}
          onMouseDown={(e)=>e.stopPropagation()}
          onTouchStart={(e)=>e.stopPropagation()}
          onClick={(e)=>!h.isFlash && showRemoveMenuFor(e, h.id)}
          style={{
            background: h.color || '#fff59d',
            padding: '0 0.5px',
            borderRadius: '2px',
            wordSpacing: `${wordSpacing}px`,
            letterSpacing: `${letterSpacing}px`,
            outline: h.isFlash ? '2px solid rgba(251,191,36,0.95)' : 'none',
            boxShadow: h.isFlash ? '0 0 0 4px rgba(251,191,36,0.25)' : 'none',
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

  return (
    <div
      ref={outerRef}
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
        overscrollBehavior: flow === 'vertical' ? 'auto' : 'none',
      }}
      onClick={(e) => {
        if (hlMenu.visible && !e.target.closest?.('[data-hl-menu]')) {
          setHlMenu(m => ({ ...m, visible:false }));
        }
      }}
    >
      {/* TOP BAR */}
      <div data-block-nav="true"
        style={{ position:'sticky', top:0, zIndex:50, display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:8, marginTop:-8 }}>
        <button data-block-nav="true" onClick={(e)=>{e.stopPropagation(); navigate('/');}} title="Orqaga"
          style={{ background:'transparent', border:'none', padding:4, cursor:'pointer' }}>
          <IoChevronBack size={24} color={iconColor} />
        </button>

        <button data-block-nav="true"
          onClick={(e)=>{ e.stopPropagation(); openWithAnchor(e, setAnchorReadList, setShowReadList, 72); }}
          title="O‘qilgan sahifalar"
          style={{ fontSize:12, padding:'6px 10px', borderRadius:999, border:`1px solid ${border}`, background:isDark?'#1b1b1b':'#f8f8f8', color:isDark?'#f3f4f6':'#111', minWidth:44, textAlign:'center', userSelect:'none', cursor:'pointer', marginLeft:'80px' }}>
          {progress}%
        </button>

        <div data-block-nav="true" style={{ display:'flex', gap:12, alignItems:'center' }}>
          <button data-block-nav="true" onClick={(e)=>{ e.stopPropagation(); openWithAnchor(e, setAnchorHighlights, setShowHighlights, 76); }} title="Belgilangan joylar" style={{ background:'transparent', border:'none', padding:4, cursor:'pointer' }}>
            <IoBookmark size={22} color={iconColor} />
          </button>
          <button data-block-nav="true" onClick={(e)=>{ e.stopPropagation(); openWithAnchor(e, setAnchorSearch, setShowSearch, 76); }} title="Qidiruv" style={{ background:'transparent', border:'none', padding:4, cursor:'pointer' }}>
            <IoSearchSharp size={22} color={iconColor} />
          </button>
          <button data-block-nav="true" onClick={(e)=>{ e.stopPropagation(); openWithAnchor(e, setAnchorSettings, setShowSettings, 84); }} title="Sozlamalar" style={{ background:'transparent', border:'none', padding:4, cursor:'pointer' }}>
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
          <h1 style={{ fontSize:'32px', fontWeight:'bold', marginBottom:4, fontFamily }}>Yaxshiyam Sen Borsan</h1>
          <h2 style={{ fontSize:'18px', color:textMuted, fontFamily }}>1-bob</h2>
        </div>
      ) : (
        <div style={{ textAlign:'center', fontWeight:600, marginBottom:'1rem', fontSize:'16px', color:textMuted, fontFamily }}>
          {Math.floor(currentPage / 10) + 1} -bob
        </div>
      )}

      {/* ======= CONTENT RENDER ======= */}
      {flow === 'vertical' ? (
        // VERTICAL: to‘liq skroll, har sahifada markaziy HUD
        <div ref={verticalRootRef}>
          {pages.map((txt, idx) => (
            <div key={idx} data-page-idx={idx} ref={el => (pageRefs.current[idx] = el)} style={{ position:'relative', marginBottom:'1rem' }}>
              <pre
                className="reader-text"
                lang={langAttr}
                onMouseUp={(e)=>{ if (e.target.closest('[data-hl="true"]')) return; showAddMenuForSelection(); }}
                style={pageTextStyle}
              >
                {renderWithHighlights(txt || '', idx)}
              </pre>

              {/* Per-page HUD (CENTER, separate block — textni bosib turmaydi) */}
              <div data-block-nav="true"
                   style={{ display:'flex', justifyContent:'center', gap:10, margin:'-8px auto 2.2rem', width:'min(74ch, 92vw)'}}>
                <button
                  data-block-nav="true"
                  onClick={(e)=>{ e.stopPropagation(); markReadUpTo(idx); }}
                  title="Bu varoqgacha hammasini o‘qilgan deb belgilash"
                  style={{
                    padding:'6px 12px', borderRadius:999, border:`1px solid ${border}`,
                    background: readPages.has(idx) ? (isDark ? '#15361c' : '#e8f5ee') : (isDark ? '#1b1b1b' : '#f8f8f8'),
                    color: readPages.has(idx) ? (isDark ? '#c1f2d3' : '#0f5132') : (isDark ? '#f5f5f5' : '#111'),
                    fontSize:12, cursor:'pointer'
                  }}
                >
                  {readPages.has(idx) ? 'O‘qilgan' : 'O‘qildi'}
                </button>

                <button
                  data-block-nav="true"
                  onClick={(e)=>{ 
                    e.stopPropagation(); 
                    setJumpInput(String(idx + 1));
                    setShowJumpModal(true);
                  }}
                  style={{
                    fontSize:12, padding:'6px 12px', borderRadius:999, border:`1px solid ${border}`,
                    background:isDark?'#1b1b1b':'#f8f8f8', color:isDark?'#f3f4f6':'#111',
                    cursor:'pointer'
                  }}
                  title="Sahifaga o‘tish"
                >
                  {idx + 1} / {pages.length}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // HORIZONTAL: withdrawal-style swipe
        <div
          ref={pageAreaRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            position:'relative',
            minHeight:'40vh',
            height: (drag.active || drag.committing) && pageBoxH ? `${pageBoxH}px` : 'auto',
            touchAction: 'pan-y',
            cursor: (drag.active || drag.committing) ? 'grabbing' : 'default'
          }}
        >
          {/* Normal */}
          {!(drag.active || drag.committing) && (
            <pre
              className="reader-text"
              ref={textWrapRef}
              onMouseUp={(e)=>{ if (e.target.closest('[data-hl="true"]')) return; showAddMenuForSelection(); }}
              lang={langAttr}
              style={pageTextStyle}
            >
              {renderWithHighlights(pages[currentPage] || '', currentPage)}
            </pre>
          )}

          {/* Drag layers */}
          {(drag.active || drag.committing) && (
            <>
              <div style={{ ...layerBase, transform: currTransform, transition: transitionStyle }}>
                <pre className="reader-text" lang={langAttr} style={pageTextStyle} ref={textWrapRef}>
                  {renderWithHighlights(pages[currentPage] || '', currentPage)}
                </pre>
              </div>
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
      )}

      {/* HIGHLIGHT MENU */}
      {hlMenu.visible && (
        <div
          data-hl-menu data-block-nav="true"
          onClick={(e)=>e.stopPropagation()} onMouseDown={(e)=>e.stopPropagation()} onTouchStart={(e)=>e.stopPropagation()}
          style={{
            position:'absolute',
            left: Math.max(12, Math.min(window.innerWidth - 12, hlMenu.x)) - 58,
            top:  Math.max(12, hlMenu.y),
            zIndex:1500, background: isDark ? '#1f2937' : '#111827', color:'#fff',
            borderRadius: 12, boxShadow:'0 8px 24px rgba(0,0,0,0.25)', padding:'6px',
            display:'flex', gap:6, alignItems:'center'
          }}
        >
          {hlMenu.mode === 'add' ? (
            <>
              <button
                data-block-nav="true"
                onClick={(e)=>{ 
                  e.stopPropagation();
                  const { start, end, page } = selectionOffsetsRef.current;
                  const targetPage = (page ?? currentPage);
                  if (start !== null && end !== null) addHighlight(targetPage, start, end, '#fff59d');
                }}
                style={{ border:'none', background:'#FFD54F', color:'#111', borderRadius:8, padding:'6px 10px', fontSize:13, cursor:'pointer' }}
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

      {/* Global "O‘qildi" (asosan horizontal uchun) */}
      <button
        data-block-nav="true"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); markReadUpToCurrent(); }}
        title={allUpToCurrentRead ? 'Bu sahifagacha hammasi allaqachon belgilangan' : `0–${currentPage + 1} o'qildi deb belgilash`}
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

      {/* PAGE INDICATOR (global) */}
      <div
        data-block-nav="true"
        onClick={(e) => { e.stopPropagation(); setShowJumpModal(true); setJumpInput(String(currentPage+1)); }}
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

      {/* ======= Modals ======= */}
      <AnchoredModal open={showSearch} onClose={()=>setShowSearch(false)} anchorRect={anchorSearch || fallbackAnchor(80)} prefer="below" maxW={720} maxH={0.8} background={surface} isDark={isDark} border={border} zIndex={1400}>
        <div style={{ display:'flex', gap:8 }}>
          <input data-block-nav="true" value={query} onChange={(e)=>setQuery(e.target.value)} onKeyDown={(e)=>{ if (e.key === 'Enter') runSearch(); }} placeholder="Matndan qidirish… (Enter)"
            style={{ flex:1, padding:'10px 12px', borderRadius:10, border:'1px solid #d1d5db', outline:'none', fontSize:14, background:isDark?'#1c1c1c':'#fff', color:isDark?'#f5f5f5':'#111' }}/>
          <button data-block-nav="true" onClick={(e)=>{ e.stopPropagation(); runSearch(); }}
            style={{ padding:'10px 12px', borderRadius:10, border:'1px solid #d1d5db', background:'#1c1c1c', color:'#fff', cursor:'pointer', fontSize:14 }}>Qidir</button>
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
      </AnchoredModal>

      <AnchoredModal open={showReadList} onClose={()=>setShowReadList(false)} anchorRect={anchorReadList || fallbackAnchor(72)} prefer="below" maxW={720} maxH={0.8} background={cardBg} isDark={isDark} border={border} zIndex={1300}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontWeight:700, fontSize:16, color:isDark?'#f3f4f6':'#111' }}>O‘qilganlar ({readArr.length} sahifa)</div>
          <button data-block-nav="true" onClick={(e)=>{ e.stopPropagation(); clearAllRead(); }}
            style={{ background:isDark?'#2a1313':'#561818ff', color:'#fff', border:'1px solid #eee', borderRadius:10, padding:'6px 10px', fontSize:12, cursor:'pointer' }}>Tozalash</button>
        </div>
        <div style={{ fontSize:13, color:isDark?'#d1d5db':'#555', background:isDark?'#111':'#f7f7f7', border:`1px solid ${border}`, borderRadius:10, padding:'8px 10px', marginBottom:10, lineHeight:1.5 }}>
          {readArr.length ? (() => {
            const a = [...new Set(readArr)].sort((x, y) => x - y); const out = []; let s = null, p = null;
            for (const n of a) { if (s === null) { s = p = n; continue; } if (n === p + 1) { p = n; continue; } out.push(s === p ? `${s + 1}` : `${s + 1}–${p + 1}`); s = p = n; }
            if (s !== null) out.push(s === p ? `${s + 1}` : `${s + 1}–${p + 1}`); return out.join(', ');
          })() : 'Hali sahifalar belgilanmagan'}
        </div>
        {!!readArr.length && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {readArr.sort((a,b)=>a-b).map((p)=>(
              <button key={p} data-block-nav="true" onClick={(e)=>{ e.stopPropagation(); setCurrentPage(p); setShowReadList(false); }}
                style={{ padding:'8px 10px', borderRadius:999, border:`1px solid ${border}`, background:isDark?'#1c1c1c':'#fafafa', cursor:'pointer', fontSize:12, color:isDark?'#f3f4f6':'#111' }} title={`Sahifa ${p+1}`}>
                {p+1}
              </button>
            ))}
          </div>
        )}
      </AnchoredModal>

      <AnchoredModal open={showHighlights} onClose={()=>setShowHighlights(false)} anchorRect={anchorHighlights || fallbackAnchor(76)} prefer="below" maxW={720} maxH={0.8} background={surface} isDark={isDark} border={border} zIndex={1460}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <div style={{ fontWeight:700, fontSize:16 }}>{`Belgilangan joylar (${preparedHls.length})`}</div>
          <button data-block-nav="true" onClick={() => setShowHighlights(false)}
            style={{ fontSize:12, border:`1px solid ${border}`, background:isDark?'#1b1b1b':'#f8f8f8', borderRadius:10, padding:'6px 10px', cursor:'pointer' }}>Yopish</button>
        </div>
        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <input data-block-nav="true" value={hlFilter} onChange={(e)=>setHlFilter(e.target.value)} placeholder="Belgilanganlardan qidirish…"
            style={{ flex:1, padding:'10px 12px', borderRadius:10, border:'1px solid #d1d5db', outline:'none', fontSize:14, background:isDark?'#1c1c1c':'#fff', color:isDark?'#f5f5f5':'#111' }}/>
          {hlFilter && (
            <button data-block-nav="true" onClick={()=>setHlFilter('')}
              style={{ padding:'10px 12px', borderRadius:10, border:'1px solid #d1d5db', background:'#e5e7eb', cursor:'pointer', fontSize:14 }}>Toza</button>
          )}
        </div>
        {preparedHls.length === 0 ? (
          <div style={{ fontSize:13, color:'#6b7280' }}>Hali belgilangan joy yo‘q.</div>
        ) : (
          <div style={{ display:'grid', gap:8 }}>
            {preparedHls.map((h) => (
              <button key={h.id} data-block-nav="true" onClick={() => {
                  setShowHighlights(false); setCurrentPage(h.page);
                  setTimeout(() => { setFlashId(h.id); setTimeout(()=>setFlashId(null), 900); }, 50);
                }}
                style={{ textAlign:'left', border:`1px solid ${border}`, background:cardBg, color:isDark?'#f3f4f6':'#111', borderRadius:12, padding:'10px 12px', cursor:'pointer' }}
                title={`Sahifa ${h.page + 1}`}>
                <div style={{ fontSize:12, color:'#9ca3af', marginBottom:4 }}>Sahifa {h.page + 1}</div>
                <div style={{ fontSize:14, lineHeight:1.5 }}>{h.snippet}</div>
              </button>
            ))}
          </div>
        )}
      </AnchoredModal>

      {/* JUMP modal */}
      {showJumpModal && (
        <div onClick={() => setShowJumpModal(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1600, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div data-block-nav="true" onClick={(e)=>e.stopPropagation()}
            style={{ background:'#fff', paddingBottom:'14px', borderRadius:'16px', width:'100%', maxWidth:'340px', boxShadow:'0 8px 24px rgba(0,0,0,0.2)', textAlign:'center', transition:'all 0.3s ease' }}>
            <h3 style={{ marginBottom:'1rem', fontSize:'18px', fontWeight:600, color:'#222' }}>
              Sahifa: {currentPage + 1} / {pages.length}
            </h3>
            <input
              data-block-nav="true"
              type="number"
              placeholder="Sahifa raqamini kiriting"
              value={jumpInput}
              autoFocus
              onChange={(e)=>setJumpInput(e.target.value)}
              onKeyDown={(e)=>{
                if (e.key==='Enter'){
                  const p=parseInt(jumpInput,10);
                  if(!isNaN(p)&&p>=1&&p<=pages.length){
                    setCurrentPage(p-1); setShowJumpModal(false); setJumpInput('');
                    // vertical rejimda ham darrov fokuslangan sahifaga o‘tadi
                    if (flow === 'vertical') {
                      const el = pageRefs.current[p-1];
                      if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
                    }
                  }
                }
              }}
              style={{ width:'200px', padding:'10px 12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'15px', background:'#f9f9f9', color:'#333', outline:'none', transition:'all 0.2s ease' }}
            />
            <p style={{ marginTop:8, fontSize:12, color:'#999' }}>Enter tugmasini bosing</p>
          </div>
        </div>
      )}

      {/* SETTINGS */}
      <AnchoredModal open={showSettings} onClose={()=>setShowSettings(false)} anchorRect={anchorSettings || fallbackAnchor(84)} prefer="below" maxW={840} maxH={0.9} background={isDark?'#111':'#fff'} isDark={isDark} border={border} zIndex={1500}>
        <SettingsPanel
          fontSize={fontSize} setFontSize={setFontSize}
          fontFamily={fontFamily} setFontFamily={setFontFamily}
          background={background} setBackground={setBackground}
          brightness={brightness} setBrightness={setBrightness}
          flow={flow} setFlow={setFlow}
          onClose={() => setShowSettings(false)}
          pageMargin={pageMargin} setPageMargin={setPageMargin}
          wordSpacing={wordSpacing} setWordSpacing={setWordSpacing}
          letterSpacing={letterSpacing} setLetterSpacing={setLetterSpacing}
        />
      </AnchoredModal>
    </div>
  );
};

export default ReaderEpub;
