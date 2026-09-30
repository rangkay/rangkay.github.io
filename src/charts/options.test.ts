/**
 * Server-side ECharts render of every chart type with data from every valid query,
 * in light and dark themes. A throw or an empty SVG fails the test.
 */
import * as echarts from 'echarts';
import { describe, expect, it } from 'vitest';
import { genData } from '../core/engine';
import { validQueries } from '../core/testkit';
import { TYPE_IDS } from '../core/visuals';
import { buildOption, type ChartKind } from './options';
import type { DashboardFilters } from '../core/types';

const F: DashboardFilters = { period: 'd30', dims: [{ dim: 'lini', values: [] }] };
const AS_OF = new Date(2026, 8, 30);
// KPI cards and tables are DOM, not canvas; everything else is ECharts.
const CHART_TYPES: ChartKind[] = [...TYPE_IDS.filter((t) => t !== 'kpi' && t !== 'table'), 'spark'];

function render(opt: Record<string, unknown>): string {
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 420, height: 280 });
  try {
    chart.setOption(opt);
    return chart.renderToSVGString();
  } finally {
    chart.dispose();
  }
}

describe('every chart type renders every query', () => {
  const qs = validQueries();
  let renders = 0;

  it.each(CHART_TYPES)('%s', (type) => {
    qs.forEach((q) => {
      const d = genData(q, F, { asOf: AS_OF });
      [false, true].forEach((dark) => {
        const svg = render(buildOption(type, d, q, { dark, animate: false }));
        expect(svg.startsWith('<svg'), `${type} ${JSON.stringify(q)}`).toBe(true);
        renders++;
      });
    });
    // mini previews used by the composer
    const q = qs[0];
    expect(render(buildOption(type, genData(q, F), q, { dark: false, mini: true, animate: false }))).toContain('<svg');
  });

  it('rendered more than 1000 charts', () => {
    expect(renders).toBeGreaterThan(1000);
  });
});

describe('cross-highlight', () => {
  it('dims every bar except the highlighted category', () => {
    const q = validQueries().find((x) => x.measure === 'output' && x.agg === 'sum' && x.group === 'lini' && x.split === 'none')!;
    const opt = buildOption('bar', genData(q, F), q, { dark: false, highlight: 'Lini 2' });
    const data = (opt.series as { data: unknown[] }[])[0].data;
    expect(typeof data[1]).toBe('number');
    expect(data[0]).toMatchObject({ itemStyle: { opacity: 0.22 } });
  });
});
