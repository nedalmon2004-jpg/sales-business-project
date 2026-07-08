// Offline version (localStorage). Designed to be super easy.
// If backend becomes available later, you can swap functions to call APIs.

const LS_KEYS = {
  items: 'bs_items_v1',
  sales: 'bs_sales_v1'
};

const $ = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

function toast(text) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function getItems() {
  try { return JSON.parse(localStorage.getItem(LS_KEYS.items) || '[]'); } catch { return []; }
}
function setItems(items) {
  localStorage.setItem(LS_KEYS.items, JSON.stringify(items));
}

function getSales() {
  try { return JSON.parse(localStorage.getItem(LS_KEYS.sales) || '[]'); } catch { return []; }
}
function setSales(sales) {
  localStorage.setItem(LS_KEYS.sales, JSON.stringify(sales));
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtMoney(n) {
  const num = Number(n || 0);
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function parseMoney(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function showPage(pageId) {
  qsa('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById('page-' + pageId).classList.remove('hidden');
}

function routeFromNav() {
  const navLinks = qsa('a[data-page]');
  navLinks.forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      showPage(a.getAttribute('data-page'));
    });
  });
}

function renderItemsTable() {
  const items = getItems();
  const box = $('#itemsTable');
  if (!box) return;

  if (items.length === 0) {
    box.innerHTML = '<div style="padding:12px 14px;color:rgba(0,0,0,.65);font-weight:800;">No items yet.</div>';
    return;
  }

  box.innerHTML = items.map(it => `
    <div class="trow" style="grid-template-columns:1.2fr 1fr 1fr 1fr;">
      <div style="font-weight:900;">${it.sku} — ${it.name}</div>
      <div>${it.unitPrice}</div>
      <div>${it.stockQty}</div>
      <div>
        <button class="btn secondary" type="button" data-edit="${it.sku}">Edit</button>
      </div>
    </div>
  `).join('');

  qsa('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sku = btn.getAttribute('data-edit');
      const it = items.find(x => x.sku === sku);
      if (!it) return;
      const unit = prompt('Unit price for ' + it.name, String(it.unitPrice));
      if (unit === null) return;
      const stock = prompt('Stock quantity for ' + it.name, String(it.stockQty));
      if (stock === null) return;

      it.unitPrice = parseMoney(unit);
      it.stockQty = parseMoney(stock);
      setItems(items);
      toast('Item updated');
      renderItemsTable();
      loadSaleItems();
    });
  });
}

function ensureSaleLineSelectOptions() {
  const selects = qsa('select[data-field="itemId"]');
  if (selects.length === 0) return;
  const items = getItems();
  selects.forEach(sel => {
    sel.innerHTML = items.map(it => `<option value="${it.sku}">${it.name} (Stock: ${it.stockQty})</option>`).join('');
  });
}

let saleLineIndex = 0;
let saleItemsCache = [];

function lineHtml(index) {
  return `
    <div class="itemline" data-line="${index}" style="margin-top:8px;">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;width:100%">
        <label style="min-width:260px;">Item
          <select data-field="itemId" required>
            ${saleItemsCache.map(it => `<option value="${it.sku}">${it.name} (Stock: ${it.stockQty})</option>`).join('')}
          </select>
        </label>
        <label>Qty
          <input data-field="qty" type="number" min="1" required value="1"/>
        </label>
        <button class="btn danger" type="button" data-remove="${index}">Remove</button>
      </div>
    </div>
  `;
}

function addLine() {
  const linesEl = $('#lines');
  linesEl.insertAdjacentHTML('beforeend', lineHtml(saleLineIndex));
  const idx = saleLineIndex;
  saleLineIndex++;

  const btn = linesEl.querySelector('[data-remove="' + idx + '"]');
  if (btn) {
    btn.addEventListener('click', () => {
      const parent = btn.closest('[data-line]');
      if (parent) parent.remove();
    });
  }
}

function getLinesPayload() {
  const payload = [];
  const nodes = qsa('[data-line]');
  for (const node of nodes) {
    const sku = node.querySelector('[data-field="itemId"]').value;
    const qty = node.querySelector('[data-field="qty"]').value;
    payload.push({ sku, qty: Number(qty) });
  }
  return payload;
}

function loadSaleItems() {
  saleItemsCache = getItems();
  ensureSaleLineSelectOptions();
}

