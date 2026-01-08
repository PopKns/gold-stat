// Gold Candle Analysis Dashboard - Daily Analysis Page
// Version 3.0

let currentPage = 1;
const itemsPerPage = 50;
let filteredData = [];
let sortKey = 'datetime';
let sortAsc = false;

// ============================================
// Summary Stats
// ============================================

function updateSummaryStats(data) {
    const totalDays = data.length;
    let bullish = 0, bearish = 0, totalRange = 0;

    data.forEach(row => {
        if (isBullish(row.candle_type)) bullish++;
        else bearish++;
        totalRange += calculateDailyRange(row);
    });

    document.getElementById('statTotalDays').textContent = totalDays.toLocaleString();
    document.getElementById('statBullishDays').textContent = bullish.toLocaleString() + ` (${(bullish/totalDays*100).toFixed(1)}%)`;
    document.getElementById('statBearishDays').textContent = bearish.toLocaleString() + ` (${(bearish/totalDays*100).toFixed(1)}%)`;
    document.getElementById('statAvgRange').textContent = '$' + (totalRange / totalDays).toFixed(2);
}

// ============================================
// Day of Week Cards
// ============================================

function createDayOfWeekCards(dowStats) {
    const grid = document.getElementById('dowGrid');
    grid.innerHTML = '';

    // Days 1-5 (Monday-Friday)
    for (let day = 1; day <= 5; day++) {
        const stat = dowStats.stats[day];
        const isBest = day === dowStats.bestDay;
        const isWorst = day === dowStats.worstDay;

        const card = document.createElement('div');
        card.className = `dow-card ${isBest ? 'best' : ''} ${isWorst ? 'worst' : ''}`;

        card.innerHTML = `
            <div class="dow-name">${stat.name}${isBest ? ' (Best)' : ''}${isWorst ? ' (Worst)' : ''}</div>
            <div class="dow-stats">
                <div class="dow-bull">
                    <span>Bullish</span>
                    <span>${stat.bullishPct.toFixed(1)}%</span>
                </div>
                <div class="dow-bear">
                    <span>Bearish</span>
                    <span>${stat.bearishPct.toFixed(1)}%</span>
                </div>
            </div>
            <div class="dow-count">${stat.total.toLocaleString()} trading days</div>
            <div class="dow-range">Avg Range: $${stat.avgRange.toFixed(2)}</div>
        `;

        grid.appendChild(card);
    }

    // Update best/worst cards
    const best = dowStats.stats[dowStats.bestDay];
    const worst = dowStats.stats[dowStats.worstDay];

    document.getElementById('bestDayName').textContent = best.name;
    document.getElementById('bestDayStats').textContent =
        `${best.bullishPct.toFixed(1)}% Bullish | Avg Range: $${best.avgRange.toFixed(2)} | ${best.total} days`;

    document.getElementById('worstDayName').textContent = worst.name;
    document.getElementById('worstDayStats').textContent =
        `${worst.bullishPct.toFixed(1)}% Bullish | Avg Range: $${worst.avgRange.toFixed(2)} | ${worst.total} days`;
}

// ============================================
// Data Table
// ============================================

function prepareTableData(data) {
    return data.map(row => {
        const dow = getDayOfWeek(row.datetime);
        const change = row.close - row.open;
        const range = row.high - row.low;
        const bullish = isBullish(row.candle_type);

        return {
            datetime: row.datetime,
            day: dow,
            dayName: DAY_NAMES_SHORT[dow],
            open: row.open,
            high: row.high,
            low: row.low,
            close: row.close,
            change: change,
            range: range,
            candle_type: row.candle_type,
            typeName: CANDLE_TYPES[row.candle_type],
            isBullish: bullish
        };
    });
}

function filterTableData(data) {
    const dayFilter = document.getElementById('filterDay').value;
    const typeFilter = document.getElementById('filterType').value;
    const yearFilter = document.getElementById('filterYear').value;

    return data.filter(row => {
        // Day filter
        if (dayFilter && row.day !== parseInt(dayFilter)) return false;

        // Type filter
        if (typeFilter === 'bullish' && !row.isBullish) return false;
        if (typeFilter === 'bearish' && row.isBullish) return false;

        // Year filter
        if (yearFilter) {
            const rowYear = getYear(row.datetime);
            if (rowYear !== parseInt(yearFilter)) return false;
        }

        return true;
    });
}

