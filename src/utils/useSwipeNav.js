// useSwipeNav.js
import { useRef, useCallback } from 'react';

/**
 * Gorizontal swipe/tap bilan navigatsiya
 * - chapga swipe => next()
 * - o'ngga swipe => prev()
 * - chap/o'ng "tap zone" bosilsa ham prev/next bo'ladi
 */
export default function useSwipeNav({ next, prev, threshold = 50, tapZonePercent = 0.28 }) {
  const startX = useRef(0);
  const startY = useRef(0);
  const moved = useRef(false);

  const onTouchStart = useCallback((e) => {
    const t = e.touches?.[0];
    if (!t) return;
    startX.current = t.clientX;
    startY.current = t.clientY;
    moved.current = false;
  }, []);

  const onTouchMove = useCallback((e) => {
    const t = e.touches?.[0];
    if (!t) return;
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    // Asosan gorizontal harakat bo'lsa scroll'ga to'siq bo'lmaydi, faqat belgilaymiz
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved.current = true;
  }, []);

  const onTouchEnd = useCallback((e) => {
    const changed = e.changedTouches?.[0];
    if (!changed) return;

    const dx = changed.clientX - startX.current;
    const dy = changed.clientY - startY.current;

    // Swipe: gorizontal va threshold'dan katta
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= threshold) {
      if (dx < 0) next(); else prev();
      return;
    }

    // Tap: siljimagan bo'lsa, zonaga qarab harakat
    if (!moved.current) {
      const w = window.innerWidth || document.documentElement.clientWidth;
      const x = changed.clientX;
      if (x <= w * tapZonePercent) {
        prev();
      } else if (x >= w * (1 - tapZonePercent)) {
        next();
      }
    }
  }, [next, prev, threshold, tapZonePercent]);

  // Pointer (sichqoncha) uchun ham ishlaydi
  const downX = useRef(0);
  const downY = useRef(0);

  const onPointerDown = useCallback((e) => {
    downX.current = e.clientX;
    downY.current = e.clientY;
    moved.current = false;
  }, []);

  const onPointerMove = useCallback((e) => {
    const dx = e.clientX - downX.current;
    const dy = e.clientY - downY.current;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved.current = true;
  }, []);

  const onPointerUp = useCallback((e) => {
    const dx = e.clientX - downX.current;
    const dy = e.clientY - downY.current;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= threshold) {
      if (dx < 0) next(); else prev();
      return;
    }

    if (!moved.current) {
      const w = window.innerWidth || document.documentElement.clientWidth;
      if (e.clientX <= w * tapZonePercent) {
        prev();
      } else if (e.clientX >= w * (1 - tapZonePercent)) {
        next();
      }
    }
  }, [next, prev, threshold, tapZonePercent]);

  // Klaviatura: ← →
  const onKeyDown = useCallback((e) => {
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  }, [next, prev]);

  return {
    onTouchStart, onTouchMove, onTouchEnd,
    onPointerDown, onPointerMove, onPointerUp,
    onKeyDown,
  };
}
