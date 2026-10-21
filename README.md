# Receipt Tally

Screenshot a receipt (or your card app's transaction list), drop it in, and the expense is read and tallied for you.

- **Drop, choose, or paste** (Ctrl+V) screenshots. Several at once is fine.
- **Reads the text on your device** with [Tesseract.js](https://github.com/naptha/tesseract.js). Images are never uploaded.
- Finds the **total, date, and merchant** on a receipt, or **every transaction** in a card-app or statement screenshot. Payments and refunds are left unchecked.
- **Auto-categorizes** (Dining, Groceries, Transport…) and learns from your corrections.
- Flags **possible duplicates** before you add them.
- Monthly total, category breakdown, search, edit, and **CSV export** / JSON backup.

Expenses are stored in your browser's local storage, so they stay on the device you use. Use **Back up data** to move them to another device.

## Run locally

It's a static site with no build step. Serve the folder with any static server and open `index.html`.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page layout |
| `styles.css` | Styles, including dark mode |
| `parser.js` | Turns OCR text into expense rows (totals, dates, merchants, categories) |
| `app.js` | Upload, OCR, review, storage, and the dashboard |
