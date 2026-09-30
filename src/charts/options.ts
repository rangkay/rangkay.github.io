/**
 * ECharts option builder for every visual type. Pure: the same function feeds the browser
 * and the server-side render tests, in light and dark themes.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- ECharts option objects are deeply dynamic */
import { compact, fm, fmtNum, hash, niceMax, rnd } from '../core/format';
import { ruleColor, type ResultData } from '../core/engine';
import { MEASURES } from '../core/semantic';
import { SINGLE } from '../core/visuals';
import type { Query, VisualType } from '../core/types';

export type ChartKind = VisualType | 'spark';
type Opt = Record<string, any>;

export interface ChartOpts {
  dark: boolean;
  mini?: boolean;
  animate?: boolean;
  /** category to keep bright while the rest is dimmed (cross-highlight) */
  highlight?: string | null;
  /** spark line colour */
  color?: string;
}

/** Canvas text needs its own fallbacks: without them a missing web font turns into serif. */
export const FONT = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export function palette(dark: boolean) {
  return {
    ink: dark ? '#F1F5F9' : '#0F172A',
    muted: dark ? '#94A3B8' : '#64748B',
    line: dark ? 'rgba(255,255,255,.08)' : 'rgba(15,23,42,.08)',
    panel: dark ? '#111827' : '#FFFFFF',
    track: dark ? 'rgba(255,255,255,.08)' : '#EAEFF7',
    tip: dark ? 'rgba(17,24,39,.96)' : 'rgba(255,255,255,.97)',
    heatLo: dark ? '#1E293B' : '#EEF4FF',
    series: dark
      ? ['#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#F472B6', '#22D3EE']
      : ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'],
  };
}

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

