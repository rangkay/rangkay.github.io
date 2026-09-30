import { expect, test, type Page } from '@playwright/test';

/** Console errors from the app itself (web fonts may be blocked in CI sandboxes). */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

async function openBoard(page: Page, name: string) {
  await page.goto('/');
  await page.locator('.bcard', { hasText: name }).click();
  await expect(page.locator('.top h1, .top .title-btn')).toHaveText(name);
}

const cards = (page: Page) => page.locator('.grid .card-w');

test('home lists the sample dashboards and opens one without errors', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mau lihat apa hari ini?' })).toBeVisible();
  await expect(page.locator('.bcard:not(.new)')).toHaveCount(3);
  await openBoard(page, 'Ringkasan operasi');
  await expect(cards(page)).toHaveCount(7);
  await expect(page.locator('.grid canvas').first()).toBeVisible();
  await expect(page.getByText('Data contoh per pukul')).toBeVisible();
  expect(errors).toEqual([]);
});

test('an editor builds a visual from a sentence, and it is saved', async ({ page }) => {
  await openBoard(page, 'QC harian');
  await page.getByRole('button', { name: 'Ubah', exact: true }).click();
  await page.getByRole('button', { name: 'Tambah visual' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Apa yang ingin kamu lihat?' })).toBeVisible();

  await dialog.getByLabel('Ukuran').selectOption('lead');
  // "total" is never offered for an average-only measure
  await expect(dialog.getByLabel('Cara menghitung').locator('option')).toHaveText(['rata-rata', 'tertinggi', 'terendah']);
  await dialog.getByLabel('Kelompokkan').selectOption('gudang');
  await expect(dialog.locator('.card-title')).toHaveText('Rata-rata lead time per gudang');
  await dialog.getByRole('button', { name: /Bar horizontal/ }).click();
  await dialog.getByRole('button', { name: 'Tambahkan ke dashboard' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'Visual ditambahkan ke dashboard' })).toBeVisible();
  await expect(cards(page)).toHaveCount(7);
  await expect(page.getByText('Tersimpan otomatis')).toBeVisible();
  await page.reload();
  await expect(cards(page)).toHaveCount(7);
  await expect(cards(page).last().locator('.card-title')).toHaveText('Rata-rata lead time per gudang');
});

test('delete, undo from the toast, then Ctrl+Z / Ctrl+Shift+Z', async ({ page }) => {
  await openBoard(page, 'Okupansi gudang');
  await page.getByRole('button', { name: 'Ubah', exact: true }).click();
  const first = cards(page).first();
  const title = await first.locator('.card-title').innerText();
  await first.hover();
  await first.getByRole('button', { name: 'Hapus ' + title }).click();
  await expect(cards(page)).toHaveCount(4);
  await page.getByRole('button', { name: 'Urungkan' }).last().click();
  await expect(cards(page)).toHaveCount(5);
  await expect(cards(page).first().locator('.card-title')).toHaveText(title);

  await cards(page).nth(1).click();
  await page.keyboard.press('Delete');
  await expect(cards(page)).toHaveCount(4);
  await page.keyboard.press('Control+z');
  await expect(cards(page)).toHaveCount(5);
  await page.keyboard.press('Control+Shift+z');
  await expect(cards(page)).toHaveCount(4);
});

test('dashboard filters narrow cards, and say when they do not apply', async ({ page }) => {
  await openBoard(page, 'Ringkasan operasi');
  await page.getByRole('button', { name: /Filter lini/ }).click();
  const pop = page.getByRole('group', { name: 'Pilih lini' });
  for (const l of ['Lini 1', 'Lini 3', 'Lini 4', 'Lini 5']) await pop.getByLabel(l).uncheck();
  await expect(pop.getByText('1 dari 5 dipilih')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();

  const output = cards(page).filter({ hasText: 'Total output produksi' }).first();
  await expect(output.locator('.card-sub')).toContainText('disaring ke Lini 2');
  const pallet = cards(page).filter({ hasText: 'Total pallet tersimpan' });
  await expect(pallet.locator('.card-sub')).toContainText('filter lini tidak berlaku');
  await page.getByRole('button', { name: 'Atur ulang' }).click();
  await expect(output.locator('.card-sub')).not.toContainText('disaring');
});

test('a reader keeps filter choices in the URL without changing the dashboard', async ({ page }) => {
  await openBoard(page, 'Ringkasan operasi');
  await page.getByRole('button', { name: 'Pembaca' }).click();
  await expect(page.getByRole('button', { name: 'Ubah', exact: true })).toHaveCount(0);
  await page.getByLabel('Periode').selectOption('d7');
  await expect(page).toHaveURL(/periode=d7/);
  await expect(cards(page).first().locator('.card-sub')).toContainText('7 hari terakhir');

  // the link carries the view
  const url = page.url();
  await page.goto('about:blank');
  await page.goto(url);
  await expect(page.getByLabel('Periode')).toHaveValue('d7');

  // the editor's default is untouched
  await page.getByRole('button', { name: 'Editor' }).click();
  await page.goto('/');
  await page.locator('.bcard', { hasText: 'Ringkasan operasi' }).click();
  await expect(page.getByLabel('Periode')).toHaveValue('d30');
});

test('a visual filter that excludes the dashboard filter shows "Tidak ada data"', async ({ page }) => {
  await openBoard(page, 'Ringkasan operasi');
  await page.getByRole('button', { name: /Filter lini/ }).click();
  const pop = page.getByRole('group', { name: 'Pilih lini' });
  for (const l of ['Lini 2', 'Lini 3', 'Lini 4', 'Lini 5']) await pop.getByLabel(l).uncheck();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Ubah', exact: true }).click();
  const target = cards(page).filter({ hasText: 'Total output produksi per lini' });
  await target.dblclick({ position: { x: 40, y: 20 } });
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Filter lini/ }).click();
  const cardPop = dialog.getByRole('group', { name: 'Pilih lini' });
  await cardPop.getByLabel('Lini 1').uncheck();
  await expect(dialog.getByText('Filter visual ini dan filter dashboard tidak menyisakan data.')).toBeVisible();
  await page.keyboard.press('Escape');
  await dialog.getByRole('button', { name: 'Simpan perubahan' }).click();
  await expect(target.getByText('Tidak ada data')).toBeVisible();
  await target.getByRole('button', { name: 'Atur ulang filter dashboard' }).click();
  await expect(target.locator('canvas')).toBeVisible();
});

