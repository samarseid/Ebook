import React, { useEffect, useRef } from 'react';
import './SettingsPanel.css';

interface SettingsProps {
  fontSize: number;
  setFontSize: (size: number) => void;
  fontFamily: string;
  setFontFamily: (font: string) => void;
  background: string;
  setBackground: (color: string) => void;
  brightness: number;
  setBrightness: (b: number) => void;
  // ⬇️ Yangi: sahifa oqimi (Horizontal / Vertical)
  flow: 'horizontal' | 'vertical';
  setFlow: (f: 'horizontal' | 'vertical') => void;
  onClose: () => void;
}

const BG_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '#ffffff', label: 'Oq' },
  { value: '#fdf6e3', label: 'Sepia' },
  { value: '#f5efe6', label: 'Cream' },
  { value: '#1e1e1e', label: 'Tungi' },
];

const FONT_OPTIONS: Array<{ value: string; label: string; stack: string }> = [
  { value: 'Times New Roman', label: 'Times New Roman', stack: `'Times New Roman', Times, serif` },
  { value: 'Inter',           label: 'Inter',           stack: `Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji'` },
  { value: 'Georgia',         label: 'Georgia',         stack: `Georgia, 'Times New Roman', Times, serif` },
  { value: 'Roboto Slab',     label: 'Roboto Slab',     stack: `'Roboto Slab', 'Noto Serif', Georgia, serif` },
  { value: 'Merriweather',    label: 'Merriweather',    stack: `Merriweather, Georgia, 'Times New Roman', serif` },
];

const FLOW_OPTIONS: Array<{ value: 'horizontal' | 'vertical'; label: string; icon: string }> = [
  { value: 'horizontal', label: 'Horizontal', icon: '↔︎' },
  { value: 'vertical',   label: 'Vertical',   icon: '↕︎' },
];

// HEX rangdan “dark/light”ni aniqlash (kontrast uchun)
const isColorDark = (hex: string) => {
  try {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 140;
  } catch {
    return false;
  }
};

