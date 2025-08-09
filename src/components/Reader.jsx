import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadFormattedPdfPages } from '../utils/pdfUtils';
import { useTelegram, tg } from '../hooks/useTelegram';
import SettingsPanel from '../components/SettingsPanel';
import { IoSettingsSharp, IoChevronBack, IoSearchSharp } from 'react-icons/io5';

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
  const [showReadList, setShowReadList] = useState(false); // ⬅️ O‘qilganlar ro‘yxati

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

  // ✅ O'qilgan sahifalar (Set) + persist
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

  // state-lardan keyin
const openReadList = () => {
  // mobil klaviaturani yopib yuboramiz (bo‘lsa)
  if (document.activeElement?.blur) document.activeElement.blur();

  setShowReadList(true);

  // sheet mount bo‘lgach, pastga silliq tushamiz
  requestAnimationFrame(() => {
    // ba’zi brauzerlarda yana bitta frame kerak bo‘ladi:
    requestAnimationFrame(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth',
      });
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
// HEX rang yorug' (light) yoki qorong'i (dark) ekanini aniqlash
const isColorDark = (hex) => {
  try {
    if (!hex) return false;
    let c = hex.replace('#','');
    if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
    const r = parseInt(c.slice(0,2),16);
    const g = parseInt(c.slice(2,4),16);
    const b = parseInt(c.slice(4,6),16);
    const brightness = (r*299 + g*587 + b*114) / 1000; // perceptual
    return brightness < 140; // threshold
  } catch { return false; }
};

  const clearAllRead = () => {
    if (confirm('Barcha o‘qilgan belgilari o‘chirilsinmi?')) {
      setReadPages(new Set());
    }
  };

  useEffect(() => {
    localStorage.setItem(`read-${bookId}`, JSON.stringify(Array.from(readPages)));
  }, [readPages, bookId]);

  // 🔍 Qidiruv holatlari
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]); // [{ page, snippet }]

  // Settings ochilganda pastga siljitish (dizayn talabi)
  useEffect(() => {
    if (showSettings) {
      setTimeout(() => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  }, [showSettings]);

  // Sozlamalarni yuklash/saqlash
  useEffect(() => {
    const savedFontSize = localStorage.getItem('fontSize');
    const savedFont = localStorage.getItem('fontFamily');
    const savedBg = localStorage.getItem('background');
    const savedBrightness = localStorage.getItem('brightness');

    if (savedFontSize) setFontSize(parseInt(savedFontSize, 10));
    if (savedFont) setFontFamily(savedFont);
    if (savedBg) setBackground(savedBg);
    if (savedBrightness) setBrightness(parseInt(savedBrightness, 10));
  }, []);
  useEffect(() => {
    localStorage.setItem('fontSize', fontSize.toString());
    localStorage.setItem('fontFamily', fontFamily);
    localStorage.setItem('background', background);
    localStorage.setItem('brightness', brightness.toString());
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
    if (pages.length > 0) {
      localStorage.setItem(`lastPage-${bookId}`, currentPage.toString());
    }
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

  // --------- Swipe / Tap navigatsiya (guard bilan) ----------
  const threshold = 50;
  const tapZonePercent = 0.25;

  const startX = useRef(0);
  const startY = useRef(0);
  const moved = useRef(false);

  const guardBlocked = useCallback(
    () => showSettings || showJumpModal || showSearch || showReadList,
    [showSettings, showJumpModal, showSearch, showReadList]
  );

  // ❗️UI element bosilganda navigatsiyani bloklash
  const shouldBlockFromTarget = (target) => {
    if (!target) return false;
    return typeof target.closest === 'function' && !!target.closest('[data-block-nav="true"]');
  };

  const onTouchStart = useCallback((e) => {
    if (guardBlocked()) return;
    if (shouldBlockFromTarget(e.target)) return;
    const t = e.touches?.[0];
    if (!t) return;
    startX.current = t.clientX;
    startY.current = t.clientY;
    moved.current = false;
  }, [guardBlocked]);

  const onTouchMove = useCallback((e) => {
    if (guardBlocked()) return;
    if (shouldBlockFromTarget(e.target)) return;
    const t = e.touches?.[0];
    if (!t) return;
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved.current = true;
  }, [guardBlocked]);

  const onTouchEnd = useCallback((e) => {
    if (guardBlocked()) return;
    if (shouldBlockFromTarget(e.target)) return;
    const c = e.changedTouches?.[0];
    if (!c) return;
    const dx = c.clientX - startX.current;
    const dy = c.clientY - startY.current;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= threshold) {
      if (dx < 0) setCurrentPage((p) => (p < pages.length - 1 ? p + 1 : p));
      else setCurrentPage((p) => (p > 0 ? p - 1 : p));
      return;
    }

    if (!moved.current) {
      const w = window.innerWidth || document.documentElement.clientWidth;
      if (c.clientX <= w * tapZonePercent) setCurrentPage((p) => (p > 0 ? p - 1 : p));
      else if (c.clientX >= w * (1 - tapZonePercent)) setCurrentPage((p) => (p < pages.length - 1 ? p + 1 : p));
    }
  }, [guardBlocked, pages.length]);

  const downX = useRef(0), downY = useRef(0);
  const onPointerDown = useCallback((e) => {
    if (guardBlocked()) return;
    if (shouldBlockFromTarget(e.target)) return;
    downX.current = e.clientX;
    downY.current = e.clientY;
    moved.current = false;
  }, [guardBlocked]);

  const onPointerMove = useCallback((e) => {
    if (guardBlocked()) return;
    if (shouldBlockFromTarget(e.target)) return;
    const dx = e.clientX - downX.current;
    const dy = e.clientY - downY.current;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved.current = true;
  }, [guardBlocked]);

  const onPointerUp = useCallback((e) => {
    if (guardBlocked()) return;
    if (shouldBlockFromTarget(e.target)) return;
    const dx = e.clientX - downX.current;
    const dy = e.clientY - downY.current;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= threshold) {
      if (dx < 0) setCurrentPage((p) => (p < pages.length - 1 ? p + 1 : p));
      else setCurrentPage((p) => (p > 0 ? p - 1 : p));
      return;
    }

    if (!moved.current) {
      const w = window.innerWidth || document.documentElement.clientWidth;
      if (e.clientX <= w * tapZonePercent) setCurrentPage((p) => (p > 0 ? p - 1 : p));
      else if (e.clientX >= w * (1 - tapZonePercent)) setCurrentPage((p) => (p < pages.length - 1 ? p + 1 : p));
    }
  }, [guardBlocked, pages.length]);

  const goHome = () => navigate('/');

  const onKeyDown = useCallback((e) => {
    if (guardBlocked()) return;
    if (e.key === 'ArrowRight') setCurrentPage((p) => (p < pages.length - 1 ? p + 1 : p));
    if (e.key === 'ArrowLeft') setCurrentPage((p) => (p > 0 ? p - 1 : p));
    if (e.key.toLowerCase() === 'r') toggleReadCurrent(); // qulay: "r" bilan belgilash
  }, [guardBlocked, pages.length]);
  // ----------------------------------------------------------

  // ------------- 🔍 Qidiruv yordamchi funksiyalar -------------
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
      if (idx !== -1) {
        found.push({ page: i, snippet: makeSnippet(t, idx, q.length) });
      }
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

  // 🔢 Rojatlar: o‘qilgan sahifalarni compact ko‘rinishga keltirish (1-based ko‘rsatamiz)
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
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#ffffff',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: '18px',
          color: '#444',
          zIndex: 9999,
        }}
      >
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

  return (
    <div
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
        touchAction: 'pan-y',
      }}
    >
      {/* TOP BAR */}
      <div
        data-block-nav="true"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <button
          data-block-nav="true"
          onClick={(e) => { e.stopPropagation(); goHome(); }}
          title="Orqaga"
          style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}
        >
          <IoChevronBack size={24} color={iconColor} />
        </button>

        {/* % badge (bosilsa o‘qilganlar ro‘yxati) */}
        <button
          data-block-nav="true"
          onClick={(e) => { e.stopPropagation(); openReadList(); }}
          title="O‘qilgan sahifalar ro‘yxati"
          style={{
            fontSize: 12,
            padding: '6px 10px',
            borderRadius: 999,
            border: `1px solid ${border}`,
            background: isDark ? '#1b1b1b' : '#f8f8f8',
            color: isDark ? '#f3f4f6' : '#111',
            minWidth: 44,
            textAlign: 'center',
            userSelect: 'none',
             cursor: 'pointer',
            marginLeft: '33px'
          }}
        >
          {progress}%
        </button>

        <div data-block-nav="true" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            data-block-nav="true"
            onClick={(e) => { e.stopPropagation(); setShowSearch(v => !v); }}
            title="Qidiruv"
            style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}
          >
            <IoSearchSharp size={22} color={iconColor} />
          </button>

          <button
            data-block-nav="true"
            onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}
            title="Sozlamalar"
            style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}
          >
            <IoSettingsSharp size={24} color={iconColor}  />
          </button>
        </div>
      </div>

      {/* Yupqa progress chiziq (navbar ostida) */}
      <div
        data-block-nav="true"
        style={{
          height: 4,
          width: '100%',
          background: progressTrack,
          borderRadius: 999,
          overflow: 'hidden',
          margin: '10px 0 12px',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: progressBar,
            borderRadius: 999,
            transition: 'width 220ms ease',
          }}
        />
      </div>

      {/* 🔍 Qidiruv paneli */}
      {showSearch && (
        <div
          data-block-nav="true"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          style={{
            background: surface,
            border: `1px solid ${border}`,
            borderRadius: 12,
            padding: '12px 12px 8px',
            marginBottom: '12px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              data-block-nav="true"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
              placeholder="Matndan qidirish… (Enter)"
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                outline: 'none',
                fontSize: 14,
                background: isDark ? '#1c1c1c' : '#fff',
                color: isDark ? '#f5f5f5' : '#111',
              }}
            />
            <button
              data-block-nav="true"
              onClick={(e) => { e.stopPropagation(); runSearch(); }}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                background: '#1c1c1c',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Qidir
            </button>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
            {searching
              ? 'Qidirilmoqda…'
              : (results.length ? `${results.length} ta sahifa topildi` : (query ? 'Hech narsa topilmadi' : ''))}
          </div>

          {!!results.length && (
            <div
              data-block-nav="true"
              style={{
                marginTop: 8,
                borderTop: `1px dashed ${border}`,
                maxHeight: '40vh',
                overflow: 'auto',
                paddingTop: 8,
              }}
            >
              {results.map((r, idx) => (
                <button
                  key={`${r.page}-${idx}`}
                  data-block-nav="true"
                  onClick={(e) => { e.stopPropagation(); jumpToResult(r.page); }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 8px',
                    borderRadius: 10,
                    border: `1px solid ${border}`,
                    background: cardBg,
                    color: isDark ? '#f3f4f6' : '#111',
                    cursor: 'pointer',
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>
                    Sahifa {r.page + 1}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.4 }}>
                    {r.snippet}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* HEADER */}
      {currentPage === 0 ? (
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: 4, fontFamily }}>Икки Эшик Ораси</h1>
          <h2 style={{ fontSize: '18px', color: textMuted, fontFamily }}>1-БОБ Совуқ хабар</h2>
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          fontWeight: 600,
          marginBottom: '1rem',
          fontSize: '16px',
          color: textMuted,
          fontFamily
        }}>
          {Math.floor(currentPage / 10) + 1} -БОБ
        </div>
      )}

      {/* PDF CONTENT */}
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
        {pages[currentPage]}
      </pre>

      {/* Floating: "O'qildi" / "Bekor qilish" */}
      <button
        data-block-nav="true"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleReadCurrent(); }}
        onTouchStart={(e) => { e.stopPropagation(); }}
        onTouchMove={(e) => { e.stopPropagation(); }}
        onTouchEnd={(e) => { e.stopPropagation(); }}
        onPointerDown={(e) => { e.stopPropagation(); }}
        onPointerMove={(e) => { e.stopPropagation(); }}
        onPointerUp={(e) => { e.stopPropagation(); }}
        title={isCurrentRead ? 'Belgilashni bekor qilish' : 'Ushbu sahifani o‘qildi deb belgilash'}
        style={{
          position: 'fixed',
          right: 10,
          bottom: 18,
          zIndex: 600,
          padding: '10px 12px',
          borderRadius: 999,
          border: `1px solid ${border}`,
          background: isCurrentRead ? (isDark ? '#15361c' : '#e8f5ee') : (isDark ? '#1b1b1b' : '#f8f8f8'),
          color: isCurrentRead ? (isDark ? '#c1f2d3' : '#0f5132') : (isDark ? '#f5f5f5' : '#111'),
          fontSize: 13,
          boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
          cursor: 'pointer',
          userSelect: 'none',
          touchAction: 'manipulation',
        }}
      >
        {isCurrentRead ? 'O‘qilgan' : 'O‘qildi deb belgilash'}
      </button>

      {/* PAGE INDICATOR (bosilganda jump modal) */}
      <div
        data-block-nav="true"
        onClick={(e) => { e.stopPropagation(); setShowJumpModal(true); }}
        style={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          zIndex: 500,
          fontSize: '14px',
          color: textMuted,
          cursor: 'pointer',
          backgroundColor: isDark ? '#2b2b2b' : '#f2f2f2',
          padding: '6px 12px',
          borderRadius: '12px',
          maxWidth: '160px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          userSelect: 'none',
        }}
      >
        {currentPage + 1} / {pages.length}
      </div>

      {/* READ LIST (Bottom Sheet) */}
      {showReadList && (
        <>
          <div
            className="readlist-overlay"
            data-block-nav="true"
            onClick={() => setShowReadList(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.35)',
              zIndex: 1200,
            }}
          />
          <div
            className="readlist-panel"
            data-block-nav="true"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: '#fff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              boxShadow: '0 -8px 24px rgba(0,0,0,0.18)',
              padding: '16px 16px 20px',
              zIndex: 1300,
              maxHeight: '75vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>
                O‘qilganlar ({readArr.length} sahifa)
              </div>
              <button
                data-block-nav="true"
                onClick={(e) => { e.stopPropagation(); clearAllRead(); }}
                style={{
                  background: '#561818ff',
                  border: '1px solid #eee',
                  borderRadius: 10,
                  padding: '6px 10px',
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Tozalash
              </button>
            </div>

            {/* Kompakt ko‘rinish */}
            <div
              style={{
                fontSize: 13,
                color: '#555',
                background: '#f7f7f7',
                border: '1px solid #eee',
                borderRadius: 10,
                padding: '8px 10px',
                marginBottom: 10,
                lineHeight: 1.5
              }}
            >
              {readArr.length ? compactRanges(readArr) : 'Hali sahifalar belgilanmagan'}
            </div>

            {/* Chiplar ro‘yxati */}
            {!!readArr.length && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {readArr.sort((a, b) => a - b).map((p) => (
                  <button
                    key={p}
                    data-block-nav="true"
                    onClick={(e) => { e.stopPropagation(); setCurrentPage(p); setShowReadList(false); }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 999,
                      border: '1px solid #e5e7eb',
                      background: '#fafafa',
                      cursor: 'pointer',
                      fontSize: 12,
                      color: '#111'
                    }}
                    title={`Sahifa ${p + 1}`}
                  >
                    {p + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* JUMP MODAL */}
      {showJumpModal && (
        <div
          onClick={() => setShowJumpModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            data-block-nav="true"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              paddingBottom: '14px',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '340px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              textAlign: 'center',
              transition: 'all 0.3s ease',
            }}
          >
            <h3 style={{ marginBottom: '1rem', fontSize: '18px', fontWeight: '600', color: '#222' }}>
              Sahifa: {currentPage + 1} / {pages.length}
            </h3>

            <input
              data-block-nav="true"
              type="number"
              placeholder="Sahifa raqamini kiriting"
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const page = parseInt(jumpInput, 10);
                  if (!isNaN(page) && page >= 1 && page <= pages.length) {
                    setCurrentPage(page - 1);
                    setShowJumpModal(false);
                    setJumpInput('');
                  }
                }
              }}
              style={{
                width: '200px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                fontSize: '15px',
                backgroundColor: '#f9f9f9',
                color: '#333',
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
            />

            <p style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
              Enter tugmasini bosing
            </p>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettings && (
        <>
          <div
            className="settings-overlay"
            data-block-nav="true"
            onClick={() => setShowSettings(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 999,
            }}
          />

          <div
            className="settings-panel"
            data-block-nav="true"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: '#fff',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              boxShadow: '0 -4px 16px rgba(0,0,0,0.1)',
              padding: '20px',
              zIndex: 1000,
              maxHeight: '90vh',
              overflowY: 'auto',
              transition: 'transform 0.3s ease',
            }}
          >
            <SettingsPanel
              fontSize={fontSize}
              setFontSize={setFontSize}
              fontFamily={fontFamily}
              setFontFamily={setFontFamily}
              background={background}
              setBackground={setBackground}
              brightness={brightness}
              setBrightness={setBrightness}
              onClose={() => setShowSettings(false)}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default Reader;
