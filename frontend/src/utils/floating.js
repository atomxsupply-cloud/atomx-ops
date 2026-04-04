import { useEffect, useState } from 'react';

export function useFloatingPosition(key, defaults) {
  const [position, setPosition] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaults;
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(position));
  }, [key, position]);

  function startDrag(event) {
    event.preventDefault();
    const startX = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
    const startY = event.clientY ?? event.touches?.[0]?.clientY ?? 0;
    const origin = { ...position };

    function onMove(e) {
      const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? startX;
      const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? startY;
      const nextX = origin.x - (startX - clientX);
      const nextY = origin.y - (startY - clientY);
      setPosition({
        x: Math.max(12, Math.min(window.innerWidth - 88, nextX)),
        y: Math.max(12, Math.min(window.innerHeight - 88, nextY)),
      });
    }

    function onEnd() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  }

  return { position, startDrag };
}
