// src/components/ReaderNavbar.jsx
import React, { useMemo } from 'react';
import {
  IoSettingsSharp,
  IoChevronBack,
  IoSearchSharp,
  IoBookmark,
  IoStarOutline
} from 'react-icons/io5';

const NAV_H = 56;

export default function ReaderNavbar({
  isDark,
  border,
  iconColor,
  progress,
  onBack,
  onOpenReadList,
  onOpenHighlights,
  onOpenStars,
  onOpenSearch,
  onOpenSettings,
}) {
  const supportsBackdrop = useMemo(() => {
    try {
      return CSS.supports('backdrop-filter','blur(6px)') || CSS.supports('-webkit-backdrop-filter','blur(6px)');
    } catch { return false; }
  }, []);

  const bgGlass = isDark ? 'rgba(17,17,17,0.6)' : 'rgba(255,255,255,0.7)';
  const bgSolid = isDark ? '#151515' : '#ffffff';
  const track   = isDark ? '#333' : '#e5e7eb';
  const bar     = isDark ? '#f5f5f5' : '#1c1c1c';

  return (
    <>
      {/* FULL-BLEED strip: container padding/margindan mustaqil */}
      <div
        data-block-nav="true"
        style={{
          position: 'relative',
          left: '50%', right: '50%',
          marginLeft: '-50vw', marginRight: '-50vw',
          width: '100vw',
          zIndex: 2,

          /* scroll bilan birga: fixed/sticky YO'Q */
          background: supportsBackdrop ? bgGlass : bgSolid,
          backdropFilter: supportsBackdrop ? 'blur(10px) saturate(140%)' : 'none',
          WebkitBackdropFilter: supportsBackdrop ? 'blur(10px) saturate(140%)' : 'none',

          borderBottom: `1px solid ${border}`,
          boxShadow: isDark ? '0 6px 16px rgba(0,0,0,0.28)' : '0 6px 16px rgba(0,0,0,0.08)',
        }}
      >
        {/* Yuqori qatordagi tugmalar */}
        <div
          data-block-nav="true"
          style={{
            height: NAV_H,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '0 12px',
          }}
        >
          <button data-block-nav="true" onClick={onBack} title="Orqaga"
                  style={{ background:'transparent', border:'none', padding:4, cursor:'pointer' }}>
            <IoChevronBack size={24} color={iconColor} />
          </button>

          <button
            data-block-nav="true"
            onClick={onOpenReadList}
            title="O‘qilgan sahifalar"
            style={{
              fontSize:12, padding:'6px 10px', borderRadius:999,
              border:`1px solid ${border}`, background:isDark?'#1b1b1b':'#f8f8f8',
              color:isDark?'#f3f4f6':'#111', minWidth:44, textAlign:'center', cursor:'pointer'
            }}
          >
            {Math.max(0, Math.min(100, progress))}%
          </button>

          <div data-block-nav="true" style={{ display:'flex', gap:12, alignItems:'center' }}>
            <button data-block-nav="true" onClick={onOpenHighlights} title="Belgilangan joylar"
                    style={{ background:'transparent', border:'none', padding:4, cursor:'pointer' }}>
              <IoBookmark size={22} color={iconColor} />
            </button>
            <button data-block-nav="true" onClick={onOpenStars} title="Yulduzlangan sahifalar"
                    style={{ background:'transparent', border:'none', padding:4, cursor:'pointer' }}>
              <IoStarOutline size={22} color={iconColor} />
            </button>
            <button data-block-nav="true" onClick={onOpenSearch} title="Qidiruv"
                    style={{ background:'transparent', border:'none', padding:4, cursor:'pointer' }}>
              <IoSearchSharp size={22} color={iconColor} />
            </button>
            <button data-block-nav="true" onClick={onOpenSettings} title="Sozlamalar"
                    style={{ background:'transparent', border:'none', padding:4, cursor:'pointer' }}>
              <IoSettingsSharp size={24} color={iconColor} />
            </button>
          </div>
        </div>

        {/* Progress chiziq */}
        <div data-block-nav="true" aria-label="O‘qish progressi"
             style={{ height:4, width:'100%', background:track, borderTop:`1px solid ${border}`, borderBottom:`1px solid ${border}`, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${Math.max(0, Math.min(100, progress))}%`, background:bar, transition:'width 220ms ease' }} />
        </div>
      </div>

      {/* nav ostida kichik bo'shliq (ixtiyoriy) */}
      <div style={{ height: 10 }} />
    </>
  );
}