const SettingsPanel: React.FC<SettingsProps> = ({
  fontSize,
  setFontSize,
  fontFamily,
  setFontFamily,
  background,
  setBackground,
  brightness,
  setBrightness,
  flow,
  setFlow,
  onClose,
}) => {
  const sliderRef = useRef<HTMLInputElement>(null);

  // Font size ni localStorage’dan o‘qish (bor bo‘lsa)
  useEffect(() => {
    const savedSize = localStorage.getItem('fontSize');
    if (savedSize) setFontSize(Number(savedSize));
  }, [setFontSize]);

  // Font size saqlash
  useEffect(() => {
    localStorage.setItem('fontSize', String(fontSize));
  }, [fontSize]);

  // Boshqa sozlamalarni ham LS ga yozib boramiz
  useEffect(() => {
    localStorage.setItem('fontFamily', fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    localStorage.setItem('background', background);
  }, [background]);

  useEffect(() => {
    localStorage.setItem('brightness', String(brightness));
  }, [brightness]);

  // ⬇️ Flow (Horizontal/Vertical) – o‘qish/saqlash
  useEffect(() => {
    const saved = localStorage.getItem('readFlow');
    if (saved === 'horizontal' || saved === 'vertical') {
      setFlow(saved);
    }
  }, [setFlow]);

  useEffect(() => {
    if (flow) localStorage.setItem('readFlow', flow);
  }, [flow]);

  // Yorug‘lik slideri gradenti
  useEffect(() => {
    if (sliderRef.current) {
      const percent = brightness;
      sliderRef.current.style.background = `linear-gradient(to right, orange 0%, orange ${percent}%, #ddd ${percent}%, #ddd 100%)`;
    }
  }, [brightness]);

  return (
    <>
      {/* Orqa fon — bosilganda yopiladi */}
      <div className="settings-overlay" onClick={onClose} />

      {/* Asosiy panel */}
      <div
        className="settings-panel"
        data-block-nav="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sahifa oqimi (YANGI) */}
        <h3>Sahifa oqimi</h3>
        <div
          className="button-group"
          role="group"
          aria-label="Sahifa oqimini tanlang"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}
        >
          {FLOW_OPTIONS.map(({ value, label, icon }) => {
            const selected = flow === value;
            return (
              <button
                key={value}
                type="button"
                className={`seg-btn ${selected ? 'selected' : ''}`}
                aria-pressed={selected}
                onClick={() => setFlow(value)}
                style={{
                  borderRadius: 12,
                  border: selected ? '2px solid orange' : '1px solid #ddd',
                  padding: '10px 12px',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  cursor: 'pointer',
                  boxShadow: selected ? '0 0 0 3px rgba(255,165,0,0.15)' : 'none',
                }}
              >
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span style={{ fontSize: 14, color: '#333' }}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Yorug‘lik */}
        <h3>Yorug‘lik</h3>
        <div className="slider-row">
          <span aria-hidden>🌙</span>
          <input
            ref={sliderRef}
            type="range"
            min={0}
            max={100}
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="slider"
            aria-label="Yorug‘lik darajasi"
          />
          <span aria-hidden>☀️</span>
        </div>

        {/* Fon rangi */}
        <h3>Fon rangi</h3>
        <div
          className="button-group"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}
        >
          {BG_OPTIONS.map(({ value, label }) => {
            const dark = isColorDark(value);
            const selected = background === value;
            return (
              <button
                key={value}
                type="button"
                className={`color-btn ${selected ? 'selected' : ''}`}
                aria-pressed={selected}
                title={label}
                onClick={() => setBackground(value)}
                style={{
                  height: 44,
                  borderRadius: 10,
                  border: selected ? '2px solid orange' : '1px solid #ccc',
                  backgroundColor: value,
                  color: dark ? '#fff' : '#111',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  boxShadow: selected ? '0 0 0 3px rgba(255,165,0,0.15)' : 'none',
                  userSelect: 'none',
                  cursor: 'pointer',
                }}
              >
                Aa
              </button>
            );
          })}
        </div>

        {/* Shrift turi */}
        <h3>Yozuv turi</h3>
        <div className="button-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {FONT_OPTIONS.map(({ value, label, stack }) => {
            const selected = fontFamily === value;
            return (
              <button
                key={value}
                type="button"
                className={`font-btn ${selected ? 'selected' : ''}`}
                aria-pressed={selected}
                onClick={() => setFontFamily(value)}
                style={{
                  borderRadius: 12,
                  border: selected ? '2px solid orange' : '1px solid #ddd',
                  padding: '10px 12px',
                  textAlign: 'left',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontFamily: stack, fontSize: 18, lineHeight: 1.1 }}>Aa</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{label}</div>
              </button>
            );
          })}
        </div>

        {/* Shrift kattaligi */}
        <h3>Yozuv kattaligi</h3>
        <div className="button-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => setFontSize(Math.max(12, fontSize - 2))}
            disabled={fontSize <= 12}
            aria-label="Shriftni kichraytirish"
            style={{
              borderRadius: 10,
              border: '1px solid #ddd',
              padding: '8px 12px',
              background: '#fff',
              cursor: fontSize <= 12 ? 'not-allowed' : 'pointer',
              opacity: fontSize <= 12 ? 0.5 : 1,
              fontWeight: 700,
            }}
          >
            A-
          </button>

          <span style={{ minWidth: 56, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
            {fontSize}px
          </span>

          <button
            type="button"
            onClick={() => setFontSize(Math.min(40, fontSize + 2))}
            disabled={fontSize >= 40}
            aria-label="Shriftni kattalashtirish"
            style={{
              borderRadius: 10,
              border: '1px solid #ddd',
              padding: '8px 12px',
              background: '#fff',
              cursor: fontSize >= 40 ? 'not-allowed' : 'pointer',
              opacity: fontSize >= 40 ? 0.5 : 1,
              fontWeight: 700,
            }}
          >
            A+
          </button>
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;
