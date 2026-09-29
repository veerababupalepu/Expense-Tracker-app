```javascript
/* =========================================================
   VH EXPENSE TRACKER
   Application JavaScript
   ========================================================= */


/* =========================================================
   API CONFIGURATION
   ========================================================= */

const API_BASE =
    typeof window !== "undefined" && window.API_BASE_URL
        ? String(window.API_BASE_URL).replace(/\/$/, "")
        : "/api";


function apiUrl(path, queryParams = null) {

    const cleanPath =
        String(path || "").startsWith("/")
            ? String(path)
            : `/${path}`;

    const isAbsolute =
        /^https?:\/\//i.test(API_BASE);

    let url;

    if (isAbsolute) {

        url = new URL(
            cleanPath.replace(/^\//, ""),
            `${API_BASE.replace(/\/$/, "")}/`
        );

    } else {

        const base =
            API_BASE.startsWith("/")
                ? API_BASE
                : `/${API_BASE}`;

        url = new URL(
            `${base.replace(/\/$/, "")}${cleanPath}`,
            window.location.origin
        );
    }

    if (queryParams && typeof queryParams === "object") {

        Object.entries(queryParams).forEach(([key, value]) => {

            if (
                value !== undefined &&
                value !== null &&
                String(value).length
            ) {
                url.searchParams.set(key, String(value));
            }

        });
    }

    return url.toString();
}


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

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

    filterCategory:
        document.getElementById("filter-category"),

    filterType:
        document.getElementById("filter-type"),

    search:
        document.getElementById("search-input"),

    resetBtn:
        document.getElementById("reset-btn"),

    saveBtn:
        document.getElementById("save-btn"),

    vizDataset:
        document.getElementById("viz-dataset"),

    vizType:
        document.getElementById("viz-type"),

    transactionCount:
        document.getElementById("transaction-count"),

    emptyState:
        document.getElementById("empty-state"),

    themeToggle:
        document.getElementById("theme-toggle"),

    mobileMenuBtn:
        document.getElementById("mobile-menu-btn"),

    sidebar:
        document.getElementById("sidebar"),

    sidebarOverlay:
        document.getElementById("sidebar-overlay"),

    toastContainer:
        document.getElementById("toast-container")

};


/* =========================================================
   APPLICATION STATE
   ========================================================= */

let chartRef = null;

let cachedAllExpenses = [];

let currentFilteredExpenses = [];

let isEditing = false;


/* =========================================================
   CURRENCY
   ========================================================= */

function toCurrency(value) {

    const number =
        Number(value || 0);

    return number.toLocaleString(
        "en-IN",
        {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }
    );
}


/* =========================================================
   HTML ESCAPE
   Prevents unsafe HTML injection in transactions
   ========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   TOAST NOTIFICATIONS
   ========================================================= */

function showToast(message, type = "success") {

    if (!els.toastContainer) {

        alert(message);

        return;
    }

    const toast =
        document.createElement("div");

    toast.className =
        "toast";

    let icon =
        "fa-circle-check";

    if (type === "error") {
        icon = "fa-circle-exclamation";
    }

    if (type === "warning") {
        icon = "fa-triangle-exclamation";
    }

    toast.innerHTML = `
        <div style="
            display:flex;
            align-items:center;
            gap:10px;
        ">
            <i class="fa-solid ${icon}"></i>
            <span>${escapeHTML(message)}</span>
        </div>
    `;

    els.toastContainer.appendChild(toast);

    setTimeout(() => {

        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";

        setTimeout(() => {
            toast.remove();
        }, 250);

    }, 3000);
}


/* =========================================================
   LOADING BUTTON
   ========================================================= */

function setLoading(loading) {

    if (!els.saveBtn) return;

    if (loading) {

        els.saveBtn.disabled = true;

        els.saveBtn.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Saving...
        `;

    } else {

        els.saveBtn.disabled = false;

        els.saveBtn.innerHTML = `
            <i class="fa-solid fa-check"></i>
            ${isEditing ? "Update Transaction" : "Save Transaction"}
        `;
    }
}


