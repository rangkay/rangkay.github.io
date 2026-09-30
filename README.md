# Rangkai

**Rangkai data jadi cerita.** Dashboard builder untuk tim pabrik yang tidak punya analis data: supervisor produksi, staf QC, dan admin gudang menyusun grafik cukup dengan satu kalimat, dan sistem menjamin kombinasi apa pun tetap valid.

Repo ini berisi **frontend Rangkai (F0) dan demo publik (F1)** dari dokumen *Rangkai — System Design*: porting prototipe Kanvas v2 ke Vite + React + TypeScript, berjalan di GitHub Pages dengan data contoh.

> Demo: <https://rangkay.github.io>. Dashboard tersimpan di browser masing-masing (localStorage).

## Yang sudah jalan

| Area | Isi |
|---|---|
| Composer kalimat | "Tampilkan *total* *output produksi* *per lini* *dirinci per shift* untuk *periode dashboard*". Pilihan yang tidak valid disembunyikan, bukan dinonaktifkan. |
| Semantic layer | 7 ukuran, 4 dimensi, 3 sumber. Aturan: persentase tidak bisa dijumlahkan, rincian ≠ pengelompokan, jenis grafik mengikuti bentuk hasil. |
| Rekomendasi visual | 3 saran per query, 21 tipe grafik, penjelasan "kurang pas". |
| Filter dua level | Filter dashboard + filter visual, dengan 4 aturan penggabungan (tidak berlaku, irisan, sakelar ikuti filter, row-level selalu menang). |
| Filter pembaca di URL | Pilihan pembaca tersimpan di parameter URL, jadi tautan yang dibagikan membawa tampilan yang sama. URL hanya bisa memilih nilai, tidak bisa menambah filter. |
| Editor | Mode Lihat/Ubah pada grid yang sama, seret untuk memindah, tarik untuk mengubah ukuran, halaman, duplikat, undo/redo (Ctrl+Z, Ctrl+Shift+Z), autosave. |
| Migrasi skema | Dashboard skema v1 dimigrasi ke v2 saat dibuka. Ukuran yang dihapus tetap ditampilkan sebagai "Ukuran tidak tersedia". Dashboard dari klien yang lebih baru dibuka hanya-baca. |
| Design system | Token CSS terang/gelap, Plus Jakarta Sans, kaca bertingkat, FAB, toast dengan Urungkan. Responsif: navigasi bawah di bawah 900 px, composer layar penuh di bawah 860 px, visual selebar layar di bawah 700 px. |
| Aksesibilitas | Semua kontrol bisa dipakai dengan keyboard (termasuk Alt+panah untuk memindah visual dan Alt+Shift+panah untuk mengubah ukurannya), fokus terlihat, dialog modal dengan focus trap, dan animasi mengikuti pengaturan kurangi gerak. |

## Struktur

```
src/
  core/        Modul domain murni, tanpa UI (lint melarang impor React/DOM).
               Nanti dipindah jadi paket bersama untuk Composer API.
    semantic.ts   ukuran, dimensi, sumber, dan kontrak GET /v1/catalog
    query.ts      normQ, splitsFor, autoTitle: validasi kalimat
    filters.ts    aturan penggabungan filter dan subjudul visual
    visuals.ts    recommend dan unsuitable
    engine.ts     query engine data contoh dengan kontrak POST /v1/query
    migrate.ts    migrasi skema v1 ke v2 dan pemuatan data tersimpan
    urlFilters.ts filter pembaca di URL
    layout.ts     aturan grid (satu aturan untuk Lihat dan Ubah)
  charts/      Builder opsi ECharts (murni, juga dirender di tes)
  store/       Zustand store: riwayat undo, autosave, composer
  components/  Layar dan komponen React
  styles/      tokens.css (design tokens) + app.css (komponen)
tests/e2e/     Alur pengguna dengan Playwright
```

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:5173
npm run lint
npm run typecheck
npm test           # unit test, termasuk render ECharts sisi server
npm run e2e        # Playwright (build + preview otomatis)
npm run build      # hasil di dist/
```

Pengujian mengikuti bagian *Strategi pengujian* di dokumen desain:

- Modul bersama: seluruh ruang kombinasi (ukuran × cara hitung × pengelompokan × rincian) menghasilkan query valid, dan rekomendasi tidak pernah memilih tipe yang ditandai kurang pas.
- Grafik: setiap tipe dirender dengan data dari setiap query valid, di tema terang dan gelap (lebih dari 6.000 render SVG sisi server).
- Migrasi: fixture dashboard format v1.
- Alur pengguna: 10 skenario Playwright, yaitu membuat visual, undo, filter, URL pembaca, sorotan silang, migrasi, keyboard, ponsel, dan mode gelap.

## Deploy

`.github/workflows/deploy.yml` membangun dan menerbitkan `dist/` ke GitHub Pages setiap kali ada push ke `main`. Pengaturan satu kali di GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

`.github/workflows/ci.yml` menjalankan lint, typecheck, unit test, dan Playwright di setiap pull request.

## Batas demo dan langkah berikutnya

GitHub Pages hanya menyajikan file statis, jadi bagian backend dari dokumen desain belum ada di repo ini:

- **Belum dibangun (F0/F2):** skema Directus, Composer API (NestJS), Cube dengan pre-aggregation, Redis/BullMQ, auth dan peran, konektor, export PDF, dan Docker Compose.
- **Titik sambung sudah disiapkan:** `core/engine.ts#runQuery` dan `core/semantic.ts#getCatalog` sudah memakai bentuk request/response `/v1/query` dan `/v1/catalog`. Beralih ke data live cukup dengan mengganti pemanggil lokal dengan klien HTTP; UI tidak perlu berubah.
- **Perbedaan dari stack di dokumen:** TanStack Query belum dipakai karena data contoh dihitung sinkron di browser. Ia masuk bersama klien HTTP. i18n juga belum pakai pustaka; semua teks produk berbahasa Indonesia dan terkumpul di `core/semantic.ts`.
- Peran Editor/Pembaca di sidebar adalah sakelar demo, bukan login.
