// src/pages/Reader.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadFormattedPdfPages } from '../utils/pdfUtils';
import { useTelegram, tg } from '../hooks/useTelegram';
import SettingsPanel from '../components/SettingsPanel';
import { IoSettingsSharp, IoChevronBack, IoSearchSharp } from 'react-icons/io5';

const HL_KEY = (bookId) => `highlights:${bookId}`;

const Reader = () => {
  const { user } = useTelegram();
  const navigate = useNavigate();

  const bookId = 'test.pdf'; // bu kitob nomi

  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showJumpModal, setShowJumpModal] = useState(false);
  const [jumpInput, setJumpInput] = useState('');
  const [showReadList, setShowReadList] = useState(false); // O‘qilganlar ro‘yxati

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

  // oqim (SettingsPanel bilan bog‘lanadi)
  const [flow, setFlow] = useState(() => {
    const saved = localStorage.getItem('readFlow');
    return saved === 'vertical' || saved === 'horizontal' ? saved : 'horizontal';
  });
  useEffect(() => { localStorage.setItem('readFlow', flow); }, [flow]);

  // O'qilgan sahifalar (Set) + persist
  const [readPages, setReadPages] = useState(() => {
    try {
      const saved = localStorage.getItem(`read-${bookId}`);
      if (!saved) return new Set();
      const arr = JSON.parse(saved);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });

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

  const toggleReadCurrent = () => {
    setReadPages(prev => {
      const next = new Set(prev);
      if (next.has(currentPage)) next.delete(currentPage);
      else next.add(currentPage);
      return next;
    });
  };

  // HEX rang yorug' (light) yoki qorong'i (dark)
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

  useEffect(() => {
    localStorage.setItem(`read-${bookId}`, JSON.stringify(Array.from(readPages)));
  }, [readPages, bookId]);

  // 🔍 Qidiruv holatlari
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]); // [{ page, snippet }]
  useEffect(() => { if (showSettings) setTimeout(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }), 50); }, [showSettings]); useEffect(() => { if (showSearch) setTimeout(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }), 50); }, [showSearch]);
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
  const textWrapRef = useRef(null); // <pre> ichidagi text container
  const [highlights, setHighlights] = useState(() => {
    try {
      const raw = localStorage.getItem(HL_KEY(bookId));
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(HL_KEY(bookId), JSON.stringify(highlights));
  }, [highlights]);

  // Tanlov menyusi
  const [hlMenu, setHlMenu] = useState({
    visible: false, x: 0, y: 0,
    mode: 'add',           // add | remove
    targetHighlightId: null
  });

  // Tanlangan diapazon (offsetlar)
  const selectionOffsetsRef = useRef({ start: null, end: null });

  // Matn tugunlari bo‘yicha global offset hisoblash
  const getTextOffset = (root, node, nodeOffset) => {
    let offset = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let current;
    while ((current = walker.nextNode())) {
      if (current === node) {
        return offset + nodeOffset;
      }
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

  // Yoritmani qo‘shish
 const addHighlight = (page, start, end, color = '#fff59d') => {
  let ns = Math.min(start, end);
  let ne = Math.max(start, end);

  // faqat bo‘sh joy tanlangan bo‘lsa — NO-OP
  const text = pages[page] || '';
  const slice = text.slice(ns, ne);
  if (!slice || !slice.trim()) {
    setHlMenu(m => ({ ...m, visible:false }));
    window.getSelection()?.removeAllRanges();
    return;
  }

  setHighlights(prev => {
    // Sahifa bo‘yicha ajratamiz
    const keepOther = prev.filter(h => h.page !== page);
    const samePage  = prev.filter(h => h.page === page);

    // 1) Agar TANLOV allaqachon mavjud highlight ICHIDA bo‘lsa -> NO-OP (hech narsa qilmaymiz)
    for (const h of samePage) {
      if (isCoveredBy(h.start, h.end, ns, ne)) {
        return prev; // hech qanday o‘zgarish yo‘q
      }
    }

    // 2) Qisman kesishganlarni birlashtirish (no ko‘paytirish)
    let blocks = [...samePage];
    // Tanlovni yangi element sifatida qo‘shib, keyin merge qilamiz:
    blocks.push({ id: 'tmp', page, start: ns, end: ne, color });

    // Faqat start/end ranglari bilan birga sahifaning intervallarini normalizatsiya qilamiz
    const merged = mergePageRanges(
      blocks.map(({ start, end }) => ({ start, end }))
    );

    // mergePageRanges rang saqlamaydi — qayta yasalgan disjoint interval ro‘yxat
    const normalized = merged.map(r => ({
      id: `${page}-${r.start}-${r.end}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      page,
      start: r.start,
      end: r.end,
      color
    }));

    return [...keepOther, ...normalized];
  });

  setHlMenu({ visible: false, x: 0, y: 0, mode: 'add', targetHighlightId: null });
  selectionOffsetsRef.current = { start: null, end: null };
  window.getSelection()?.removeAllRanges();
};


  // Yoritmani o‘chirish
  const removeHighlight = (id) => {
    setHighlights(prev => prev.filter(h => h.id !== id));
    setHlMenu({ visible: false, x: 0, y: 0, mode: 'add', targetHighlightId: null });
  };

  // Tanlashdan keyin menyuni ko‘rsatish
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

  // Yoritilgan bo‘lakni bosganda (remove menyusi)
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

  // Sahifa matnini highlight bilan render qilish
const renderWithHighlights = (text, pageIndex) => {
  const pageHls = highlights
    .filter(h => h.page === pageIndex)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  if (pageHls.length === 0) return text;

  const out = [];
  let cursor = 0;

  for (const h of pageHls) {
    let s = Math.max(0, Math.min(text.length, h.start));
    let e = Math.max(0, Math.min(text.length, h.end));

    if (e <= cursor) continue;   // allaqachon chizilgan qism
    if (s < cursor) s = cursor;  // qisman ustma-ust bo‘lsa, boshlanishni ko‘tar

    if (cursor < s) out.push(text.slice(cursor, s));
    out.push(
      <mark
        key={`${h.id}-${s}-${e}`}
        data-block-nav="true"
        onMouseDown={(e)=>e.stopPropagation()}
        onTouchStart={(e)=>e.stopPropagation()}
        onClick={(e) => showRemoveMenuFor(e, h.id)}
        style={{ background: h.color || '#fff59d', padding: '0 0.5px', borderRadius: '2px' }}
      >
        {text.slice(s, e)}
      </mark>
    );
    cursor = e;
  }

  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
};

// ======== HIGHLIGHT HELPERS ========
const rangesOverlap = (aStart, aEnd, bStart, bEnd) => !(aEnd <= bStart || bEnd <= aStart);
const isCoveredBy = (outerStart, outerEnd, innerStart, innerEnd) =>
  outerStart <= innerStart && innerEnd <= outerEnd;

// Berilgan sahifadagi highlightlarni birlashtirib, QO'SHILMAYDIGAN (disjoint) ro‘yxat qaytaradi
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

  // ======== PAGE SLIDE ANIMATSIYASI ========
  const threshold = 50;
  const startX = useRef(0);
  const startY = useRef(0);

  const guardBlocked = useCallback(
    () => showSettings || showJumpModal || showSearch || showReadList || hlMenu.visible,
    [showSettings, showJumpModal, showSearch, showReadList, hlMenu.visible]
  );
  const shouldBlockFromTarget = (t) => (t?.closest && t.closest('[data-block-nav="true"]')) ? true : false;

  // anim holati
  const [anim, setAnim] = useState({
    active: false,
    stage: 'idle',            // 'idle' | 'prep' | 'run'
    dir: 'next',              // 'next' | 'prev'
    flowForAnim: 'horizontal',
    target: null
  });

  // anim boshlash
  const startAnim = (targetIndex, dir) => {
    if (anim.active) return;
    if (targetIndex < 0 || targetIndex >= pages.length || targetIndex === currentPage) return;
    setAnim({ active: true, stage: 'prep', dir, flowForAnim: flow, target: targetIndex });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setAnim(a => ({ ...a, stage: 'run' }));
    }));
  };

  // touch/pointer
  const onTouchStart = useCallback((e) => {
    if (guardBlocked() || anim.active) return;
    if (shouldBlockFromTarget(e.target)) return;
    const t = e.touches?.[0]; if (!t) return;
    startX.current = t.clientX; startY.current = t.clientY;
  }, [guardBlocked, anim.active]);

  const onTouchEnd = useCallback((e) => {
    // highlight tanlash yakuni — menyuni chiqarish uchun ham ishlatamiz
    if (textWrapRef.current && textWrapRef.current.contains(e.target)) {
      setTimeout(() => showAddMenuForSelection(e), 0);
    }
    if (guardBlocked() || anim.active) return;
    if (shouldBlockFromTarget(e.target)) return;
    const c = e.changedTouches?.[0]; if (!c) return;
    const dx = c.clientX - startX.current;
    const dy = c.clientY - startY.current;

    if (flow === 'horizontal') {
      if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) startAnim(currentPage + 1, 'next');
        else startAnim(currentPage - 1, 'prev');
      }
    } else {
      if (Math.abs(dy) >= threshold && Math.abs(dy) > Math.abs(dx)) {
        if (dy < 0) startAnim(currentPage + 1, 'next');
        else startAnim(currentPage - 1, 'prev');
      }
    }
  }, [guardBlocked, flow, currentPage, anim.active, pages.length]);

  const downX = useRef(0), downY = useRef(0);
  const onPointerDown = useCallback((e) => {
    if (guardBlocked() || anim.active) return;
    if (shouldBlockFromTarget(e.target)) return;
    downX.current = e.clientX; downY.current = e.clientY;
  }, [guardBlocked, anim.active]);

  const onPointerUp = useCallback((e) => {
    // sichqoncha bilan belgilash — menyu
    if (textWrapRef.current && textWrapRef.current.contains(e.target)) {
      setTimeout(() => showAddMenuForSelection(e), 0);
    }
    if (guardBlocked() || anim.active) return;
    if (shouldBlockFromTarget(e.target)) return;
    const dx = e.clientX - downX.current;
    const dy = e.clientY - downY.current;

    if (flow === 'horizontal') {
      if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) startAnim(currentPage + 1, 'next');
        else startAnim(currentPage - 1, 'prev');
      }
    } else {
      if (Math.abs(dy) >= threshold && Math.abs(dy) > Math.abs(dx)) {
        if (dy < 0) startAnim(currentPage + 1, 'next');
        else startAnim(currentPage - 1, 'prev');
      }
    }
  }, [guardBlocked, flow, currentPage, anim.active]);

  // klaviatura
  const onKeyDown = useCallback((e) => {
    if (guardBlocked() || anim.active) return;
    if (flow === 'horizontal') {
      if (e.key === 'ArrowRight') startAnim(currentPage + 1, 'next');
      if (e.key === 'ArrowLeft')  startAnim(currentPage - 1, 'prev');
    } else {
      if (e.key === 'ArrowDown')  startAnim(currentPage + 1, 'next');
      if (e.key === 'ArrowUp')    startAnim(currentPage - 1, 'prev');
    }
    if (e.key.toLowerCase() === 'r') toggleReadCurrent();
  }, [guardBlocked, flow, currentPage, anim.active]);

  // anim tugashi — yangi sahifani final qilamiz
  const finishAnim = useCallback(() => {
    if (!anim.active) return;
    setCurrentPage(anim.target);
    setAnim({ active: false, stage: 'idle', dir: 'next', flowForAnim: flow, target: null });
  }, [anim, flow]);

  // ------------- Qidiruv yordamchi funksiyalar -------------
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
    setCurrentPage(p);
    setShowSearch(false);
    setQuery('');
    setResults([]);
  };
  // ------------------------------------------------------------

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

  // anim uchun hisob-kitob
  const axis = anim.flowForAnim === 'horizontal' ? 'X' : 'Y';
  const nextFrom = (anim.dir === 'next') ? '100%' : '-100%';
  const currTo  = (anim.dir === 'next') ? '-100%' : '100%';
  const layerBase = { position: 'absolute', inset: 0, overflow: 'hidden', willChange: 'transform' };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onPointerDown={onPointerDown}
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
        touchAction: flow === 'horizontal' ? 'pan-y' : 'pan-x',
      }}
      onClick={() => { if (hlMenu.visible) setHlMenu(m => ({ ...m, visible:false })); }}
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

      {/* ======= PAGE AREA: slayd animatsiya ======= */}
      <div style={{ position:'relative', minHeight:'40vh' }}>
        {/* odatiy (anim yo‘q) */}
        {!anim.active && (
          <pre
            className="reader-text"
            ref={textWrapRef}
            onMouseUp={(e)=>{ if (textWrapRef.current?.contains(e.target)) showAddMenuForSelection(e); }}
            onTouchEnd={(e)=>{ /* touchEnd handler yuqorida ham bor, bu zaxira */ }}
            style={{
              whiteSpace: 'pre-wrap',
              lineHeight: '1.8',
              fontSize: `${fontSize}px`,
              fontFamily: fontFamily,
              marginBottom: '3.6rem',
              overflowX: 'hidden',
              maxWidth: '100%',
              userSelect: 'text'
            }}
          >
            {renderWithHighlights(pages[currentPage] || '', currentPage)}
          </pre>
        )}

        {/* anim payti — ikki qatlam */}
        {anim.active && (
          <>
            {/* joriy qatlam */}
            <div
              style={{
                ...layerBase,
                transform: anim.stage === 'prep'
                  ? `translate${axis}(0%)`
                  : `translate${axis}(${currTo})`,
                transition: anim.stage === 'run' ? 'transform 260ms ease' : 'none',
              }}
            >
              <pre
                className="reader-text"
                style={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.8',
                  fontSize: `${fontSize}px`,
                  fontFamily: fontFamily,
                  marginBottom: '3.6rem',
                  overflowX: 'hidden',
                  maxWidth: '100%',
                }}
              >
                {renderWithHighlights(pages[currentPage] || '', currentPage)}
              </pre>
            </div>

            {/* keyingi/oldingi qatlam */}
            <div
              onTransitionEnd={finishAnim}
              style={{
                ...layerBase,
                transform: anim.stage === 'prep'
                  ? `translate${axis}(${nextFrom})`
                  : `translate${axis}(0%)`,
                transition: anim.stage === 'run' ? 'transform 260ms ease' : 'none',
              }}
            >
              <pre
                className="reader-text"
                style={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.8',
                  fontSize: `${fontSize}px`,
                  fontFamily: fontFamily,
                  marginBottom: '3.6rem',
                  overflowX: 'hidden',
                  maxWidth: '100%',
                }}
              >
                {renderWithHighlights(pages[anim.target ?? currentPage] || '', anim.target ?? currentPage)}
              </pre>
            </div>
          </>
        )}
      </div>

      {/* HIGHLIGHT MENYUSI (floating) */}
      {hlMenu.visible && (
        <div
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
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleReadCurrent(); }}
        title={isCurrentRead ? 'Belgilashni bekor qilish' : 'Ushbu sahifani o‘qildi deb belgilash'}
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

      {/* READ LIST, SEARCH, JUMP MODAL, SETTINGS — mavjuding bilan bir xil */}
      {/* 🔎 Qidiruv sheet */}
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

      {/* JUMP MODAL */}
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

      {/* SETTINGS */}
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
            />
          </div>
        </>
      )}
    </div>
  );
};

export default Reader;