/* =========================================================
   VALIDATION
   ========================================================= */

function validateForm() {

    const errors = [];

    const title =
        els.title.value.trim();

    const amount =
        parseFloat(els.amount.value);

    const category =
        els.category.value.trim();

    if (!title) {

        errors.push(
            "Title is required."
        );
    }

    if (
        Number.isNaN(amount) ||
        amount <= 0
    ) {

        errors.push(
            "Enter a valid amount."
        );
    }

    if (!els.date.value) {

        errors.push(
            "Date is required."
        );
    }

    if (!category) {

        errors.push(
            "Category is required."
        );
    }

    if (errors.length) {

        showToast(
            errors[0],
            "error"
        );

        return false;
    }

    return true;
}


/* =========================================================
   FORM MANAGEMENT
   ========================================================= */

function setForm(data = {}) {

    isEditing =
        Boolean(data.id);

    els.id.value =
        data.id || "";

    els.title.value =
        data.title || "";

    els.amount.value =
        data.amount ?? "";

    els.date.value =
        data.date ||
        new Date()
            .toISOString()
            .slice(0, 10);

    els.category.value =
        data.category || "";

    els.type.value =
        data.type || "expense";

    updateFormMode();
}


function updateFormMode() {

    if (!els.saveBtn) return;

    if (isEditing) {

        els.saveBtn.innerHTML = `
            <i class="fa-solid fa-pen-to-square"></i>
            Update Transaction
        `;

    } else {

        els.saveBtn.innerHTML = `
            <i class="fa-solid fa-check"></i>
            Save Transaction
        `;
    }
}


/* =========================================================
   FETCH HELPER
   ========================================================= */