test('clicking a bar cross-highlights without changing filters', async ({ page }) => {
  await openBoard(page, 'Ringkasan operasi');
  const chart = cards(page).filter({ hasText: 'Total output produksi per lini' }).locator('.chart');
  const box = (await chart.boundingBox())!;
  // first category of five, just above the x axis
  await page.mouse.click(box.x + 40 + (box.width - 50) / 10, box.y + box.height - 70);
  await expect(page.locator('.xchip')).toContainText('Disorot: Lini 1');
  await expect(page.getByRole('button', { name: /Filter lini/ })).toHaveText('semua lini');
  await page.getByRole('button', { name: 'Hapus sorotan' }).click();
  await expect(page.locator('.xchip')).toHaveCount(0);
});

test('a dashboard saved by the v1 prototype is migrated when opened', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('rangkai.v2', JSON.stringify({
      v: 2,
      boards: [{
        id: 'legacy', name: 'Dashboard lama', tag: 'Produksi', filters: { period: 'd7', lini: 'Lini 2' },
        pages: [{ id: 'p1', name: 'Ringkasan' }], page: 'p1', updatedAt: Date.now(),
        cards: [
          { id: 'c1', page: 'p1', q: { measure: 'output', agg: 'sum', group: 'lini', split: 'none', period: 'dash', rule: null }, type: 'bar', auto: true, title: '', span: 6, h: 300 },
          { id: 'c2', page: 'p1', q: { measure: 'energi', agg: 'sum', group: 'none', split: 'none', period: 'dash', rule: null, schemaVersion: 2 }, type: 'kpi', auto: true, title: '', span: 6, h: 300 },
        ],
      }],
    }));
  });
  // a hash-only navigation does not reload the app, so reload to boot from the stored data
  await page.goto('/#/d/legacy');
  await page.reload();
  await expect(page.getByRole('button', { name: /Filter lini/ })).toHaveText('Lini 2');
  await expect(page.getByLabel('Periode')).toHaveValue('d7');
  await expect(cards(page).first().locator('.card-sub')).toContainText('disaring ke Lini 2');
  // a removed measure is kept and explained, not dropped
  await expect(cards(page).nth(1).locator('.card-title')).toHaveText('Ukuran tidak tersedia');
  await expect(cards(page).nth(1).getByRole('alert')).toContainText('Ukuran ini sudah dihapus dari sumber data');
});

test('keyboard: open a visual with Enter and close the composer with Escape', async ({ page }) => {
  await openBoard(page, 'Ringkasan operasi');
  await page.getByRole('button', { name: 'Ubah', exact: true }).click();
  await cards(page).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Ubah visual')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('dark mode and the phone layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBoard(page, 'Ringkasan operasi');
  await expect(page.locator('.side')).toHaveCount(0);
  await expect(page.locator('.bnav')).toBeVisible();
  const grid = (await page.locator('.grid').boundingBox())!;
  const first = (await cards(page).first().boundingBox())!;
  expect(Math.abs(first.width - grid.width)).toBeLessThan(2);
  const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(docWidth).toBeLessThanOrEqual(390);

  await page.locator('.bnav').getByRole('button', { name: 'Tema' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