export function buildOption(type: ChartKind, data: ResultData, q: Query, o: ChartOpts): Opt {
  const p = palette(o.dark);
  const f = fm(q);
  const m = MEASURES[q.measure];
  const label = m ? m.label : q.measure;
  const mini = !!o.mini;
  const hl = o.highlight || null;
  let d = data;
  if (!d.categories && !(type in SINGLE) && type !== 'bullet' && type !== 'spark') {
    d = { ...d, categories: [label], series: [{ name: label, values: [d.single ?? 0] }] };
  }
  const fmt = (v: unknown) => fmtNum(Number(Array.isArray(v) ? v[v.length - 1] : v), f);
  const axisFmt = (v: number) => compact(v) + (f.pct ? '%' : '');
  const cats = d.categories || [];
  const s = d.series || [];
  const multi = s.length > 1;
  const single = d.single ?? 0;

  const cat = (data: string[], extra: Opt = {}): Opt => ({
    type: 'category', data, axisTick: { show: false },
    axisLine: { show: !mini, lineStyle: { color: p.line } },
    axisLabel: { show: !mini, color: p.muted, fontSize: 11, hideOverlap: true },
    ...extra,
  });
  const val = (extra: Opt = {}): Opt => ({
    type: 'value', splitLine: { show: !mini, lineStyle: { color: p.line, type: 'dashed' } }, axisLine: { show: false },
    axisLabel: { show: !mini, color: p.muted, fontSize: 11, formatter: axisFmt },
    ...extra,
  });
  const tip: Opt = {
    show: !mini, trigger: 'axis', confine: true, valueFormatter: fmt, backgroundColor: p.tip, borderColor: p.line,
    textStyle: { color: p.ink, fontSize: 12, fontFamily: FONT }, axisPointer: { type: 'shadow', shadowStyle: { color: p.line } },
  };
  const itemTip = (): Opt => ({ ...tip, trigger: 'item' });
  const legend: Opt = {
    show: !mini && multi, bottom: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, itemGap: 14,
    textStyle: { color: p.muted, fontSize: 11 },
  };
  const grid: Opt = { left: 2, right: mini ? 2 : 10, top: mini ? 6 : 14, bottom: mini ? 2 : multi ? 32 : 2, containLabel: !mini };
  const base: Opt = {
    color: p.series, animation: o.animate !== false, animationDuration: 520, animationEasing: 'cubicOut',
    textStyle: { fontFamily: FONT, fontSize: 11, color: p.muted }, tooltip: tip, grid, legend,
  };
  const X = (obj: Opt): Opt => ({ ...base, ...obj });
  const dim = (vals: number[]) => vals.map((v, i) => (hl && cats[i] !== hl ? { value: v, itemStyle: { opacity: 0.22 } } : v));

  switch (type) {
    case 'spark': {
      const col = o.color || p.series[0];
      return {
        animation: false, grid: { left: 0, right: 0, top: 3, bottom: 1 },
        xAxis: { type: 'category', show: false, boundaryGap: false, data: d.spark.map((_, i) => i) },
        yAxis: { type: 'value', show: false, scale: true },
        series: [{ type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 2, color: col }, areaStyle: { color: col, opacity: 0.14 }, data: d.spark }],
      };
    }
    case 'bar':
    case 'sbar':
      return X({
        xAxis: cat(cats), yAxis: val(),
        series: s.map((se, j) => ({
          name: se.name, type: 'bar', stack: type === 'sbar' ? 't' : undefined, barMaxWidth: mini ? 12 : 34,
          itemStyle: { borderRadius: type === 'sbar' ? (j === s.length - 1 ? [6, 6, 0, 0] : 0) : [6, 6, 0, 0] },
          data: dim(se.values),
        })),
      });
    case 'hbar':
      return X({
        xAxis: val(), yAxis: cat(cats, { inverse: true }),
        series: s.map((se, j) => ({
          name: se.name, type: 'bar', stack: multi ? 't' : undefined, barMaxWidth: mini ? 9 : 22,
          itemStyle: { borderRadius: !multi || j === s.length - 1 ? [0, 6, 6, 0] : 0 }, data: dim(se.values),
        })),
      });
    case 'combo': {
      const v0 = s[0].values;
      const ma = v0.map((_, i) => {
        const a = v0.slice(Math.max(0, i - 2), i + 1);
        return Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10;
      });
      return X({
        legend: { ...legend, show: !mini }, grid: { ...grid, bottom: mini ? 2 : 32 }, xAxis: cat(cats), yAxis: val(),
        series: [
          { name: s[0].name, type: 'bar', barMaxWidth: mini ? 10 : 30, itemStyle: { borderRadius: [6, 6, 0, 0] }, data: dim(v0) },
          { name: 'Rata-rata 3 titik', type: 'line', smooth: true, symbol: 'circle', symbolSize: mini ? 0 : 6, lineStyle: { width: 2.2 }, data: ma },
        ],
      });
    }
    case 'line':
    case 'area': {
      const ser: Opt[] = s.map((se) => {
        const x: Opt = { name: se.name, type: 'line', smooth: true, showSymbol: false, symbolSize: 7, lineStyle: { width: mini ? 1.8 : 2.4 }, data: se.values };
        if (type === 'area') {
          x.areaStyle = { opacity: multi ? 0.14 : 0.2 };
          if (multi) x.stack = 't';
        }
        return x;
      });
      if (m?.target && f.pct && !mini && ser[0]) {
        ser[0].markLine = {
          silent: true, symbol: 'none', lineStyle: { color: p.muted, type: 'dashed', width: 1 },
          label: { color: p.muted, fontSize: 11, formatter: 'Target ' + m.target + '%' }, data: [{ yAxis: m.target }],
        };
      }
      return X({
        tooltip: { ...tip, axisPointer: { type: 'line', lineStyle: { color: p.line } } },
        xAxis: cat(cats, { boundaryGap: false }), yAxis: val(f.pct ? { scale: true } : {}), series: ser,
      });
    }
    case 'waterfall': {
      let run = 0;
      const help: number[] = [];
      const bars: number[] = [];
      s[0].values.forEach((v) => { help.push(run); bars.push(v); run += v; });
      const wc = cats.concat(['Total']);
      help.push(0);
      bars.push(Math.round(run * 10) / 10);
      return X({
        tooltip: { ...tip, valueFormatter: undefined, formatter: (ps: any[]) => { const b = ps[ps.length - 1]; return b.name + ': ' + fmtNum(b.value, f); } },
        xAxis: cat(wc), yAxis: val(),
        series: [
          { type: 'bar', stack: 'w', silent: true, itemStyle: { color: 'transparent' }, data: help, tooltip: { show: false } },
          {
            type: 'bar', stack: 'w', barMaxWidth: mini ? 10 : 32,
            data: bars.map((b, i) => {
              const last = i === bars.length - 1;
              return { value: b, itemStyle: { borderRadius: 6, color: last ? p.series[1] : p.series[0], opacity: hl && !last && wc[i] !== hl ? 0.22 : 1 } };
            }),
          },
        ],
      });
    }
    case 'pie':
    case 'rose':
    case 'treemap':
    case 'funnel': {
      const items = cats.map((c, i) => ({ name: c, value: s[0].values[i], itemStyle: { color: p.series[i % p.series.length], opacity: hl && c !== hl ? 0.22 : 1 } }));
      const common: Opt = { color: p.series, animation: o.animate !== false, textStyle: base.textStyle, tooltip: itemTip() };
      if (type === 'treemap') {
        return {
          ...common,
          series: [{
            type: 'treemap', roam: false, nodeClick: false, breadcrumb: { show: false }, left: 0, right: 0, top: 0, bottom: 0,
            itemStyle: { borderColor: p.panel, borderWidth: 2, gapWidth: 2, borderRadius: 8 },
            label: { show: !mini, fontSize: 12, fontWeight: 700, color: '#fff' }, upperLabel: { show: false }, data: items,
          }],
        };
      }
      if (type === 'funnel') {
        return {
          ...common,
          series: [{
            type: 'funnel', sort: 'descending', left: mini ? '4%' : '10%', right: mini ? '4%' : '10%', top: mini ? 2 : 6, bottom: mini ? 2 : 6,
            gap: 3, minSize: '22%', itemStyle: { borderColor: p.panel, borderWidth: 1 },
            label: { show: !mini, position: 'inside', color: '#fff', fontSize: 11, fontWeight: 700 }, data: items,
          }],
        };
      }
      return {
        ...common,
        legend: { show: !mini, type: 'scroll', bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: p.muted, fontSize: 11 } },
        series: [{
          type: 'pie', roseType: type === 'rose' ? 'area' : undefined,
          radius: type === 'rose' ? ['16%', mini ? '94%' : '70%'] : [mini ? '52%' : '50%', mini ? '90%' : '72%'],
          center: ['50%', mini ? '50%' : '44%'],
          itemStyle: { borderRadius: type === 'pie' ? 7 : 5, borderColor: p.panel, borderWidth: 2 },
          label: { show: false }, emphasis: { scale: !mini, scaleSize: 5 }, data: items,
        }],
      };
    }
    case 'scatter':
    case 'bubble': {
      const mx = Math.max(...s.flatMap((se) => se.values)) || 1;
      return X({
        tooltip: itemTip(), xAxis: cat(cats, { boundaryGap: true }), yAxis: val(),
        series: s.map((se) => ({
          name: se.name, type: 'scatter', data: dim(se.values), itemStyle: { opacity: type === 'bubble' ? 0.72 : 1 },
          symbolSize: type === 'bubble'
            ? (v: unknown) => { const x = Number(Array.isArray(v) ? v[1] : v); return (mini ? 5 : 10) + (x / mx) * (mini ? 12 : 34); }
            : mini ? 6 : 11,
        })),
      });
    }
    case 'radar': {
      const rmax = niceMax(Math.max(...s.flatMap((se) => se.values)) * 1.1) || 1;
      return {
        color: p.series, animation: o.animate !== false, textStyle: base.textStyle,
        tooltip: { ...itemTip(), valueFormatter: undefined }, legend,
        radar: {
          indicator: cats.map((c) => ({ name: c, max: rmax })), radius: mini ? '72%' : '64%', center: ['50%', multi && !mini ? '46%' : '52%'],
          axisName: { show: !mini, color: p.muted, fontSize: 11 }, splitLine: { lineStyle: { color: p.line } },
          splitArea: { areaStyle: { color: ['transparent', p.track] } }, axisLine: { lineStyle: { color: p.line } },
        },
        series: [{ type: 'radar', symbolSize: mini ? 0 : 5, lineStyle: { width: 2 }, areaStyle: { opacity: 0.2 }, data: s.map((se) => ({ name: se.name, value: se.values })) }],
      };
    }
    case 'heat': {
      const ys = s.map((se) => se.name);
      const hd: [number, number, number][] = [];
      const vals: number[] = [];
      s.forEach((se, j) => se.values.forEach((v, i) => { hd.push([i, j, v]); vals.push(v); }));
      return {
        animation: o.animate !== false, textStyle: base.textStyle,
        tooltip: { ...itemTip(), position: 'top', valueFormatter: undefined, formatter: (pp: any) => ys[pp.value[1]] + ', ' + cats[pp.value[0]] + ': ' + fmtNum(pp.value[2], f) },
        grid: { left: 2, right: mini ? 2 : 8, top: mini ? 2 : 6, bottom: mini ? 2 : 36, containLabel: !mini },
        xAxis: cat(cats), yAxis: cat(ys, { inverse: true }),
        visualMap: {
          show: !mini, min: Math.min(...vals), max: Math.max(...vals), calculable: false, orient: 'horizontal', left: 'center', bottom: 0,
          itemWidth: 10, itemHeight: 110, textStyle: { color: p.muted, fontSize: 10 }, inRange: { color: [p.heatLo, p.series[0]] },
        },
        series: [{ type: 'heatmap', data: hd, itemStyle: { borderColor: p.panel, borderWidth: 2, borderRadius: 5 } }],
      };
    }
    case 'boxplot':
      return X({
        tooltip: { ...itemTip(), valueFormatter: undefined }, xAxis: cat(cats), yAxis: val(),
        series: [{
          type: 'boxplot', boxWidth: mini ? [4, 10] : [8, 30],
          itemStyle: { color: rgba(p.series[0], 0.18), borderColor: p.series[0], borderWidth: 1.6 },
          data: s[0].values.map((v, i) => {
            const k = 0.06 + rnd(hash(q.measure + i), i) * 0.16;
            return [v * (1 - 2 * k), v * (1 - k), v, v * (1 + k * 0.8), v * (1 + k * 1.8)].map((x) => Math.round(x * 10) / 10);
          }),
        }],
      });
    case 'gauge': {
      const gmax = f.pct ? (m && m.base > 20 ? 100 : Math.ceil((m?.base ?? 10) * 3)) : niceMax(single * 1.3);
      const gc = ruleColor(single, q.rule) || p.series[0];
      return {
        animation: o.animate !== false,
        series: [{
          type: 'gauge', startAngle: 210, endAngle: -30, min: 0, max: gmax, radius: mini ? '100%' : '94%', center: ['50%', mini ? '62%' : '60%'],
          progress: { show: true, width: mini ? 9 : 16, roundCap: true, itemStyle: { color: gc } },
          axisLine: { roundCap: true, lineStyle: { width: mini ? 9 : 16, color: [[1, p.track]] } },
          pointer: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, anchor: { show: false },
          title: { show: !mini, offsetCenter: [0, '36%'], color: p.muted, fontSize: 12, fontFamily: FONT },
          detail: {
            valueAnimation: true, offsetCenter: [0, mini ? '2%' : '-4%'], fontSize: mini ? 17 : 30, fontWeight: 800, fontFamily: FONT, color: p.ink,
            formatter: (v: number) => fmtNum(v, f, true),
          },
          data: [{ value: single, name: 'dari maksimum ' + compact(gmax) + (f.pct ? '%' : '') }],
        }],
      };
    }
    case 'bullet': {
      const labels = cats.length ? cats : [label];
      const bv = cats.length ? s[0].values : [single];
      const tgt = m?.target && f.pct ? m.target : niceMax(Math.max(...bv) * 1.05);
      const bmax = niceMax(Math.max(tgt, Math.max(...bv)) * 1.08);
      return X({
        legend: { show: false }, tooltip: { ...tip, axisPointer: { type: 'none' } },
        grid: { left: 2, right: mini ? 4 : 18, top: mini ? 4 : 8, bottom: mini ? 4 : 8, containLabel: !mini },
        xAxis: val({ max: bmax }), yAxis: cat(labels, { inverse: true, axisLine: { show: false } }),
        series: [
          { name: 'Rentang', type: 'bar', barWidth: mini ? 10 : 22, barGap: '-100%', silent: true, z: 1, itemStyle: { color: p.track, borderRadius: 7 }, data: labels.map(() => bmax), tooltip: { show: false } },
          { name: 'Aktual', type: 'bar', barWidth: mini ? 5 : 10, barGap: '-100%', z: 3, itemStyle: { borderRadius: 5 }, data: bv.map((v) => ({ value: v, itemStyle: { color: ruleColor(v, q.rule) || p.series[0] } })) },
          { name: 'Target', type: 'scatter', symbol: 'rect', symbolSize: [3, mini ? 14 : 26], z: 5, itemStyle: { color: p.ink }, data: labels.map((_, i) => [tgt, i]) },
        ],
      });
    }
    case 'bignum': {
      const rc = ruleColor(single, q.rule);
      return {
        animation: false,
        graphic: [
          { type: 'text', left: 'center', top: mini ? '26%' : '28%', style: { text: fmtNum(single, f, true), font: '800 ' + (mini ? 24 : 46) + 'px ' + FONT, fill: rc || p.ink } },
          { type: 'text', left: 'center', top: '66%', style: { text: f.pct ? 'persen' : f.unit, font: '600 ' + (mini ? 11 : 14) + 'px ' + FONT, fill: p.muted } },
        ],
      };
    }
    default:
      return X({ xAxis: cat(cats), yAxis: val(), series: [{ type: 'line', smooth: true, showSymbol: false, data: (s[0] || { values: [] }).values }] });
  }
}
