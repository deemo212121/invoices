# Inventory & Invoicing

A local-first inventory, point-of-sale and invoicing app for a small business. Everything runs on your
computer and works without internet access. There's no cloud database or account.

**Stack:** Next.js 16 (App Router), TypeScript, SQLite (better-sqlite3), Drizzle ORM, Tailwind CSS, pdfkit.

## Getting started

```bash
npm install
npm run seed      # optional: fills an EMPTY database with a month of connected demo data
npm run seed -- --reset   # rebuilds the demo (refuses unless the store is still the demo store)
npm run dev       # http://localhost:3000
```

For day-to-day use, run the faster production build:

```bash
npm run build
npm start
```

The demo adds a store ("Mendoza Mini Mart (Demo)", in ₱) with 30 products and their images, 12
customers, and about 220 invoices over the past 30 days. It also adds supplier deliveries, damaged
stock, customer returns linked to invoices, stock counts, and a few products left low or out of
stock. It is set up as a VAT-registered store with senior/PWD and business-buyer invoices. The seed only
runs on an empty database. To remove the demo before real use, stop the app,
delete the `data/` folder, and start the app again.

Open **Settings** first and fill in your business name, address and currency. That information is
printed on every invoice.

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

## Sign-in

The app is protected by one store password.

- **Creating it:** the first time you open the app on the shop computer, it asks you to create the
  password. That can only be done on the shop computer or shop network, never through the online
  address.
- **Sessions:** a sign-in lasts 30 days on each device. **Sign out** is at the bottom of the sidebar,
  or in the phone menu.
- **Changing it:** go to **Settings → Business → Store password**. Changing it signs out every other
  device.
- **Guessing:** after 8 wrong attempts, that address is locked out for 15 minutes.
- **Where it's stored:** the password is kept hashed in the database, so it travels with backups. The
  session signing key is in `data/session-secret`, which isn't backed up, so after a restore everyone
  signs in again.

## Online access (Cloudflare Tunnel)

The app keeps running on the shop computer, and Cloudflare gives it a secure `https://` address.

- **Starting it:** double-click **`start-online.cmd`**. It starts the app, then prints an address like
  `https://some-words.trycloudflare.com`. Keep both windows open while you want it online.
- **The address changes every time it starts.** For a permanent address, add a domain to Cloudflare
  and create a named tunnel (`cloudflared tunnel login`, then `cloudflared tunnel create invoices`).
- **The shop computer must be on** for the online address to work. On the shop network you can always
  use `http://<computer's IP>:3000` instead.
- **After updating the app,** run `npm run build` before starting it again.

## Where data lives

| What                      | Where                    |
| ------------------------- | ------------------------ |
| Database                  | `data/app.db` (SQLite)   |
| Product images            | `data/uploads/`          |
| Documents                 | `data/documents/`        |
| Automatic safety backups  | `data/backups/`          |

The database and its tables are created automatically on first start.

## Backup & restore (moving to a new computer)

Go to **Settings → Backup & Restore**.

1. On the old computer, click **Download backup** to get `business-backup-YYYY-MM-DD.zip`.
2. Install the app on the new computer (`npm install`, `npm run build`, `npm start`).
3. On the new computer, choose the ZIP under **Import backup** and click **Check backup**.
4. Review what's in the backup, tick the confirmation box, and click **Restore backup**.

The ZIP contains:

```
backup/
├── database.sqlite   products, inventory, customers, sales/invoices, settings
├── manifest.json     date, source computer, row counts, SHA-256 of every file
├── images/           product images
└── documents/        everything in data/documents
```

How a restore protects your data:

- **Check:** the ZIP is unpacked into a separate staging folder. Every file is matched against its
  checksum, and the staged database is checked for integrity, required tables, broken record links,
  row counts that match the manifest, and schema version. If any check fails, the backup is rejected and
  your current data is never touched.
- **Safety backup:** before anything changes, the current data is saved as
  `data/backups/pre-restore-<date-time>.zip`. To undo a restore, import that file.
- **Swap and verify:** the current files are moved aside and the restored files are moved in. The
  database is then reopened and checked again, and every image and document must be present.
- **Rollback:** if any step fails, the previous files are moved back automatically.

Backups from an older version of the app are upgraded automatically on restore. Backups from a newer
version are refused, so update the app first.

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
  each year. You can view, print (browser print, without the sidebar) or open/download a PDF.

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

Go to **Settings → Marketplaces**. This needs internet only while syncing. The rest of the app keeps
working offline.

1. In TikTok Shop Partner Center, create a **Custom** app with the redirect URL
   `http://localhost:3000/api/tiktok/callback`.
2. Enter the **App Key**, **App Secret** and the app's **authorization link** in Settings →
   Marketplaces, then click **Connect TikTok Shop**. If the redirect doesn't come back, paste the
   address it landed on under "Connect with an authorization code".
3. Click **Sync now**, or turn on auto-sync, which runs every 10 minutes while the app is open.

Each sync does four things:

- **Downloads your TikTok products** and links each SKU to your product with the same SKU. You can
  change the links under **Product links**.
- **Imports paid orders** (awaiting shipment or later) as sales tagged **TikTok**, each with your own
  Sales Invoice and normal stock movements. Unpaid orders wait.
- **Reverses cancelled orders:** stock is returned and the invoice is marked cancelled.
- **Flags problems instead of guessing.** Orders with an unlinked SKU or not enough stock are listed
  under **TikTok orders** and retried on the next sync.
- **Sends your stock levels** to TikTok for every linked SKU.

TikTok prices are VAT-inclusive, like the POS. The invoice uses the price the buyer paid per item.
Shipping fees aren't included, because they belong to TikTok's logistics.

The App Secret and tokens are stored only in `data/app.db`, which means they're also in backups, so
keep backup files private. API calls follow TikTok's official Node.js SDK, which is kept in
`vendor/tiktok-shop-sdk` as a reference.

## Project layout

```
src/db/schema.ts        Tables (products, customers, sales, sale_items, inventory_movements, settings)
src/db/index.ts         SQLite connection + automatic migrations
src/lib/inventory.ts    applyStockChange(): the single place stock quantities change
src/lib/data.ts         Read queries used by pages
src/lib/pdf.ts          Invoice PDF layout
src/app/actions/        Server actions (products, inventory, customers, sales, settings)
src/app/...             Pages; invoices/[id]/pdf and uploads/[file] are route handlers
drizzle/                SQL migrations
```

## Changing the schema

Edit `src/db/schema.ts`, then run `npm run db:generate`. The new migration is applied automatically the
next time the app starts. `npm run db:studio` opens a browser view of the database.

## Notes

- The built-in PDF fonts only cover Latin characters. If your currency symbol is outside that range
  (for example ₱), the PDF shows amounts without the symbol. The on-screen and printed invoices still
  show it.
- Money is stored as decimal numbers rounded to 2 places at every step.
