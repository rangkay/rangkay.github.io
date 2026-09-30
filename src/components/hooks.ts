import { useEffect, useState } from 'react';

export function useViewportWidth(): number {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = () => {
      clearTimeout(t);
      t = setTimeout(() => setW(window.innerWidth), 100);
    };
    window.addEventListener('resize', on);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', on);
    };
  }, []);
  return w;
}

/** Width of an element, kept current with a ResizeObserver. Use the returned callback as `ref`. */
export function useElementWidth(): [(node: HTMLElement | null) => void, number] {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const next = Math.round(entries[0].contentRect.width);
      setW((prev) => (Math.abs(prev - next) > 4 ? next : prev));
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  return [setNode, w];
}
