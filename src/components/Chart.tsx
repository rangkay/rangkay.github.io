import { useEffect, useRef, useState } from 'react';
import { echarts } from '../charts/echarts';
import { buildOption, type ChartKind } from '../charts/options';
import type { ResultData } from '../core/engine';
import type { Query } from '../core/types';
import { useStore } from '../store/store';

const reducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

interface Props {
  kind: ChartKind;
  data: ResultData;
  q: Query;
  mini?: boolean;
  color?: string;
  highlight?: string | null;
  /** clicking a bar or slice reports its category name */
  onPick?: (name: string) => void;
  label?: string;
}

/**
 * One ECharts instance per visual. It is created only once the element is on screen,
 * and resizes on the next animation frame when its box changes.
 */
export function Chart({ kind, data, q, mini, color, highlight, onPick, label }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);
  const pick = useRef(onPick);
  const [visible, setVisible] = useState(false);
  const dark = useStore((s) => s.dark);

  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  // Defer creation until visible.
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        io.disconnect();
      }
    }, { rootMargin: '200px' });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  // Create / dispose the instance, and keep it sized to its box.
  useEffect(() => {
    const node = el.current;
    if (!visible || !node) return;
    const chart = echarts.init(node, null, { renderer: 'canvas' });
    inst.current = chart;
    chart.on('click', (p) => {
      const name = typeof p.name === 'string' ? p.name : '';
      if (name && name !== 'Total') pick.current?.(name);
    });
    let raf = 0;
    const ro = new ResizeObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        chart.resize();
      });
    });
    ro.observe(node);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      chart.dispose();
      inst.current = null;
    };
  }, [visible]);

  // Apply the option whenever the inputs change.
  useEffect(() => {
    const chart = inst.current;
    if (!chart) return;
    chart.setOption(buildOption(kind, data, q, { dark, mini, color, highlight, animate: !mini && !reducedMotion() }), { notMerge: true });
  }, [visible, kind, data, q, dark, mini, color, highlight]);

  return <div ref={el} className="chart" role="img" aria-label={label} />;
}
