import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadFormattedPdfPages } from '../utils/pdfUtils';
import { useTelegram, tg } from '../hooks/useTelegram';
import SettingsPanel from '../components/SettingsPanel';
import { IoSettingsSharp, IoChevronBack } from 'react-icons/io5';

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

  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('fontSize');
    return saved ? parseInt(saved) : 16;
  });
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('fontFamily') || 'Times New Roman');
  const [background, setBackground] = useState(() => localStorage.getItem('background') || '#ffffff');
  const [brightness, setBrightness] = useState(() => {
    const saved = localStorage.getItem('brightness');
    return saved ? parseInt(saved) : 100;
  });

  useEffect(() => {
    if (showSettings) {
      setTimeout(() => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  }, [showSettings]);

  useEffect(() => {
    const savedFontSize = localStorage.getItem('fontSize');
    const savedFont = localStorage.getItem('fontFamily');
    const savedBg = localStorage.getItem('background');
    const savedBrightness = localStorage.getItem('brightness');

    if (savedFontSize) setFontSize(parseInt(savedFontSize));
    if (savedFont) setFontFamily(savedFont);
    if (savedBg) setBackground(savedBg);
    if (savedBrightness) setBrightness(parseInt(savedBrightness));
  }, []);

  useEffect(() => {
    localStorage.setItem('fontSize', fontSize.toString());
    localStorage.setItem('fontFamily', fontFamily);
    localStorage.setItem('background', background);
    localStorage.setItem('brightness', brightness.toString());
  }, [fontSize, fontFamily, background, brightness]);

  useEffect(() => {
    tg.ready();
    loadFormattedPdfPages('/books/test.pdf')
      .then((loadedPages) => {
        setPages(loadedPages);
        const savedPage = localStorage.getItem(`lastPage-${bookId}`);
        if (savedPage !== null) {
          const page = parseInt(savedPage);
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

  useEffect(() => {
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.overflowX = 'hidden';
    return () => {
      document.body.style.overflowX = '';
      document.documentElement.style.overflowX = '';
    };
  }, []);

  const goNext = useCallback(() => {
    setCurrentPage((p) => (p < pages.length - 1 ? p + 1 : p));
  }, [pages.length]);

  const goPrev = useCallback(() => {
    setCurrentPage((p) => (p > 0 ? p - 1 : p));
  }, []);

  const goHome = () => navigate('/');

  // -------------------- Swipe / Tap nav --------------------
  const threshold = 50;
  const tapZonePercent = 0.25;

  const startX = useRef(0);
  const startY = useRef(0);
  const moved = useRef(false);

  const guardBlocked = useCallback(() => (showSettings || showJumpModal), [showSettings, showJumpModal]);

  const onTouchStart = useCallback((e) => {
    if (guardBlocked()) return;
    const t = e.touches?.[0];
    if (!t) return;
    startX.current = t.clientX;
    startY.current = t.clientY;
    moved.current = false;
  }, [guardBlocked]);

  const onTouchMove = useCallback((e) => {
    if (guardBlocked()) return;
    const t = e.touches?.[0];
    if (!t) return;
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved.current = true;
  }, [guardBlocked]);

  const onTouchEnd = useCallback((e) => {
    if (guardBlocked()) return;
    const c = e.changedTouches?.[0];
    if (!c) return;

    const dx = c.clientX - startX.current;
    const dy = c.clientY - startY.current;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= threshold) {
      if (dx < 0) goNext(); else goPrev();
      return;
    }

    if (!moved.current) {
      const w = window.innerWidth || document.documentElement.clientWidth;
      if (c.clientX <= w * tapZonePercent) goPrev();
      else if (c.clientX >= w * (1 - tapZonePercent)) goNext();
    }
  }, [guardBlocked, goNext, goPrev]);

  const downX = useRef(0), downY = useRef(0);
  const onPointerDown = useCallback((e) => {
    if (guardBlocked()) return;
    downX.current = e.clientX;
    downY.current = e.clientY;
    moved.current = false;
  }, [guardBlocked]);

  const onPointerMove = useCallback((e) => {
    if (guardBlocked()) return;
    const dx = e.clientX - downX.current;
    const dy = e.clientY - downY.current;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved.current = true;
  }, [guardBlocked]);

  const onPointerUp = useCallback((e) => {
    if (guardBlocked()) return;

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
  }, [guardBlocked, goNext, goPrev]);
  // --------------------------------------------------------

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
        color: background === '#1e1e1e' ? '#f0f0f0' : '#222',
        filter: `brightness(${brightness}%)`,
        transition: 'filter 0.3s ease',
        position: 'relative',
        overflowX: 'hidden',
        touchAction: 'pan-y',
      }}
    >
      {/* TOP BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <IoChevronBack size={24} onClick={goHome} style={{ cursor: 'pointer' }} />
        <IoSettingsSharp size={24} onClick={() => setShowSettings(true)} style={{ cursor: 'pointer' }} />
      </div>

      {/* HEADER */}
      {currentPage === 0 ? (
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: 4, fontFamily }}>Икки Эшик Ораси</h1>
          <h2 style={{ fontSize: '18px', color: '#666', fontFamily }}>1-БОБ Совуқ хабар</h2>
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          fontWeight: 600,
          marginBottom: '1rem',
          fontSize: '16px',
          color: '#666',
          fontFamily
        }}>
          {Math.floor(currentPage / 10) + 1} -БОБ
        </div>
      )}

      {/* CONTENT */}
      <pre
        className="reader-text"
        style={{
          whiteSpace: 'pre-wrap',
          lineHeight: '1.8',
          fontSize: `${fontSize}px`,
          fontFamily: fontFamily,
          marginBottom: '3rem',
          overflowX: 'hidden',
          maxWidth: '100%',
        }}
      >
        {pages[currentPage]}
      </pre>

      {/* PAGE INDICATOR */}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          zIndex: 500,
          fontSize: '14px',
          color: '#666',
          cursor: 'pointer',
          backgroundColor: '#f2f2f2',
          padding: '6px 12px',
          borderRadius: '12px',
          maxWidth: '160px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        }}
        onClick={() => setShowJumpModal(true)}
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
              type="number"
              placeholder="Sahifa raqamini kiriting"
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const page = parseInt(jumpInput);
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
