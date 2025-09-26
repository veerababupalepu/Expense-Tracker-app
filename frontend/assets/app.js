// Determine API base dynamically:
// - If window.API_BASE_URL is set (via <script>), use it
// - Else, default to relative /api which works with reverse proxies/rewrites
// - In local dev without proxy, you can set window.API_BASE_URL = "http://localhost:5000/api"
const API_BASE = (typeof window !== 'undefined' && window.API_BASE_URL)
  ? String(window.API_BASE_URL || '').replace(/\/$/, '')
  : '/api';

function apiUrl(path, queryParams = null) {
  const cleanedPath = String(path || '').startsWith('/') ? path : `/${path || ''}`;
  const isAbsolute = /^https?:\/\//i.test(API_BASE);
  let base = API_BASE;
  if (!isAbsolute) {
    base = API_BASE.startsWith('/') ? API_BASE : `/${API_BASE}`;
  }
  const url = isAbsolute
    ? new URL(cleanedPath.replace(/^\//, ''), `${base.replace(/\/$/, '/')}`)
    : new URL(`${base.replace(/\/$/, '')}${cleanedPath}`, window.location.origin);
  if (queryParams && typeof queryParams === 'object') {
    Object.entries(queryParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).length) {
        url.searchParams.set(k, String(v));
      }
    });
  }
  return url.toString();
}

const els = {
  form: document.getElementById("expense-form"),
  id: document.getElementById("expense-id"),
  title: document.getElementById("title"),
  amount: document.getElementById("amount"),
  date: document.getElementById("date"),
  category: document.getElementById("category"),
  type: document.getElementById("type"),
  tbody: document.getElementById("expense-tbody"),
  income: document.getElementById("income"),
  expenses: document.getElementById("expenses"),
  balance: document.getElementById("balance"),
  filterCategory: document.getElementById("filter-category"),
  resetBtn: document.getElementById("reset-btn"),
  vizDataset: document.getElementById("viz-dataset"),
  vizType: document.getElementById("viz-type"),
};

let chartRef = null;
let cachedAllExpenses = [];

