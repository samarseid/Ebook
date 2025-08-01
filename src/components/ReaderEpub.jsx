// ReaderEpub.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadFormattedEpubPages } from '../utils/epubUtils';
import { useTelegram, tg } from '../hooks/useTelegram';
import SettingsPanel from '../components/SettingsPanel';
import { IoSettingsSharp, IoChevronBack } from 'react-icons/io5';

const ReaderEpub = () => {
  const { user } = useTelegram();
  const navigate = useNavigate();
  const bookId = 'test2.epub';

  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showJumpModal, setShowJumpModal] = useState(false);
  const [jumpInput, setJumpInput] = useState('');

  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('fontSize')) || 16);
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('fontFamily') || 'Times New Roman');
  const [background, setBackground] = useState(() => localStorage.getItem('background') || '#ffffff');
  const [brightness, setBrightness] = useState(() => parseInt(localStorage.getItem('brightness')) || 100);

  useEffect(() => {
    tg.ready();
    loadFormattedEpubPages(`/books/${bookId}`).then((loadedPages) => {
      setPages(loadedPages);
      const savedPage = parseInt(localStorage.getItem(`lastPage-${bookId}`));
      if (!isNaN(savedPage) && savedPage >= 0 && savedPage < loadedPages.length) {
        setCurrentPage(savedPage);
      } else {
        setCurrentPage(0);
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (currentPage !== null) {
      localStorage.setItem(`lastPage-${bookId}`, currentPage.toString());
    }
  }, [currentPage]);

  useEffect(() => {
    localStorage.setItem('fontSize', fontSize.toString());
    localStorage.setItem('fontFamily', fontFamily);
    localStorage.setItem('background', background);
    localStorage.setItem('brightness', brightness.toString());
  }, [fontSize, fontFamily, background, brightness]);

  useEffect(() => {
    if (showSettings) {
      setTimeout(() => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  }, [showSettings]);

  const goHome = () => navigate('/');
  const goNext = () => currentPage < pages.length - 1 && setCurrentPage(currentPage + 1);
  const goPrev = () => currentPage > 0 && setCurrentPage(currentPage - 1);

  if (loading || currentPage === null) {
    return (
      <div style={{
        position: 'fixed', inset: 0, backgroundColor: '#ffffff', display: 'flex',
        justifyContent: 'center', alignItems: 'center', fontSize: '18px', color: '#444', zIndex: 9999,
      }}>
        Yuklanmoqda...
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: background,
        minHeight: '100vh',
        padding: '1rem',
        fontFamily,
        color: background === '#1e1e1e' ? '#f0f0f0' : '#222',
        filter: `brightness(${brightness}%)`,
        overflowX: 'hidden',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <IoChevronBack size={24} onClick={goHome} style={{ cursor: 'pointer' }} />
        <IoSettingsSharp size={24} onClick={() => setShowSettings(true)} style={{ cursor: 'pointer' }} />
      </div>

      {currentPage === 0 ? (
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold' }}>Yaxshiyam Sen Borsan</h1>
          <h2 style={{ fontSize: '18px', color: '#666' }}>1-Bob</h2>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginBottom: '1rem', fontWeight: 600, fontSize: '16px', color: '#666' }}>
          {Math.floor(currentPage / 10) + 1}-Bob
        </div>
      )}

      <pre style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', fontSize, textAlign: 'justify', fontFamily }}>
        {pages[currentPage]}
      </pre>

      <div
  style={{
    position: 'fixed',
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    background: background === '#1e1e1e' ? '#333' : '#f2f2f2',
    color: background === '#1e1e1e' ? '#fff' : '#222',
    padding: '6px 12px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '14px',
    zIndex: 500
  }}
  onClick={() => setShowJumpModal(true)}
>
  {currentPage + 1} / {pages.length}
</div>


      <div style={{ position: 'fixed', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 1.5rem', backgroundColor: background }}>
        <button onClick={goPrev} disabled={currentPage === 0}>⬅ Oldingi</button>
        <button onClick={goNext} disabled={currentPage === pages.length - 1}>Keyingi ➡</button>
      </div>

      {showJumpModal && (
        <div
          onClick={() => setShowJumpModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', paddingBottom: '14px', borderRadius: '16px', width: '100%', maxWidth: '340px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', textAlign: 'center' }}
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
                width: '200px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px', backgroundColor: '#f9f9f9', color: '#333', outline: 'none'
              }}
            />

            <p style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>Enter tugmasini bosing</p>
          </div>
        </div>
      )}

      {showSettings && (
        <>
          <div
            onClick={() => setShowSettings(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 999 }}
          ></div>
          <div
            className="settings-panel"
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              background: '#fff', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
              boxShadow: '0 -4px 16px rgba(0,0,0,0.1)', padding: '20px', zIndex: 1000, maxHeight: '90vh', overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
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
