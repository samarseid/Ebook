// src/pages/Reader.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadFormattedPdfPages } from '../utils/pdfUtils';
import { useTelegram, tg } from '../hooks/useTelegram';
import SettingsPanel from '../components/SettingsPanel';
import { IoSettingsSharp, IoChevronBack, IoSearchSharp } from 'react-icons/io5';
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

  // UI sozlamalar
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('fontSize');
    return saved ? parseInt(saved, 10) : 16;
  });
  const [fontFamily, setFontFamily] = useState(() => {
    return localStorage.getItem('fontFamily') || 'Times New Roman';
  });
  const [background, setBackground] = useState(() => {
    return localStorage.getItem('background') || '#ffffff';
  });
  const [brightness, setBrightness] = useState(() => {
    const saved = localStorage.getItem('brightness');
    return saved ? parseInt(saved, 10) : 100;
  });

  // Tipografiya
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

  // Oqim (horizontal | vertical)
  const [flow, setFlow] = useState(() => {
    const saved = localStorage.getItem('readFlow');
    return saved === 'vertical' || saved === 'horizontal' ? saved : 'horizontal';
  });
  useEffect(() => { localStorage.setItem('readFlow', flow); }, [flow]);

  // O‘qilgan sahifalar
  const [readPages, setReadPages] = useState(() => {
    try {
      const saved = localStorage.getItem(`read-${bookId}`);
      if (!saved) return new Set();
      const arr = JSON.parse(saved);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch { return new Set(); }
  });
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

  // Rang yorug‘-qorong‘i
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

  // Qidiruv
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => { if (showSettings) setTimeout(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }), 50); }, [showSettings]);
  useEffect(() => { if (showSearch)   setTimeout(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }), 50); }, [showSearch]);

  // Sozlamalarni load/save
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

  // ======== HIGHLIGHT ========
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
    mode: 'add',
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
  const getTextOffset = (root, node, nodeOffset) => {
    let offset = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let current;
    while ((current = walker.nextNode())) {
      if (current === node) return offset + nodeOffset;
      offset += current.nodeValue.length;
    }
    return offset;
  };
  const getSelectionOffsetsWithin = (root) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
    const start = getTextOffset(root, range.startContainer, range.startOffset);
    const end = getTextOffset(root, range.endContainer, range.endOffset);
    if (start === end) return null;
    return { start: Math.min(start, end), end: Math.max(start, end), rect: range.getBoundingClientRect() };
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
        if (h.start <= ns && ne <= h.end) return prev;
      }
      const blocks = [...samePage, { start: ns, end: ne }];
      const merged = mergePageRanges(blocks);
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
    if (!off) { setHlMenu(m => ({ ...m, visible: false })); return; }
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
  const renderWithHighlights = (text, pageIndex) => {
    const pageHls = highlights
      .filter(h => h.page === pageIndex)
      .sort((a, b) => a.start - b.start || a.end - b.end);
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
          data-hl-menu
          key={`${h.id}-${s}-${e}`}
          data-block-nav="true"
          onMouseDown={(e)=>e.stopPropagation()}
          onTouchStart={(e)=>e.stopPropagation()}
          onClick={(e) => showRemoveMenuFor(e, h.id)}
          style={{
            background: h.color || '#fff59d',
            padding: '0 0.5px',
            borderRadius: '2px',
            wordSpacing: `${wordSpacing}px`,
            letterSpacing: `${letterSpacing}px`,
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
  const rangesOverlap = (aStart, aEnd, bStart, bEnd) => !(aEnd <= bStart || bEnd <= aStart);
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
      } else { out.push(cur); cur = { ...h }; }
    }
    out.push(cur);
    return out;
  };

  // ======== PAGE SLIDE + DRAG (Pointer Events, barqaror) ========
  const threshold = 50;          // fallback tap-swipe
  const gestureStartThreshold = 12;
  const commitRatio = 0.28;
  const velocityCommit = 0.6;    // px/ms

  const startX = useRef(0);
  const startY = useRef(0);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const lastTs = useRef(0);

  const isPointerDownRef = useRef(false);
  const pointerIdRef = useRef(null);

  const containerRef = useRef(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const measure = useCallback(() => {
    const r = containerRef.current?.getBoundingClientRect();
    setViewport({ w: r?.width || window.innerWidth, h: r?.height || Math.max(360, window.innerHeight * 0.6) });
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const guardBlocked = useCallback(
    () => showSettings || showJumpModal || showSearch || showReadList || hlMenu.visible,
    [showSettings, showJumpModal, showSearch, showReadList, hlMenu.visible]
  );
  const shouldBlockFromTarget = (t) => (t?.closest && t.closest('[data-block-nav="true"]')) ? true : false;

  const [anim, setAnim] = useState({
    active: false,
    stage: 'idle',     // 'idle' | 'drag' | 'run'
    dir: 'next',       // 'next' | 'prev'
    flowForAnim: 'horizontal',
    target: null,
    dragPx: 0,
    commit: false
  });

  const axisSize = (anim.flowForAnim === 'horizontal' ? viewport.w : viewport.h) || (flow === 'horizontal' ? window.innerWidth : window.innerHeight);

  const startAnimProgrammatic = (targetIndex, dir) => {
    if (anim.active) return;
    if (targetIndex < 0 || targetIndex >= pages.length || targetIndex === currentPage) return;
    const sign = dir === 'next' ? -1 : 1;
    setAnim({ active: true, stage: 'run', dir, flowForAnim: flow, target: targetIndex, dragPx: sign * axisSize, commit: true });
  };

  const beginDragIfNeeded = (dx, dy) => {
    if (anim.active) return;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (flow === 'horizontal') {
      if (ax > gestureStartThreshold && ax > ay) {
        const dir = dx < 0 ? 'next' : 'prev';
        const target = dir === 'next' ? currentPage + 1 : currentPage - 1;
        setAnim({
          active: true,
          stage: 'drag',
          dir,
          flowForAnim: flow,
          target: (target >=0 && target < pages.length) ? target : null,
          dragPx: dx,
          commit: false
        });
      }
    } else {
      if (ay > gestureStartThreshold && ay > ax) {
        const dir = dy < 0 ? 'next' : 'prev';
        const target = dir === 'next' ? currentPage + 1 : currentPage - 1;
        setAnim({
          active: true,
          stage: 'drag',
          dir,
          flowForAnim: flow,
          target: (target >=0 && target < pages.length) ? target : null,
          dragPx: dy,
          commit: false
        });
      }
    }
  };

  const onPointerDown = useCallback((e) => {
    if (guardBlocked() || anim.active) return;
    if (shouldBlockFromTarget(e.target)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return; // faqat left
    isPointerDownRef.current = true;
    pointerIdRef.current = e.pointerId;
    containerRef.current?.setPointerCapture?.(e.pointerId);
    startX.current = lastX.current = e.clientX;
    startY.current = lastY.current = e.clientY;
    lastTs.current = performance.now();
  }, [guardBlocked, anim.active]);

  const onPointerMove = useCallback((e) => {
    if (guardBlocked()) return;
    if (!isPointerDownRef.current) return;

    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (!anim.active) {
      beginDragIfNeeded(dx, dy);
    } else if (anim.stage === 'drag') {
      const raw = (anim.flowForAnim === 'horizontal') ? dx : dy;
      const edge = anim.target == null;
      const damped = edge ? raw * 0.33 : raw;
      setAnim(a => ({ ...a, dragPx: damped }));
    }

    lastX.current = e.clientX; lastY.current = e.clientY; lastTs.current = performance.now();
  }, [guardBlocked, anim.active, anim.stage, anim.flowForAnim, anim.target]);

  const settle = (commit) => {
    if (!anim.active) return;
    if (anim.stage === 'drag') {
      setAnim(a => ({ ...a, stage: 'run', commit }));
    }
  };

  const onPointerUp = useCallback((e) => {
    // highlight menyusi (pointer up’da tekshirib)
    if (textWrapRef.current && textWrapRef.current.contains(e.target)) {
      setTimeout(() => showAddMenuForSelection(e), 0);
    }

    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    try { containerRef.current?.releasePointerCapture?.(pointerIdRef.current); } catch {}

    if (guardBlocked()) return;

    if (!anim.active) {
      // fallback tap-swipe
      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;
      if (flow === 'horizontal') {
        if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) startAnimProgrammatic(currentPage + 1, 'next');
          else startAnimProgrammatic(currentPage - 1, 'prev');
        }
      } else {
        if (Math.abs(dy) >= threshold && Math.abs(dy) > Math.abs(dx)) {
          if (dy < 0) startAnimProgrammatic(currentPage + 1, 'next');
          else startAnimProgrammatic(currentPage - 1, 'prev');
        }
      }
      return;
    }

    if (anim.stage === 'drag') {
      const now = performance.now();
      const dt = Math.max(1, now - lastTs.current);
      const velPx = (flow === 'horizontal' ? (e.clientX - lastX.current) : (e.clientY - lastY.current)) / dt; // px/ms
      const dist = Math.abs(anim.dragPx);
      const commit = (anim.target != null) && (dist > axisSize * commitRatio || Math.abs(velPx) > velocityCommit);
      settle(commit);
    }
  }, [guardBlocked, anim.active, anim.stage, anim.dragPx, anim.target, axisSize, flow, currentPage]);

  const onPointerCancel = useCallback(() => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    if (anim.active && anim.stage === 'drag') settle(false);
  }, [anim.active, anim.stage]);

  const onKeyDown = useCallback((e) => {
    if (guardBlocked() || anim.active) return;
    if (flow === 'horizontal') {
      if (e.key === 'ArrowRight') startAnimProgrammatic(currentPage + 1, 'next');
      if (e.key === 'ArrowLeft')  startAnimProgrammatic(currentPage - 1, 'prev');
    } else {
      if (e.key === 'ArrowDown')  startAnimProgrammatic(currentPage + 1, 'next');
      if (e.key === 'ArrowUp')    startAnimProgrammatic(currentPage - 1, 'prev');
    }
    if (e.key.toLowerCase() === 'r') markReadUpToCurrent();
  }, [guardBlocked, flow, currentPage, anim.active]);

  const finishAnim = useCallback(() => {
    if (!anim.active) return;
    if (anim.stage === 'run') {
      if (anim.commit && anim.target != null) setCurrentPage(anim.target);
      setAnim({ active: false, stage: 'idle', dir: 'next', flowForAnim: flow, target: null, dragPx: 0, commit: false });
    }
  }, [anim, flow]);

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
  const makeSnippet = (text, pos, qlen) => {
    const start = Math.max(0, pos - 40);
    const end = Math.min(text.length, pos + qlen + 40);
    const raw = text.slice(start, end).replace(/\s+/g, ' ').trim();
    return `${start > 0 ? '… ' : ''}${raw}${end < text.length ? ' …' : ''}`;
  };
  const jumpToResult = (p) => {
    setCurrentPage(p);
    setShowSearch(false);
    setQuery('');
    setResults([]);
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
  const cardBg = isDark ? '#111111' : '#ffffff'; // qoladi (modallar uchun), lekin page kartasi TRANSPARENT bo‘ladi
  const surface = isDark ? '#2a2a2a' : '#ffffff';
  const border = '#e5e7eb';
  const progressTrack = isDark ? '#333' : '#e5e7eb';
  const progressBar = isDark ? '#f5f5f5' : '#1c1c1c';
  const iconColor = isDark ? '#f5f5f5' : '#111';
  const readArr = Array.from(readPages);

  // Til auto
  const sample = (pages[currentPage] || '').slice(0, 200);
  const isCyr = /[\u0400-\u04FF]/.test(sample);
  const langAttr = isCyr ? 'uz-Cyrl' : 'uz';

  // clamp
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const safeWordSpacing = clamp(wordSpacing, -0.5, 2);
  const safeLetterSpacing = clamp(letterSpacing, -0.5, 1.5);
  const safePageMargin = clamp(pageMargin, 0, 64);

  // Matn style (qora fon yo‘q!)
  const pageTextStyle = {
    whiteSpace: 'pre-wrap',
    lineHeight: '1.8',
    fontSize: `${fontSize}px`,
    fontFamily: fontFamily,
    margin: '0 auto',
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
    backgroundColor: 'transparent', // <<<
    borderRadius: '12px',
  };

  // Sahifa “kartasi” – TRANSPARENT, yumshoq soya saqladik juda past darajada
  const pageCardStyle = {
    margin: '0 auto 3.6rem',
    padding: 0,
    background: 'transparent', // <<<< qora fon olib tashlandi
    borderRadius: 16,
    boxShadow: isDark
      ? '0 10px 28px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.18)'
      : '0 12px 30px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  };

  // Edge gradient (faqat o‘tishda, juda nozik)
  const EdgeShadow = ({ flowAxis, side, opacity }) => {
    const common = {
      position: 'absolute',
      pointerEvents: 'none',
      zIndex: 3,
      opacity,
      transition: 'opacity 120ms ease',
      mixBlendMode: isDark ? 'screen' : 'multiply',
    };
    if (flowAxis === 'horizontal') {
      const w = 36;
      if (side === 'left') {
        return <div style={{ ...common, top: 0, bottom: 0, left: 0, width: w, background: 'linear-gradient(to right, rgba(0,0,0,0.22), rgba(0,0,0,0))' }} />;
      }
      return <div style={{ ...common, top: 0, bottom: 0, right: 0, width: 36, background: 'linear-gradient(to left, rgba(0,0,0,0.22), rgba(0,0,0,0))' }} />;
    } else {
      const h = 36;
      if (side === 'top') {
        return <div style={{ ...common, left: 0, right: 0, top: 0, height: h, background: 'linear-gradient(to bottom, rgba(0,0,0,0.22), rgba(0,0,0,0))' }} />;
      }
      return <div style={{ ...common, left: 0, right: 0, bottom: 0, height: 36, background: 'linear-gradient(to top, rgba(0,0,0,0.22), rgba(0,0,0,0))' }} />;
    }
  };

  const renderPageCard = (idx, withRef = false) => (
    <div style={pageCardStyle}>
      <pre
        className="reader-text"
        ref={withRef ? textWrapRef : undefined}
        lang={langAttr}
        style={pageTextStyle}
        onMouseUp={withRef ? (e)=>{ if (textWrapRef.current?.contains(e.target)) showAddMenuForSelection(e); } : undefined}
      >
        {renderWithHighlights(pages[idx] || '', idx)}
      </pre>
    </div>
  );

  // Transformlarni hisoblash
  const getTransforms = () => {
    if (!anim.active) return null;
    const p = axisSize ? Math.min(1, Math.abs(anim.dragPx) / axisSize) : 0;
    const shadowOpacity = 0.12 + p * 0.20;

    if (anim.stage === 'drag') {
      const currTr = anim.flowForAnim === 'horizontal'
        ? `translateX(${anim.dragPx}px)` : `translateY(${anim.dragPx}px)`;
      const base = (anim.dir === 'next' ? axisSize : -axisSize);
      const tgtShift = base + anim.dragPx;
      const targTr = anim.flowForAnim === 'horizontal'
        ? `translateX(${tgtShift}px)` : `translateY(${tgtShift}px)`;
      return { currTr, targTr, duration: 0, shadowOpacity };
    }
    if (anim.stage === 'run') {
      const goingOut = anim.commit && anim.target != null;
      const currEnd = goingOut ? (anim.dir === 'next' ? -axisSize : axisSize) : 0;
      const targEnd = goingOut ? 0 : (anim.dir === 'next' ? axisSize : -axisSize);
      const currTr = anim.flowForAnim === 'horizontal'
        ? `translateX(${currEnd}px)` : `translateY(${currEnd}px)`;
      const targTr = anim.flowForAnim === 'horizontal'
        ? `translateX(${targEnd}px)` : `translateY(${targEnd}px)`;
      return { currTr, targTr, duration: 260, shadowOpacity: goingOut ? 0.24 : 0.12 };
    }
    return null;
  };
  const tr = getTransforms();

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
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
        touchAction: flow === 'horizontal' ? 'pan-y' : 'pan-x',
        userSelect: anim.stage === 'drag' ? 'none' : 'auto', // drag payti tanlanmasin
      }}
      onClick={(e) => {
        if (hlMenu.visible && !e.target.closest?.('[data-hl-menu]')) {
          setHlMenu(m => ({ ...m, visible:false }));
        }
      }}
    >
      {/* TOP BAR */}
      <div data-block-nav="true" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <button data-block-nav="true" onClick={(e)=>{e.stopPropagation(); navigate('/');}} title="Orqaga" style={{ background:'transparent', border:'none', padding:4, cursor:'pointer' }}>
          <IoChevronBack size={24} color={iconColor} />
        </button>

        <button data-block-nav="true" onClick={(e)=>{ e.stopPropagation(); openReadList(); }} title="O‘qilgan sahifalar" style={{ fontSize:12, padding:'6px 10px', borderRadius:999, border:`1px solid ${border}`, background:isDark?'#1b1b1b':'#f8f8f8', color:isDark?'#f3f4f6':'#111', minWidth:44, textAlign:'center', userSelect:'none', cursor:'pointer', marginLeft:'33px' }}>
          {progress}%
        </button>

        <div data-block-nav="true" style={{ display:'flex', gap:12, alignItems:'center' }}>
          <button data-block-nav="true" onClick={(e)=>{ e.stopPropagation(); setShowSearch(v=>!v); }} title="Qidiruv" style={{ background:'transparent', border:'none', padding:4, cursor:'pointer' }}>
            <IoSearchSharp size={22} color={iconColor} />
          </button>
          <button data-block-nav="true" onClick={(e)=>{ e.stopPropagation(); setShowSettings(true); }} title="Sozlamalar" style={{ background:'transparent', border:'none', padding:4, cursor:'pointer' }}>
            <IoSettingsSharp size={24} color={iconColor} />
          </button>
        </div>
      </div>

      {/* Progress */}
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
      <div style={{ position:'relative', minHeight:'40vh' }}>
        {!anim.active && renderPageCard(currentPage, true)}

        {anim.active && (
          <>
            {/* current layer */}
            <div
              style={{
                position: 'absolute', inset: 0, overflow: 'hidden', willChange: 'transform', zIndex: 2,
                transform: tr ? tr.currTr : 'none',
                transition: tr && tr.duration ? `transform ${tr.duration}ms cubic-bezier(.22,.61,.36,1)` : 'none',
              }}
            >
              {renderPageCard(currentPage, false)}
              {anim.flowForAnim === 'horizontal'
                ? <EdgeShadow flowAxis="horizontal" side={anim.dir === 'next' ? 'left' : 'right'} opacity={tr ? tr.shadowOpacity : 0.18} />
                : <EdgeShadow flowAxis="vertical" side={anim.dir === 'next' ? 'top' : 'bottom'} opacity={tr ? tr.shadowOpacity : 0.18} />
              }
            </div>

            {/* target layer */}
            <div
              onTransitionEnd={finishAnim}
              style={{
                position: 'absolute', inset: 0, overflow: 'hidden', willChange: 'transform', zIndex: 1,
                transform: tr ? tr.targTr : 'none',
                transition: tr && tr.duration ? `transform ${tr.duration}ms cubic-bezier(.22,.61,.36,1)` : 'none',
              }}
            >
              {renderPageCard(anim.target ?? currentPage, false)}
            </div>
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
            : `0–${currentPage + 1} sahifalarni o‘qildi deb belgilash`
        }
        style={{
          position: 'fixed', right: 10, bottom: 18, zIndex: 600,
          padding: '10px 12px', borderRadius: 999, border: `1px solid ${border}`,
          background: isCurrentRead ? (isDark ? '#15361c' : '#e8f5ee') : (isDark ? '#1b1b1b' : '#f8f8f8'),
          color: isCurrentRead ? (isDark ? '#c1f2d3' : '#0f5132') : (isDark ? '#f5f5f5' : '#111'),
          fontSize: 13, boxShadow: '0 2px 6px rgba(0,0,0,0.12)', cursor: 'pointer', userSelect:'none',
        }}
      >
        {isCurrentRead ? 'O‘qilgan' : 'O‘qildi deb belgilash'}
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

      {/* SEARCH PANEL */}
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

      {/* READ LIST */}
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

      {/* PAGE JUMP */}
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
              // 🆕 Yangi propslar:
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
