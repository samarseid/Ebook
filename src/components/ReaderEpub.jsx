// ReaderEpub.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadFormattedEpubPages } from '../utils/epubUtils';
import { useTelegram, tg } from '../hooks/useTelegram';
import SettingsPanel from '../components/SettingsPanel';
import { IoSettingsSharp, IoChevronBack, IoSearchSharp } from 'react-icons/io5';

const ReaderEpub = () => {
  const { user } = useTelegram();
  const navigate = useNavigate();

  const bookId = 'test2.epub'; // EPUB fayl nomi

  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showJumpModal, setShowJumpModal] = useState(false);
  const [jumpInput, setJumpInput] = useState('');

  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('fontSize') || '16', 10));
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('fontFamily') || 'Times New Roman');
  const [background, setBackground] = useState(() => localStorage.getItem('background') || '#ffffff');
  const [brightness, setBrightness] = useState(() => parseInt(localStorage.getItem('brightness') || '100', 10));

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

  useEffect(() => {
    localStorage.setItem(`read-${bookId}`, JSON.stringify(Array.from(readPages)));
  }, [readPages, bookId]);

  // 🔍 Qidiruv holatlari
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]); // [{ page, snippet }]

  // Settings ochilganda pastga siljitish
  useEffect(() => {
    if (showSettings) {
      setTimeout(() => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  }, [showSettings]);

  // Sozlamalarni saqlash
  useEffect(() => {
    localStorage.setItem('fontSize', String(fontSize));
    localStorage.setItem('fontFamily', fontFamily);
    localStorage.setItem('background', background);
    localStorage.setItem('brightness', String(brightness));
  }, [fontSize, fontFamily, background, brightness]);

  // EPUB yuklash
  useEffect(() => {
    tg.ready();
    loadFormattedEpubPages(`/books/${bookId}`)
      .then((loadedPages) => {
        setPages(loadedPages);
        const saved = localStorage.getItem(`lastPage-${bookId}`);
        const page = saved ? parseInt(saved, 10) : 0;
        if (!isNaN(page) && page >= 0 && page < loadedPages.length) {
          setCurrentPage(page);
        } else {
          setCurrentPage(0);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Sahifani eslab qolish
  useEffect(() => {
    if (pages.length > 0) {
      localStorage.setItem(`lastPage-${bookId}`, String(currentPage));
    }
  }, [currentPage, pages]);

  // X-overflow ni bloklash
  useEffect(() => {
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.overflowX = 'hidden';
    return () => {
      document.body.style.overflowX = '';
      document.documentElement.style.overflowX = '';
    };
  }, []);

  const goHome = () => navigate('/');

  // ------------ Swipe / Tap navigatsiya (Reader bilan bir xil) ------------
  const goNext = useCallback(() => {
    setCurrentPage((p) => (p < pages.length - 1 ? p + 1 : p));
  }, [pages.length]);

  const goPrev = useCallback(() => {
    setCurrentPage((p) => (p > 0 ? p - 1 : p));
  }, []);

  const threshold = 50;          // minimal gorizontal siljish pikseli
  const tapZonePercent = 0.25;   // chap/o‘ng chekka zonasi (25%)

  const startX = useRef(0);
  const startY = useRef(0);
  const moved = useRef(false);

  const guardBlocked = useCallback(
    () => (showSettings || showJumpModal || showSearch),
    [showSettings, showJumpModal, showSearch]
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

    // swipe
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= threshold) {
      if (dx < 0) goNext(); else goPrev();
      return;
    }

    // tap (chekka zonalar)
    if (!moved.current) {
      const w = window.innerWidth || document.documentElement.clientWidth;
      if (c.clientX <= w * tapZonePercent) goPrev();
      else if (c.clientX >= w * (1 - tapZonePercent)) goNext();
    }
  }, [guardBlocked, goNext, goPrev]);

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
      if (dx < 0) goNext(); else goPrev();
      return;
    }

    if (!moved.current) {
      const w = window.innerWidth || document.documentElement.clientWidth;
      if (e.clientX <= w * tapZonePercent) goPrev();
      else if (e.clientX >= w * (1 - tapZonePercent)) goNext();
    }
  }, [guardBlocked, goNext, goPrev]);

  const onKeyDown = useCallback((e) => {
    if (guardBlocked()) return;
    if (e.key === 'ArrowRight') goNext();
    if (e.key === 'ArrowLeft') goPrev();
    if (e.key.toLowerCase() === 'r') toggleReadCurrent(); // R bilan belgilash
  }, [guardBlocked, goNext, goPrev]);
  // ------------------------------------------------------------------------

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

  const isDark = background === '#1e1e1e';
  const textMuted = isDark ? '#c9c9c9' : '#666';
  const cardBg = isDark ? '#121212' : '#fff';
  const surface = isDark ? '#2a2a2a' : '#ffffff';
  const border = '#e5e7eb';
  const progressTrack = isDark ? '#333' : '#e5e7eb';
  const progressBar = isDark ? '#f5f5f5' : '#1c1c1c';

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
          <IoChevronBack size={24} />
        </button>

        {/* % badge */}
        <div
          data-block-nav="true"
          title="O'qilgan foiz"
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
          }}
        >
          {progress}%
        </div>

        <div data-block-nav="true" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            data-block-nav="true"
            onClick={(e) => { e.stopPropagation(); setShowSearch(v => !v); }}
            title="Qidiruv"
            style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}
          >
            <IoSearchSharp size={22} />
          </button>

          <button
            data-block-nav="true"
            onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}
            title="Sozlamalar"
            style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}
          >
            <IoSettingsSharp size={24} />
          </button>
        </div>
      </div>

      {/* Yupqa progress chiziq */}
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
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: 4, fontFamily }}>Yaxshiyam Sen Borsan</h1>
          <h2 style={{ fontSize: '18px', color: textMuted, fontFamily }}>1-Bob</h2>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginBottom: '1rem', fontWeight: 600, fontSize: '16px', color: textMuted, fontFamily }}>
          {Math.floor(currentPage / 10) + 1}-Bob
        </div>
      )}

      {/* CONTENT */}
      <pre
        className="reader-text"
        style={{
          whiteSpace: 'pre-wrap',
          lineHeight: '1.8',
          fontSize: `${fontSize}px`,
          textAlign: 'justify',
          fontFamily,
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
          right: 16,
          bottom: 76,
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
        {isCurrentRead ? '✅ O‘qilgan' : '✅ O‘qildi deb belgilash'}
      </button>

      {/* PAGE INDICATOR (tap to jump) */}
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

            <p style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>Enter tugmasini bosing</p>
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

export default ReaderEpub;