function toCurrency(n) {
  return Number(n || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
}

function showToast(message) {
  alert(message);
}

function validateForm() {
  const errors = [];
  if (!els.title.value.trim()) errors.push("Title is required");
  const amt = parseFloat(els.amount.value);
  if (Number.isNaN(amt)) errors.push("Amount must be a number");
  if (!els.date.value) errors.push("Date is required");
  if (!els.category.value.trim()) errors.push("Category is required");
  if (errors.length) {
    showToast(errors.join("\n"));
    return false;
  }
  return true;
}

function setForm(data) {
  els.id.value = data?.id || "";
  els.title.value = data?.title || "";
  els.amount.value = data?.amount ?? "";
  els.date.value = data?.date || new Date().toISOString().slice(0, 10);
  els.category.value = data?.category || "";
  els.type.value = data?.type || "expense";
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

function cacheSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function cacheGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

async function refreshSummary() {
  try {
    const data = await fetchJSON(`${API_BASE}/summary`);
    els.income.textContent = toCurrency(data.income);
    els.expenses.textContent = toCurrency(data.expense);
    els.balance.textContent = toCurrency(data.balance);
    drawChartUsingSelection(data.byCategory || [], cachedAllExpenses);
    cacheSet("summary", data);
  } catch (e) {
    const cached = cacheGet("summary", { income: 0, expense: 0, balance: 0, byCategory: [] });
    els.income.textContent = toCurrency(cached.income);
    els.expenses.textContent = toCurrency(cached.expense);
    els.balance.textContent = toCurrency(cached.balance);
    drawChartUsingSelection(cached.byCategory || [], cachedAllExpenses);
  }
}

function collectCategories(items) {
  const set = new Set(items.map((x) => x.category).filter(Boolean));
  return ["", ...Array.from(set).sort()];
}

function populateFilter(items) {
  const cats = collectCategories(items);
  const current = els.filterCategory.value;
  els.filterCategory.innerHTML = cats
    .map((c) => `<option value="${c}">${c || "All Categories"}</option>`)
    .join("");
  if (cats.includes(current)) els.filterCategory.value = current;
}

function renderRows(items) {
  els.tbody.innerHTML = items
    .map((x) => {
      const amount = toCurrency(x.amount);
      return `<tr>
        <td>${x.title}</td>
        <td style="color:${x.type === 'income' ? '#22c55e' : '#ef4444'}">${amount}</td>
        <td>${x.type}</td>
        <td>${x.category}</td>
        <td>${x.date}</td>
        <td>
          <button data-id="${x.id}" data-action="edit" class="secondary">Edit</button>
          <button data-id="${x.id}" data-action="delete" class="danger">Delete</button>
        </td>
      </tr>`;
    })
    .join("");
}

async function refreshList() {
  const cat = els.filterCategory.value || "";
  const url = apiUrl('/expenses', cat ? { category: cat } : null);
  try {
    const items = await fetchJSON(url);
    renderRows(items);
    populateFilter(items);
    cacheSet("expenses", items);
    cachedAllExpenses = items;
  } catch (e) {
    const cached = cacheGet("expenses", []);
    renderRows(cached.filter((x) => !cat || x.category === cat));
    populateFilter(cached);
    cachedAllExpenses = cached;
  }
}

function buildTimeSeries(entries) {
  // Build YYYY-MM labels sorted, and sums for income/expense and net
  const map = new Map();
  for (const e of entries) {
    const ym = (e.date || '').slice(0,7);
    if (!ym) continue;
    if (!map.has(ym)) map.set(ym, { income: 0, expense: 0 });
    const rec = map.get(ym);
    if (e.type === 'income') rec.income += Number(e.amount) || 0;
    else rec.expense += Number(e.amount) || 0;
  }
  const labels = Array.from(map.keys()).sort();
  const incomes = labels.map(l => map.get(l).income);
  const expenses = labels.map(l => map.get(l).expense);
  const net = labels.map((_, i) => incomes[i] - expenses[i]);
  return { labels, incomes, expenses, net };
}

function drawChart(byCategory) {
  const ctx = document.getElementById("categoryChart");
  if (!ctx) return;
  const labels = byCategory.map((x) => x.category);
  const values = byCategory.map((x) => Number(x.total));
  const colors = labels.map((_, i) => `hsl(${(i * 47) % 360} 70% 55%)`);
  if (chartRef) chartRef.destroy();
  chartRef = new Chart(ctx, {
    type: els.vizType?.value || "doughnut",
    data: { labels, datasets: [{ label: 'Expenses', data: values, backgroundColor: colors }] },
    options: { plugins: { legend: { position: "bottom" } } },
  });
}

function drawChartTimeSeries(expenses, mode) {
  const ctx = document.getElementById("categoryChart");
  if (!ctx) return;
  const { labels, incomes, expenses: exp, net } = buildTimeSeries(expenses);
  const type = els.vizType?.value || (mode === 'netOverTime' ? 'line' : 'line');
  let datasets = [];
  if (mode === 'typeOverTime') {
    datasets = [
      { label: 'Income', data: incomes, borderColor: '#22c55e', backgroundColor: '#22c55e55', fill: false },
      { label: 'Expense', data: exp, borderColor: '#ef4444', backgroundColor: '#ef444455', fill: false },
    ];
  } else { // netOverTime
    datasets = [
      { label: 'Net', data: net, borderColor: '#60a5fa', backgroundColor: '#60a5fa55', fill: false },
    ];
  }
  if (chartRef) chartRef.destroy();
  chartRef = new Chart(ctx, {
    type,
    data: { labels, datasets },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
  });
}

function drawChartUsingSelection(byCategory, expenses) {
  const datasetOpt = els.vizDataset?.value || 'byCategory';
  if (datasetOpt === 'byCategory') return drawChart(byCategory);
  if (datasetOpt === 'typeOverTime') return drawChartTimeSeries(expenses, 'typeOverTime');
  if (datasetOpt === 'netOverTime') return drawChartTimeSeries(expenses, 'netOverTime');
}

async function onSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;
  const payload = {
    title: els.title.value.trim(),
    amount: parseFloat(els.amount.value),
    date: els.date.value,
    category: els.category.value.trim(),
    type: els.type.value,
  };
  try {
    if (els.id.value) {
      await fetchJSON(apiUrl(`/expenses/${els.id.value}`), { method: "PUT", body: JSON.stringify(payload) });
      showToast("Updated");
    } else {
      await fetchJSON(apiUrl('/expenses'), { method: "POST", body: JSON.stringify(payload) });
      showToast("Added");
    }
    setForm({});
    await Promise.all([refreshList(), refreshSummary()]);
  } catch (e) {
    showToast("Save failed: " + e.message);
  }
}

function onTableClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  const action = btn.getAttribute("data-action");
  if (action === "edit") {
    const cached = cacheGet("expenses", []);
    const item = cached.find((x) => String(x.id) === String(id));
    if (item) setForm(item);
  } else if (action === "delete") {
    if (!confirm("Delete this entry?")) return;
    fetchJSON(apiUrl(`/expenses/${id}`), { method: "DELETE" })
      .then(() => Promise.all([refreshList(), refreshSummary()]))
      .catch((e) => showToast("Delete failed: " + e.message));
  }
}

function init() {
  setForm({});
  els.form.addEventListener("submit", onSubmit);
  els.resetBtn.addEventListener("click", () => setForm({}));
  els.tbody.addEventListener("click", onTableClick);
  els.filterCategory.addEventListener("change", refreshList);
  if (els.vizDataset) els.vizDataset.addEventListener('change', () => drawChartUsingSelection(cacheGet('summary', {byCategory: []}).byCategory || [], cachedAllExpenses));
  if (els.vizType) els.vizType.addEventListener('change', () => drawChartUsingSelection(cacheGet('summary', {byCategory: []}).byCategory || [], cachedAllExpenses));

  // Warm start from cache
  const cached = cacheGet("expenses", []);
  renderRows(cached);
  populateFilter(cached);
  const cachedSummary = cacheGet("summary", { income: 0, expense: 0, balance: 0, byCategory: [] });
  els.income.textContent = toCurrency(cachedSummary.income);
  els.expenses.textContent = toCurrency(cachedSummary.expense);
  els.balance.textContent = toCurrency(cachedSummary.balance);
  drawChartUsingSelection(cachedSummary.byCategory, cachedAllExpenses);

  // Fetch fresh
  refreshList();
  refreshSummary();
}

document.addEventListener("DOMContentLoaded", init);