async function fetchJSON(url, options = {}) {

    const response =
        await fetch(url, {

            headers: {
                "Content-Type":
                    "application/json",

                ...(options.headers || {})
            },

            ...options
        });

    if (!response.ok) {

        let errorMessage =
            `Request failed (${response.status})`;

        try {

            const text =
                await response.text();

            if (text) {
                errorMessage = text;
            }

        } catch (_) {}

        throw new Error(errorMessage);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}


/* =========================================================
   LOCAL STORAGE CACHE
   ========================================================= */

function cacheSet(key, value) {

    try {

        localStorage.setItem(
            key,
            JSON.stringify(value)
        );

    } catch (_) {}
}


function cacheGet(key, fallback = null) {

    try {

        const value =
            localStorage.getItem(key);

        return value
            ? JSON.parse(value)
            : fallback;

    } catch (_) {

        return fallback;
    }
}


/* =========================================================
   SUMMARY
   ========================================================= */

async function refreshSummary() {

    try {

        const data =
            await fetchJSON(
                apiUrl("/summary")
            );

        updateSummaryUI(data);

        cacheSet(
            "summary",
            data
        );

        drawChartUsingSelection(
            data.byCategory || [],
            cachedAllExpenses
        );

    } catch (error) {

        console.warn(
            "Summary request failed:",
            error
        );

        const cached =
            cacheGet(
                "summary",
                {
                    income: 0,
                    expense: 0,
                    balance: 0,
                    byCategory: []
                }
            );

        updateSummaryUI(cached);

        drawChartUsingSelection(
            cached.byCategory || [],
            cachedAllExpenses
        );
    }
}


function updateSummaryUI(data) {

    if (els.income) {

        els.income.textContent =
            toCurrency(data.income);
    }

    if (els.expenses) {

        els.expenses.textContent =
            toCurrency(data.expense);
    }

    if (els.balance) {

        els.balance.textContent =
            toCurrency(data.balance);
    }

    updateBalanceColor(
        Number(data.balance || 0)
    );
}


function updateBalanceColor(balance) {

    if (!els.balance) return;

    if (balance < 0) {

        els.balance.style.color =
            "#ef4444";

    } else {

        els.balance.style.color =
            "";
    }
}


/* =========================================================
   CATEGORY MANAGEMENT
   ========================================================= */

function collectCategories(items) {

    const set =
        new Set();

    items.forEach(item => {

        if (
            item.category &&
            String(item.category).trim()
        ) {

            set.add(
                String(item.category).trim()
            );
        }

    });

    return [
        "",
        ...Array.from(set).sort(
            (a, b) =>
                a.localeCompare(b)
        )
    ];
}


function populateFilter(items) {

    if (!els.filterCategory) {
        return;
    }

    const categories =
        collectCategories(items);

    const current =
        els.filterCategory.value;

    els.filterCategory.innerHTML =
        categories
            .map(category => {

                return `
                    <option value="${escapeHTML(category)}">
                        ${escapeHTML(
                            category ||
                            "All Categories"
                        )}
                    </option>
                `;

            })
            .join("");

    if (
        categories.includes(current)
    ) {

        els.filterCategory.value =
            current;
    }
}


/* =========================================================
   FILTERING
   ========================================================= */

function getFilteredExpenses() {

    const search =
        (els.search?.value || "")
            .trim()
            .toLowerCase();

    const category =
        els.filterCategory?.value || "";

    const type =
        els.filterType?.value || "";

    return cachedAllExpenses.filter(item => {

        const matchesSearch =
            !search ||
            String(item.title || "")
                .toLowerCase()
                .includes(search) ||

            String(item.category || "")
                .toLowerCase()
                .includes(search);

        const matchesCategory =
            !category ||
            String(item.category || "") ===
                category;

        const matchesType =
            !type ||
            String(item.type || "") ===
                type;

        return (
            matchesSearch &&
            matchesCategory &&
            matchesType
        );
    });
}


function applyFilters() {

    const filtered =
        getFilteredExpenses();

    currentFilteredExpenses =
        filtered;

    renderRows(filtered);

    updateTransactionCount(
        filtered.length
    );
}


function updateTransactionCount(count) {

    if (!els.transactionCount) {
        return;
    }

    els.transactionCount.textContent =
        count;
}


/* =========================================================
   RENDER TRANSACTIONS
   ========================================================= */

function renderRows(items) {

    if (!els.tbody) return;

    if (!items.length) {

        els.tbody.innerHTML = "";

        if (els.emptyState) {

            els.emptyState.style.display =
                "block";
        }

        return;
    }

    if (els.emptyState) {

        els.emptyState.style.display =
            "none";
    }

    els.tbody.innerHTML =
        items
            .map(item => {

                const isIncome =
                    item.type === "income";

                const amountClass =
                    isIncome
                        ? "income-amount"
                        : "expense-amount";

                const sign =
                    isIncome
                        ? "+"
                        : "-";

                return `
                    <tr>

                        <td>
                            <div style="
                                display:flex;
                                align-items:center;
                                gap:10px;
                            ">

                                <div style="
                                    width:34px;
                                    height:34px;
                                    border-radius:10px;
                                    display:flex;
                                    align-items:center;
                                    justify-content:center;
                                    background:
                                        ${
                                            isIncome
                                                ? "var(--success-light)"
                                                : "var(--danger-light)"
                                        };
                                    color:
                                        ${
                                            isIncome
                                                ? "var(--success)"
                                                : "var(--danger)"
                                        };
                                ">

                                    <i class="fa-solid ${
                                        isIncome
                                            ? "fa-arrow-down"
                                            : "fa-arrow-up"
                                    }"></i>

                                </div>

                                <div>

                                    <strong style="
                                        display:block;
                                        color:var(--text);
                                        font-size:11px;
                                    ">
                                        ${escapeHTML(
                                            item.title
                                        )}
                                    </strong>

                                    <small style="
                                        color:var(--text-muted);
                                        font-size:8px;
                                    ">
                                        Transaction
                                    </small>

                                </div>

                            </div>
                        </td>


                        <td>

                            <strong
                                class="${amountClass}"
                                style="
                                    color:
                                        ${
                                            isIncome
                                                ? "var(--success)"
                                                : "var(--danger)"
                                        };
                                "
                            >
                                ${sign}${toCurrency(
                                    item.amount
                                )}
                            </strong>

                        </td>


                        <td>

                            <span style="
                                display:inline-flex;
                                align-items:center;
                                padding:5px 8px;
                                border-radius:20px;
                                font-size:8px;
                                font-weight:700;
                                background:
                                    ${
                                        isIncome
                                            ? "var(--success-light)"
                                            : "var(--danger-light)"
                                    };
                                color:
                                    ${
                                        isIncome
                                            ? "var(--success)"
                                            : "var(--danger)"
                                    };
                            ">
                                ${isIncome
                                    ? "Income"
                                    : "Expense"}
                            </span>

                        </td>


                        <td>

                            <span style="
                                display:inline-flex;
                                align-items:center;
                                gap:5px;
                            ">

                                <i
                                    class="fa-solid fa-tag"
                                    style="
                                        color:var(--primary);
                                        font-size:8px;
                                    "
                                ></i>

                                ${escapeHTML(
                                    item.category
                                )}

                            </span>

                        </td>


                        <td>

                            <span style="
                                color:var(--text-secondary);
                            ">
                                ${formatDate(
                                    item.date
                                )}
                            </span>

                        </td>


                        <td>

                            <button
                                type="button"
                                class="edit-btn"
                                data-id="${escapeHTML(
                                    item.id
                                )}"
                                data-action="edit"
                                title="Edit"
                            >
                                <i class="fa-solid fa-pen"></i>
                            </button>

                            <button
                                type="button"
                                class="delete-btn"
                                data-id="${escapeHTML(
                                    item.id
                                )}"
                                data-action="delete"
                                title="Delete"
                            >
                                <i class="fa-solid fa-trash"></i>
                            </button>

                        </td>

                    </tr>
                `;

            })
            .join("");
}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDate(dateString) {

    if (!dateString) {
        return "-";
    }

    const date =
        new Date(
            `${dateString}T00:00:00`
        );

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


/* =========================================================
   REFRESH TRANSACTION LIST
   ========================================================= */

async function refreshList() {

    try {

        const items =
            await fetchJSON(
                apiUrl("/expenses")
            );

        cachedAllExpenses =
            Array.isArray(items)
                ? items
                : [];

        cacheSet(
            "expenses",
            cachedAllExpenses
        );

        populateFilter(
            cachedAllExpenses
        );

        applyFilters();

        drawChartUsingSelection(
            cacheGet(
                "summary",
                { byCategory: [] }
            ).byCategory || [],
            cachedAllExpenses
        );

    } catch (error) {

        console.warn(
            "Expense request failed:",
            error
        );

        const cached =
            cacheGet(
                "expenses",
                []
            );

        cachedAllExpenses =
            Array.isArray(cached)
                ? cached
                : [];

        populateFilter(
            cachedAllExpenses
        );

        applyFilters();
    }
}


/* =========================================================
   TIME SERIES
   ========================================================= */

function buildTimeSeries(entries) {

    const map =
        new Map();

    for (const entry of entries) {

        const yearMonth =
            String(entry.date || "")
                .slice(0, 7);

        if (!yearMonth) {
            continue;
        }

        if (!map.has(yearMonth)) {

            map.set(
                yearMonth,
                {
                    income: 0,
                    expense: 0
                }
            );
        }

        const record =
            map.get(yearMonth);

        const amount =
            Number(entry.amount) || 0;

        if (entry.type === "income") {

            record.income += amount;

        } else {

            record.expense += amount;
        }
    }

    const labels =
        Array.from(map.keys()).sort();

    const incomes =
        labels.map(
            label =>
                map.get(label).income
        );

    const expenses =
        labels.map(
            label =>
                map.get(label).expense
        );

    const net =
        labels.map(
            (_, index) =>
                incomes[index] -
                expenses[index]
        );

    const formattedLabels =
        labels.map(label => {

            const [year, month] =
                label.split("-");

            const date =
                new Date(
                    Number(year),
                    Number(month) - 1
                );

            return date.toLocaleDateString(
                "en-IN",
                {
                    month: "short",
                    year: "numeric"
                }
            );
        });

    return {
        labels: formattedLabels,
        incomes,
        expenses,
        net
    };
}


/* =========================================================
   CHART COLORS
   ========================================================= */

function generateChartColors(count) {

    const colors = [
        "#635bff",
        "#8b5cf6",
        "#3b82f6",
        "#06b6d4",
        "#10b981",
        "#22c55e",
        "#eab308",
        "#f59e0b",
        "#f97316",
        "#ef4444",
        "#ec4899",
        "#14b8a6"
    ];

    return Array.from(
        { length: count },
        (_, index) =>
            colors[index % colors.length]
    );
}


/* =========================================================
   CHART DEFAULTS
   ========================================================= */

function getChartOptions() {

    return {

        responsive: true,

        maintainAspectRatio: false,

        interaction: {
            intersect: false,
            mode: "index"
        },

        plugins: {

            legend: {
                position: "bottom",

                labels: {
                    usePointStyle: true,

                    padding: 18,

                    font: {
                        size: 10
                    }
                }
            },

            tooltip: {

                padding: 10,

                cornerRadius: 10,

                callbacks: {

                    label(context) {

                        const value =
                            Number(
                                context.raw || 0
                            );

                        return ` ${toCurrency(
                            value
                        )}`;
                    }
                }
            }
        }
    };
}


/* =========================================================
   CATEGORY CHART
   ========================================================= */

function drawCategoryChart(
    byCategory
) {

    const canvas =
        document.getElementById(
            "categoryChart"
        );

    if (!canvas) return;

    const labels =
        byCategory.map(
            item =>
                item.category
        );

    const values =
        byCategory.map(
            item =>
                Number(item.total) || 0
        );

    if (chartRef) {

        chartRef.destroy();

        chartRef = null;
    }

    if (!labels.length) {

        return;
    }

    const selectedType =
        els.vizType?.value ||
        "doughnut";

    const colors =
        generateChartColors(
            labels.length
        );

    const options =
        getChartOptions();

    if (
        selectedType === "line"
    ) {

        options.scales = {

            y: {

                beginAtZero: true,

                ticks: {

                    callback(value) {
                        return toCurrency(value);
                    }
                }
            }
        };
    }

    chartRef =
        new Chart(
            canvas,
            {
                type: selectedType,

                data: {

                    labels,

                    datasets: [

                        {
                            label:
                                "Expenses",

                            data:
                                values,

                            backgroundColor:
                                colors,

                            borderColor:
                                selectedType ===
                                "line"
                                    ? colors[0]
                                    : colors,

                            borderWidth: 2,

                            borderRadius:
                                selectedType ===
                                "bar"
                                    ? 7
                                    : 0,

                            tension: 0.35,

                            fill:
                                selectedType ===
                                "line"
                                    ? false
                                    : undefined
                        }
                    ]
                },

                options
            }
        );
}


/* =========================================================
   TIME SERIES CHART
   ========================================================= */

function drawChartTimeSeries(
    expenses,
    mode
) {

    const canvas =
        document.getElementById(
            "categoryChart"
        );

    if (!canvas) return;

    const {
        labels,
        incomes,
        expenses: expenseValues,
        net
    } =
        buildTimeSeries(
            expenses
        );

    if (chartRef) {

        chartRef.destroy();

        chartRef = null;
    }

    if (!labels.length) {
        return;
    }

    let datasets = [];

    if (
        mode === "typeOverTime"
    ) {

        datasets = [

            {
                label:
                    "Income",

                data:
                    incomes,

                borderColor:
                    "#16a34a",

                backgroundColor:
                    "rgba(22,163,74,0.12)",

                pointBackgroundColor:
                    "#16a34a",

                borderWidth: 3,

                tension: 0.35,

                fill: false
            },

            {
                label:
                    "Expense",

                data:
                    expenseValues,

                borderColor:
                    "#ef4444",

                backgroundColor:
                    "rgba(239,68,68,0.12)",

                pointBackgroundColor:
                    "#ef4444",

                borderWidth: 3,

                tension: 0.35,

                fill: false
            }

        ];

    } else {

        datasets = [

            {
                label:
                    "Net Balance",

                data:
                    net,

                borderColor:
                    "#635bff",

                backgroundColor:
                    "rgba(99,91,255,0.12)",

                pointBackgroundColor:
                    "#635bff",

                borderWidth: 3,

                tension: 0.35,

                fill: true
            }

        ];
    }

    const options =
        getChartOptions();

    options.scales = {

        y: {

            beginAtZero: true,

            ticks: {

                callback(value) {

                    return toCurrency(
                        value
                    );
                }
            }
        },

        x: {

            grid: {
                display: false
            }
        }
    };

    chartRef =
        new Chart(
            canvas,
            {
                type:
                    els.vizType?.value ||
                    "line",

                data: {

                    labels,

                    datasets
                },

                options
            }
        );
}


/* =========================================================
   CHART SELECTION
   ========================================================= */

function drawChartUsingSelection(
    byCategory,
    expenses
) {

    const dataset =
        els.vizDataset?.value ||
        "byCategory";

    if (
        dataset ===
        "typeOverTime"
    ) {

        drawChartTimeSeries(
            expenses,
            "typeOverTime"
        );

        return;
    }

    if (
        dataset ===
        "netOverTime"
    ) {

        drawChartTimeSeries(
            expenses,
            "netOverTime"
        );

        return;
    }

    drawCategoryChart(
        byCategory
    );
}


/* =========================================================
   FORM SUBMISSION
   ========================================================= */

async function onSubmit(event) {

    event.preventDefault();

    if (!validateForm()) {
        return;
    }

    const payload = {

        title:
            els.title.value.trim(),

        amount:
            parseFloat(
                els.amount.value
            ),

        date:
            els.date.value,

        category:
            els.category.value.trim(),

        type:
            els.type.value
    };

    setLoading(true);

    try {

        if (els.id.value) {

            await fetchJSON(
                apiUrl(
                    `/expenses/${els.id.value}`
                ),
                {
                    method: "PUT",

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );

            showToast(
                "Transaction updated successfully."
            );

        } else {

            await fetchJSON(
                apiUrl("/expenses"),
                {
                    method: "POST",

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );

            showToast(
                "Transaction added successfully."
            );
        }

        setForm({});

        await Promise.all([
            refreshList(),
            refreshSummary()
        ]);

        document
            .getElementById("transactions")
            ?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

    } catch (error) {

        console.error(
            "Save error:",
            error
        );

        showToast(
            `Save failed: ${error.message}`,
            "error"
        );

    } finally {

        setLoading(false);
    }
}


/* =========================================================
   TABLE ACTIONS
   ========================================================= */

function onTableClick(event) {

    const button =
        event.target.closest(
            "button[data-action]"
        );

    if (!button) {
        return;
    }

    const id =
        button.getAttribute(
            "data-id"
        );

    const action =
        button.getAttribute(
            "data-action"
        );

    if (action === "edit") {

        editTransaction(id);

        return;
    }

    if (action === "delete") {

        deleteTransaction(id);
    }
}


/* =========================================================
   EDIT TRANSACTION
   ========================================================= */

function editTransaction(id) {

    const item =
        cachedAllExpenses.find(
            expense =>
                String(expense.id) ===
                String(id)
        );

    if (!item) {

        showToast(
            "Transaction not found.",
            "error"
        );

        return;
    }

    setForm(item);

    document
        .getElementById("add-entry")
        ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    setTimeout(() => {

        els.title?.focus();

    }, 500);

    showToast(
        "Transaction loaded for editing.",
        "warning"
    );
}


/* =========================================================
   DELETE TRANSACTION
   ========================================================= */

async function deleteTransaction(id) {

    const item =
        cachedAllExpenses.find(
            expense =>
                String(expense.id) ===
                String(id)
        );

    const title =
        item?.title ||
        "this transaction";

    const confirmed =
        window.confirm(
            `Delete "${title}"? This action cannot be undone.`
        );

    if (!confirmed) {
        return;
    }

    try {

        await fetchJSON(
            apiUrl(
                `/expenses/${id}`
            ),
            {
                method: "DELETE"
            }
        );

        showToast(
            "Transaction deleted."
        );

        await Promise.all([
            refreshList(),
            refreshSummary()
        ]);

    } catch (error) {

        console.error(
            "Delete error:",
            error
        );

        showToast(
            `Delete failed: ${error.message}`,
            "error"
        );
    }
}


/* =========================================================
   RESET FORM
   ========================================================= */

function resetForm() {

    setForm({});

    if (els.form) {

        els.form
            .querySelectorAll(
                "input:not([type='hidden'])"
            )
            .forEach(input => {

                if (
                    input.id !== "date"
                ) {
                    input.value = "";
                }
            });
    }

    els.date.value =
        new Date()
            .toISOString()
            .slice(0, 10);

    els.type.value =
        "expense";

    updateFormMode();
}


/* =========================================================
   THEME
   ========================================================= */

function initializeTheme() {

    const savedTheme =
        localStorage.getItem(
            "vh-theme"
        );

    if (
        savedTheme === "dark"
    ) {

        document.body
            .classList.add(
                "dark-mode"
            );
    }

    updateThemeIcon();
}


function toggleTheme() {

    document.body
        .classList.toggle(
            "dark-mode"
        );

    const dark =
        document.body.classList.contains(
            "dark-mode"
        );

    localStorage.setItem(
        "vh-theme",
        dark
            ? "dark"
            : "light"
    );

    updateThemeIcon();

    showToast(
        dark
            ? "Dark mode enabled."
            : "Light mode enabled."
    );
}


function updateThemeIcon() {

    if (!els.themeToggle) {
        return;
    }

    const icon =
        els.themeToggle.querySelector(
            "i"
        );

    if (!icon) {
        return;
    }

    const dark =
        document.body.classList.contains(
            "dark-mode"
        );

    icon.className =
        dark
            ? "fa-solid fa-sun"
            : "fa-solid fa-moon";
}


/* =========================================================
   MOBILE SIDEBAR
   ========================================================= */

function openSidebar() {

    els.sidebar?.classList.add(
        "open"
    );

    els.sidebarOverlay?.classList.add(
        "active"
    );

    document.body.style.overflow =
        "hidden";
}


function closeSidebar() {

    els.sidebar?.classList.remove(
        "open"
    );

    els.sidebarOverlay?.classList.remove(
        "active"
    );

    document.body.style.overflow =
        "";
}


function toggleSidebar() {

    if (
        els.sidebar?.classList.contains(
            "open"
        )
    ) {

        closeSidebar();

    } else {

        openSidebar();
    }
}


/* =========================================================
   SIDEBAR NAVIGATION
   ========================================================= */

function initializeNavigation() {

    const navItems =
        document.querySelectorAll(
            ".nav-item"
        );

    navItems.forEach(item => {

        item.addEventListener(
            "click",
            () => {

                navItems.forEach(
                    nav =>
                        nav.classList.remove(
                            "active"
                        )
                );

                item.classList.add(
                    "active"
                );

                closeSidebar();
            }
        );
    });
}


/* =========================================================
   SEARCH EVENTS
   ========================================================= */

function initializeFilters() {

    els.search?.addEventListener(
        "input",
        applyFilters
    );

    els.filterCategory?.addEventListener(
        "change",
        applyFilters
    );

    els.filterType?.addEventListener(
        "change",
        applyFilters
    );
}


/* =========================================================
   CHART EVENTS
   ========================================================= */

function initializeCharts() {

    els.vizDataset?.addEventListener(
        "change",
        () => {

            const summary =
                cacheGet(
                    "summary",
                    {
                        byCategory: []
                    }
                );

            drawChartUsingSelection(
                summary.byCategory ||
                    [],
                cachedAllExpenses
            );
        }
    );


    els.vizType?.addEventListener(
        "change",
        () => {

            const summary =
                cacheGet(
                    "summary",
                    {
                        byCategory: []
                    }
                );

            drawChartUsingSelection(
                summary.byCategory ||
                    [],
                cachedAllExpenses
            );
        }
    );
}


/* =========================================================
   TYPE UI
   ========================================================= */

function initializeTypeSelector() {

    els.type?.addEventListener(
        "change",
        () => {

            const isIncome =
                els.type.value ===
                "income";

            const amountIcon =
                document.querySelector(
                    "#amount"
                )?.previousElementSibling;

            if (amountIcon) {

                amountIcon.style.color =
                    isIncome
                        ? "var(--success)"
                        : "var(--danger)";
            }
        }
    );
}


/* =========================================================
   KEYBOARD SHORTCUTS
   ========================================================= */

function initializeKeyboardShortcuts() {

    document.addEventListener(
        "keydown",
        event => {

            /* CTRL + K = Search */

            if (
                event.ctrlKey &&
                event.key.toLowerCase() ===
                    "k"
            ) {

                event.preventDefault();

                els.search?.focus();
            }


            /* ESC = Close mobile menu */

            if (
                event.key ===
                "Escape"
            ) {

                closeSidebar();
            }
        }
    );
}


/* =========================================================
   CACHE WARM START
   ========================================================= */

function loadCachedData() {

    const expenses =
        cacheGet(
            "expenses",
            []
        );

    cachedAllExpenses =
        Array.isArray(expenses)
            ? expenses
            : [];

    populateFilter(
        cachedAllExpenses
    );

    applyFilters();


    const summary =
        cacheGet(
            "summary",
            {
                income: 0,
                expense: 0,
                balance: 0,
                byCategory: []
            }
        );

    updateSummaryUI(
        summary
    );

    drawChartUsingSelection(
        summary.byCategory || [],
        cachedAllExpenses
    );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function init() {

    console.log(
        "VH Expense Tracker initialized."
    );

    initializeTheme();

    initializeNavigation();

    initializeFilters();

    initializeCharts();

    initializeTypeSelector();

    initializeKeyboardShortcuts();

    loadCachedData();


    /* FORM */

    els.form?.addEventListener(
        "submit",
        onSubmit
    );


    els.resetBtn?.addEventListener(
        "click",
        resetForm
    );


    /* TABLE */

    els.tbody?.addEventListener(
        "click",
        onTableClick
    );


    /* THEME */

    els.themeToggle?.addEventListener(
        "click",
        toggleTheme
    );


    /* MOBILE MENU */

    els.mobileMenuBtn?.addEventListener(
        "click",
        toggleSidebar
    );


    els.sidebarOverlay?.addEventListener(
        "click",
        closeSidebar
    );


    /* CLOSE SIDEBAR WHEN NAVIGATING */

    document
        .querySelectorAll(
            ".sidebar a"
        )
        .forEach(link => {

            link.addEventListener(
                "click",
                closeSidebar
            );
        });


    /* DEFAULT FORM */

    setForm({});


    /* FRESH DATA */

    await Promise.all([
        refreshList(),
        refreshSummary()
    ]);

}


/* =========================================================
   START APP
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    init
);
```
