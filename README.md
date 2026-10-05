# Inventory & Invoicing

An inventory, point-of-sale and invoicing app for small Philippine shops that runs entirely in the
browser. There's no server, account or cloud database: each device keeps its own store, saved in that
browser. After the first visit it also works offline.

**Stack:** Next.js 16 (static export), TypeScript, SQLite in the browser (sql.js / WebAssembly), Drizzle
ORM, Tailwind CSS, pdfkit. Hosted as static files on Cloudflare.

## How it works

- **The database runs in the browser.** SQLite is loaded as WebAssembly and saved to the browser's
  IndexedDB a moment after every change. Product images are stored inside the database.
- **Every device and browser is separate.** A phone, a laptop and an incognito window each have their
  own store. To move a store, download a backup on one device and import it on the other.
- **Clearing the browser's site data deletes the store**, so download backups regularly. The app asks
  the browser for protected storage, and Settings → Backup & Restore shows whether it was granted.
- **First visit:** visitors choose **Start a new store**, **Explore with demo data** (a mini mart with a
  month of connected sales, stock movements and customers), or **I have a backup file**.
- **Works offline** after the first visit, through a service worker (`public/sw.js`). The app still loads
  without internet, and nothing it does needs a connection.

## Getting started

```bash
npm install
npm run dev       # http://localhost:3000
```

`npm run build` writes the static site to `out/`. `npm start` serves that folder locally.

Open **Settings** first and fill in your business name, address and TIN. They're printed on every
invoice.

## Deploying to Cloudflare

The site is plain static files, so it's served by a Worker with static assets only, and there's no
server code. `wrangler.jsonc` points Cloudflare at `out/`.

In the Cloudflare dashboard, open **Workers & Pages → invoices → Settings → Build** and set:

| Setting        | Value                 |
| -------------- | --------------------- |
| Build command  | `npm run build`       |
| Deploy command | `npx wrangler deploy` |

Every push to `main` then builds and deploys automatically. To deploy from your own computer
instead, run `npm run build`, then `npm run deploy`.

## Philippine tax (VAT-registered / Non-VAT)

Set this in **Settings → Business** with the **Non-VAT / VAT-registered** toggle. The setting applies to
new sales, and every invoice keeps the mode it was issued under.

- **Shelf prices always include VAT.** Under the Consumer Act's all-in pricing rule, nothing is added
  at checkout.
- **VAT-registered:** invoices are titled "Sales Invoice" and show "VAT Reg. TIN". They break the total
  into VATable sales (net), VAT (12/112 of the VATable amount), VAT-exempt sales and zero-rated sales.
  Mark VAT-exempt products, such as unprocessed rice, on the product page.
- **Non-VAT:** invoices show "Non-VAT Reg. TIN" with no VAT lines and the note "This document is not
  valid for claim of input tax". The 3% percentage tax is paid quarterly by the business and is not on
  receipts.
- **Senior citizen / PWD:** the discount is 5% on products marked "basic necessity / prime commodity",
  without VAT exemption (DTI-DA-DOE JAO 24-02). It's limited to ₱2,500 of purchases (₱125 of
  discount) per ID per week, with the week starting Monday. The name and ID number are printed on the
  invoice.
- **Buyer details:** buyer name, address and TIN are filled in from the customer record, and the POS
  highlights them for sales of ₱1,000 or more. They're required when the buyer is VAT-registered.
- **Old invoices:** invoices made before this feature keep their original "tax added on top" layout.

This follows RR 7-2024 (Ease of Paying Taxes Act) as researched in October 2026. It is not tax advice.
Ask your accountant or BIR RDO whether invoices from this system need BIR registration (an
Acknowledgement Certificate) before you use them as official invoices.

## Where data lives

| What           | Where                                                          |
| -------------- | -------------------------------------------------------------- |
| Database       | This browser's IndexedDB (database "invoices", key "database") |
| Product images | Inside the database (`files` table), resized on upload        |
| Safety backups | This browser's IndexedDB (the last 3, made before restores)    |

The tables are created, and upgraded when the app updates, automatically on first open.

## Backup & restore (moving to another device)

Go to **Settings → Backup & Restore**. Everything happens in the browser; the file never leaves your device.

1. On the old device, click **Download backup** to get `business-backup-YYYY-MM-DD.zip`. Keep a copy
   somewhere safe, such as Google Drive or a USB drive.
2. On the new device, open the site. On the welcome screen choose **I have a backup file**, or later use
   **Import backup** and click **Check backup**.
3. Review what's in the backup, tick the confirmation box, and click **Restore backup**.

Backups from the earlier desktop version of the app restore here too.

The ZIP contains:

```
backup/
├── database.sqlite   products, inventory, customers, sales/invoices, settings
├── manifest.json     date, source device, row counts, SHA-256 of every file
├── images/           product images
└── documents/        documents (kept for backups from the desktop version)
```

How a restore protects your data:

- **Check:** every file is matched against its checksum, and a separate copy of the database is checked
  for integrity, required tables, broken record links, row counts that match the manifest, and schema
  version. If any check fails, the backup is rejected and your current data is never touched.
- **Safety backup:** before anything changes, the current data is saved in this browser as
  `pre-restore-<date-time>.zip` (the last 3 are kept). Download it from the same page to undo a restore.
- **Swap and verify:** the restored database replaces the current one, is upgraded if needed, gets its
  images back, and is checked again. Every image and document must be present.
- **Rollback:** if any step fails, the previous database is put back automatically.
- **Start over:** **This device → Start over** deletes the store on this device and returns to the
  welcome screen.

Backups from an older version of the app are upgraded automatically on restore. Backups from a newer
version are refused; reload the page to get the latest version first.

## Features

- **Dashboard**: today's sales, total products, low-stock products, recent sales and recent invoices.
- **Products**: add, edit, archive or restore, image upload, search by name/SKU/barcode, and filters for
  category, brand, stock status and archived.
- **Inventory**: stock in, stock out, adjustment (enter the counted quantity), damaged, and returns.
  Every change, including sales and opening stock, writes an inventory movement record. A product's
  quantity can only change through a movement.
- **Customers**: name, phone, email, address, notes, and purchase history.
- **Point of Sale**: search or scan products (Enter adds an exact barcode/SKU match), cart with quantity
  controls, discount (amount or %), tax rate, payment method, amount paid and change, and customer.
  The server recalculates every total from database prices. Stock goes down in the same transaction,
  and a sale that would push stock below zero is rejected.
- **Invoices**: numbered `INV-<year>-<6 digits>` (e.g. `INV-2026-000001`), with the sequence restarting
  each year. You can view, print (browser print, without the sidebar) or open/download a PDF, which is
  made in the browser. Print as A4 or as an 80mm or 58mm thermal receipt.

## CSV import & export

Go to **Settings → CSV Import/Export**. There are also shortcut buttons on the Products, Customers and
Invoices pages.

**Export** (opens in Excel, Google Sheets or LibreOffice):

- Products, with every field except the image
- Customers
- Sales: one row per invoice, or one row per product sold, with an optional date range

**Import** products or customers. Choosing a file shows a preview first, marking each row as **New**,
**Update** (with the exact changes), **Unchanged** or **Error**. Nothing is saved until you click
**Import**. Valid rows are imported in one step, and rows with errors are skipped.

| | Products | Customers |
|---|---|---|
| Matched by | SKU | Email, then phone number |
| Required columns | `sku`, plus `name` for new products | `name` |
| Other columns | `barcode, description, category, brand, cost_price, selling_price, quantity, min_stock, archived` | `phone, email, address, notes` |

- **Templates:** use **Download template** to get the expected headers. Common variations also work,
  for example "Item Code", "Product Name", "Price" or "Qty".
- **Blank cells:** a blank cell keeps the current value. CSV import cannot clear a field.
- **Stock:** the quantity for a new product is recorded as opening stock. A different quantity for an
  existing product is recorded as a stock adjustment, so every change still appears in Inventory.
- **Number format:** amounts may include thousands separators and a currency symbol, like `1,250.00` or
  `$3.50`. Use a dot for decimals.
- **Unchanged matches:** an email that differs only in capital letters, or a phone number that differs
  only in formatting, counts as unchanged.
- **Re-importing exports:** an exported file can be imported again without changes. Text starting with
  `= + - @` is exported with a leading `'` so spreadsheets don't run it as a formula, and that `'` is
  removed again on import.

## TikTok Shop

Shown as **Coming soon**. Syncing TikTok orders needs a server to hold the app secret and talk to
TikTok's API, which this browser-only version doesn't have.

## Project layout

```
src/db/schema.ts         Tables (products, customers, sales, sale_items, inventory_movements, settings, files)
src/db/index.ts          SQLite in the browser: open, migrate, save to IndexedDB, sync between tabs
src/db/live.ts           useLive(): re-renders a screen when the database changes
src/lib/inventory.ts     applyStockChange(): the single place stock quantities change
src/lib/data.ts          Read queries used by pages
src/lib/backup.ts        Backup ZIP export, checks and restore
src/lib/pdf.ts           Invoice PDF layout
src/lib/demo.ts          "Explore with demo data"
src/app/actions/         Writes (products, inventory, customers, sales, settings)
src/app/(app)/           Pages; detail pages take ?id= (e.g. /products/item?id=12)
scripts/prepare.mjs      Before dev/build: copies the SQLite engine to public/, bundles the migrations
drizzle/                 SQL migrations
```

## Changing the schema

Edit `src/db/schema.ts`, then run `npm run db:generate`. The new migration is bundled on the next dev
or build, and every browser applies it the next time it opens the app.

## Notes

- The built-in PDF fonts only cover Latin characters. If your currency symbol is outside that range
  (for example ₱), the PDF shows amounts without the symbol. The on-screen and printed invoices still
  show it.
- Money is stored as decimal numbers rounded to 2 places at every step.