function sortTableData(data) {
    return [...data].sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        // Special handling for datetime - parse as Date for correct sorting
        if (sortKey === 'datetime') {
            valA = parseDate(valA).getTime();
            valB = parseDate(valB).getTime();
        } else if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
    });
}

function renderTable() {
    const sorted = sortTableData(filteredData);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = sorted.slice(start, end);

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    pageData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.datetime}</td>
            <td>${row.dayName}</td>
            <td>$${row.open.toFixed(2)}</td>
            <td>$${row.high.toFixed(2)}</td>
            <td>$${row.low.toFixed(2)}</td>
            <td>$${row.close.toFixed(2)}</td>
            <td class="${row.change >= 0 ? 'positive' : 'negative'}">${row.change >= 0 ? '+' : ''}$${row.change.toFixed(2)}</td>
            <td>$${row.range.toFixed(2)}</td>
            <td class="${row.isBullish ? 'bullish' : 'bearish'}">${row.typeName}</td>
        `;
        tbody.appendChild(tr);
    });

    renderPagination();
}

function renderPagination() {
    const container = document.getElementById('paginationContainer');
    container.innerHTML = '';

    const pagination = createPagination(filteredData.length, currentPage, itemsPerPage, (page) => {
        currentPage = page;
        renderTable();
    });

    container.appendChild(pagination);
}

function populateYearFilter(data) {
    const years = getAvailableYears(data);
    const select = document.getElementById('filterYear');

    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
    });
}

// ============================================
// Event Handlers
// ============================================

function setupEventHandlers(tableData) {
    // Filter changes
    ['filterDay', 'filterType', 'filterYear'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            currentPage = 1;
            filteredData = filterTableData(tableData);
            renderTable();
        });
    });

    // Reset filters
    document.getElementById('resetFilters').addEventListener('click', () => {
        document.getElementById('filterDay').value = '';
        document.getElementById('filterType').value = '';
        document.getElementById('filterYear').value = '';
        currentPage = 1;
        filteredData = [...tableData];
        renderTable();
    });

    // Export
    document.getElementById('exportBtn').addEventListener('click', () => {
        const exportData = filteredData.map(row => ({
            Date: row.datetime,
            Day: row.dayName,
            Open: row.open,
            High: row.high,
            Low: row.low,
            Close: row.close,
            Change: row.change,
            Range: row.range,
            Type: row.typeName
        }));
        exportToCSV(exportData, 'daily_data.csv');
    });

    // Table sorting
    initTableSort('dailyTable');
    document.getElementById('dailyTable').addEventListener('tableSort', (e) => {
        sortKey = e.detail.key;
        sortAsc = e.detail.ascending;
        renderTable();
    });
}

// ============================================
// Initialize
// ============================================

async function init() {
    try {
        rawData = await loadData();
        console.log('Daily page - Data loaded:', rawData.length, 'rows');

        // Calculate day of week stats
        const dowStats = calculateDayOfWeekStats(rawData);

        // Update UI
        updateSummaryStats(rawData);
        createDayOfWeekCards(dowStats);

        // Prepare table data
        const tableData = prepareTableData(rawData);
        filteredData = [...tableData];

        // Populate year filter
        populateYearFilter(rawData);

        // Setup event handlers
        setupEventHandlers(tableData);

        // Set initial sort indicator (datetime descending)
        const datetimeHeader = document.querySelector('#dailyTable th[data-sort="datetime"]');
        if (datetimeHeader) {
            datetimeHeader.classList.add('sorted-desc');
        }

        // Initial render
        renderTable();

        hideLoading();
        showContent();
        initSidebar();

        // Initialize market selector with refresh callback
        initMarketSelector(async (newData) => {
            rawData = newData;
            const dowStats = calculateDayOfWeekStats(rawData);
            updateSummaryStats(rawData);
            createDayOfWeekCards(dowStats);

            const newTableData = prepareTableData(rawData);
            filteredData = [...newTableData];
            setupEventHandlers(newTableData);

            // Update year filter
            const yearSelect = document.getElementById('filterYear');
            yearSelect.innerHTML = '<option value="">All Years</option>';
            populateYearFilter(rawData);

            currentPage = 1;
            renderTable();
        });
        updateMarketSelector();

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('loading').innerHTML = `
            <p style="color: var(--neon-red);">Error loading data</p>
            <p style="color: var(--text-muted);">${error.message}</p>
        `;
    }
}

init();