function refreshDashboardToday() {
  const d = new Date();
  $('#todayLabel') && ($('#todayLabel').textContent = d.toLocaleDateString());

  const today = todayISO();
  const sales = getSales().filter(s => s.saleDate === today);

  const total = sales.reduce((acc, s) => acc + Number(s.total || 0), 0);
  const linesCount = sales.reduce((acc, s) => acc + (s.lines || []).reduce((a, l) => a + (l.qty || 0), 0), 0);

  // show both old and new KPI ids if they exist
  if ($('#todayTotal')) $('#todayTotal').textContent = fmtMoney(total);
  if ($('#todayLines')) $('#todayLines').textContent = linesCount;
  if ($('#dayAmountMade')) $('#dayAmountMade').textContent = fmtMoney(total);

  const map = new Map();
  for (const sale of sales) {
    for (const line of (sale.lines || [])) {
      const key = line.itemName || line.sku;
      const prev = map.get(key) || { qty: 0, unitPrice: line.unitPriceAtSale || 0, total: 0 };
      prev.qty += Number(line.qty || 0);
      prev.total += Number(line.qty || 0) * Number(line.unitPriceAtSale || 0);
      map.set(key, prev);
    }
  }

  const box = $('#todayLinesTable');
  if (!box) return;
  if (map.size === 0) {
    box.innerHTML = '<div style="padding:12px 14px; color:rgba(0,0,0,.65);font-weight:800;">No sales yet.</div>';
    return;
  }

  box.innerHTML = Array.from(map.entries()).map(([name, v]) => `
    <div class="trow" style="grid-template-columns:1.3fr 1fr 1fr 1fr;">
      <div>${name}</div>
      <div>${v.qty}</div>
      <div>${fmtMoney(v.unitPrice)}</div>
      <div>${fmtMoney(v.total)}</div>
    </div>
  `).join('');
}

function computeMonthly(year, month) {
  // month: 1-12
  const all = getSales();
  const mStart = new Date(year, month - 1, 1);
  const mEnd = new Date(year, month, 1);

  let total = 0;
  let linesQtySum = 0;

  for (const sale of all) {
    const sd = new Date(sale.saleDate);
    if (sd >= mStart && sd < mEnd) {
      total += Number(sale.total || 0);
      for (const l of (sale.lines || [])) linesQtySum += Number(l.qty || 0);
    }
  }

  return { total, linesCount: linesQtySum };
}

function boot() {
  routeFromNav();

  // Nav buttons inside pages
  qsa('button[data-go]').forEach(b => {
    b.addEventListener('click', () => showPage(b.getAttribute('data-go')));
  });

  // Items page
  const itemForm = $('#itemForm');
  if (itemForm) {
    itemForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(itemForm);
      const sku = String(fd.get('sku') || '').trim();
      const name = String(fd.get('name') || '').trim();
      const unitPrice = parseMoney(fd.get('unitPrice'));
      const stockQty = parseMoney(fd.get('stockQty'));

      if (!sku || !name) return toast('SKU and Name are required');

      const items = getItems();
      const idx = items.findIndex(x => x.sku === sku);
      if (idx >= 0) {
        items[idx].name = name;
        items[idx].unitPrice = unitPrice;
        items[idx].stockQty = stockQty;
      } else {
        items.push({ sku, name, unitPrice, stockQty });
      }

      setItems(items);
      toast('Saved');
      renderItemsTable();
      loadSaleItems();
      e.target.reset();
    });
  }

  // Sales page
  const saleForm = $('#saleForm');
  if (saleForm) {
    document.getElementById('saleDate').value = todayISO();

    $('#addLineBtn').addEventListener('click', () => addLine());
    $('#clearBtn').addEventListener('click', () => {
      $('#lines').innerHTML = '';
      saleLineIndex = 0;
      addLine();
    });

    saleForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const saleDate = String(document.getElementById('saleDate').value);
      const lines = getLinesPayload();
      if (lines.length === 0) return toast('Add at least one item');

      const items = getItems();

      // validate stock
      for (const line of lines) {
        const it = items.find(x => x.sku === line.sku);
        if (!it) return toast('Item not found');
        if (line.qty <= 0) return toast('Qty must be > 0');
        if (it.stockQty < line.qty) return toast('Not enough stock for ' + it.name);
      }

      // commit sale + decrement stock
      let total = 0;
      const saleLines = lines.map(line => {
        const it = items.find(x => x.sku === line.sku);
        const unitPriceAtSale = it.unitPrice;
        total += line.qty * unitPriceAtSale;
        it.stockQty -= line.qty;
        return { sku: it.sku, itemName: it.name, qty: line.qty, unitPriceAtSale };
      });

      const sales = getSales();
      sales.push({ id: Date.now(), saleDate, total, lines: saleLines });
      setSales(sales);
      setItems(items);

      toast('Sale saved');
      $('#lines').innerHTML = '';
      saleLineIndex = 0;
      addLine();
      document.getElementById('saleDate').value = todayISO();

      renderItemsTable();
      loadSaleItems();
      refreshDashboardToday();
    });
  }

  // Monthly page
  const loadBtn = $('#loadBtn');
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      const year = Number($('#year').value);
      const month = Number($('#month').value);
      const summary = computeMonthly(year, month);
      $('#mTotal').textContent = fmtMoney(summary.total);
      $('#mLines').textContent = summary.linesCount;
    });
  }

  // Initial render
  renderItemsTable();
  loadSaleItems();
  if ($('#todayLinesTable')) refreshDashboardToday();

  // Start on dashboard
  showPage('dashboard');

  // Ensure a line exists
  if ($('#page-sales') && !$('#lines').children.length) addLine();
}

// If user opens history.html directly, boot() should not run.
if (document.getElementById('page-dashboard') || document.getElementById('page-items') || document.getElementById('page-sales') || document.getElementById('page-monthly')) {
  boot();
}


