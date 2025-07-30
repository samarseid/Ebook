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
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsProps> = ({
  fontSize,
  setFontSize,
  fontFamily,
  setFontFamily,
  background,
  setBackground,
  brightness,
  setBrightness,
  onClose,
}) => {
  const sliderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sliderRef.current) {
      const percent = brightness;
      sliderRef.current.style.background = `linear-gradient(to right, orange 0%, orange ${percent}%, #ddd ${percent}%, #ddd 100%)`;
    }
  }, [brightness]);

  return (
    <>
      {/* FON ORQASI: CLICK -> YOPISH */}
      <div className="settings-overlay" onClick={onClose}></div>

      {/* MODAL PASTDA QOTGAN */}
      <div className="settings-panel">
        <h3>Yorug‘lik</h3>
        <div className="slider-row">
          <span>🌙</span>
          <input
            ref={sliderRef}
            type="range"
            min={0}
            max={100}
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="slider"
          />
          <span>☀️</span>
        </div>

        <h3>Fon rangi</h3>
        <div className="button-group">
          {['#ffffff', '#fdf6e3', '#1e1e1e'].map((bg) => (
            <button
              key={bg}
              className={`color-btn ${background === bg ? 'selected' : ''}`}
              style={{
                backgroundColor: bg,
                color: bg === '#1e1e1e' ? '#fff' : '#000',
                border: background === bg ? '2px solid orange' : '1px solid #ccc',
              }}
              onClick={() => setBackground(bg)}
            >
              Aa
            </button>
          ))}
        </div>

        <h3>Yozuv turi</h3>
        <div className="button-group">
          {['Inter', 'Georgia', 'Roboto Slab'].map((f) => (
            <button
              key={f}
              className={`font-btn ${fontFamily === f ? 'selected' : ''}`}
              onClick={() => setFontFamily(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <h3>Yozuv kattaligi</h3>
        <div className="button-group">
          <button onClick={() => setFontSize(Math.max(12, fontSize - 2))}>A-</button>
          <button onClick={() => setFontSize(fontSize + 2)}>A+</button>
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;
