# Business Sales & Stock

Offline-first business sales and stock tracker.

## Features
- Manage items (SKU, name, unit price, stock qty)
- Add daily sales with multiple line items
- Validates stock before saving
- Auto-decrements stock on sale save
- Dashboard shows today totals and per-item breakdown
- Monthly sales summary (total revenue + line quantity count)

## Data Storage
This project uses `localStorage` in the browser:
- `bs_items_v1` for items
- `bs_sales_v1` for sales

## How to Run
Open `index.html` in a browser (no build step required).

