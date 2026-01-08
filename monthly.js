// Gold Candle Analysis Dashboard - Monthly Report Page
// Version 3.0

let currentPage = 1;
const itemsPerPage = 24;
let filteredMonthlyData = [];
let allMonthlyData = {};
let sortKey = 'key';
let sortAsc = false;

// ============================================
// Summary Stats
// ============================================

function updateSummaryStats(monthlyData) {
    const months = Object.values(monthlyData);
    const totalMonths = months.length;
    const positiveMonths = months.filter(m => m.isPositive).length;
    const negativeMonths = totalMonths - positiveMonths;
    const avgChange = months.reduce((sum, m) => sum + m.changePct, 0) / totalMonths;

    document.getElementById('statTotalMonths').textContent = totalMonths.toLocaleString();
    document.getElementById('statPositiveMonths').textContent = positiveMonths + ` (${(positiveMonths/totalMonths*100).toFixed(1)}%)`;
    document.getElementById('statNegativeMonths').textContent = negativeMonths + ` (${(negativeMonths/totalMonths*100).toFixed(1)}%)`;
    document.getElementById('statAvgMonthlyChange').textContent = (avgChange >= 0 ? '+' : '') + avgChange.toFixed(2) + '%';
}

// ============================================
// Seasonal Pattern Bars
// ============================================

function createSeasonalBars(seasonalData) {
    const container = document.getElementById('seasonalBars');
    container.innerHTML = '';

    // Find max for scaling
    const maxAbs = Math.max(...Object.values(seasonalData.seasonal).map(s => Math.abs(s.avgChange)));

    Object.values(seasonalData.seasonal).forEach((stat, i) => {
        const isPositive = stat.avgChange >= 0;
        const isBest = i === seasonalData.bestMonth;
        const isWorst = i === seasonalData.worstMonth;
        const barWidth = Math.abs(stat.avgChange) / maxAbs * 100;

        const bar = document.createElement('div');
        bar.className = 'seasonal-bar';

        bar.innerHTML = `
            <div class="seasonal-month">${stat.monthName}</div>
            <div class="seasonal-change ${isPositive ? 'positive' : 'negative'}">${isPositive ? '+' : ''}${stat.avgChange.toFixed(2)}%</div>
            <div class="seasonal-bar-container">
                <div class="seasonal-bar-fill ${isPositive ? 'positive' : 'negative'}" style="width: ${barWidth}%"></div>
            </div>
            <div class="seasonal-rate">${stat.positiveRate.toFixed(0)}% positive (${stat.positiveYears}/${stat.totalYears})</div>
            ${isBest ? '<span class="seasonal-badge best">BEST</span>' : ''}
            ${isWorst ? '<span class="seasonal-badge worst">WORST</span>' : ''}
        `;

        container.appendChild(bar);
    });

    // Update best/worst cards
    const best = seasonalData.seasonal[seasonalData.bestMonth];
    const worst = seasonalData.seasonal[seasonalData.worstMonth];

    document.getElementById('bestMonthName').textContent = MONTH_NAMES[seasonalData.bestMonth];
    document.getElementById('bestMonthStats').textContent =
        `Avg: +${best.avgChange.toFixed(2)}% | ${best.positiveRate.toFixed(0)}% positive years`;

    document.getElementById('worstMonthName').textContent = MONTH_NAMES[seasonalData.worstMonth];
    document.getElementById('worstMonthStats').textContent =
        `Avg: ${worst.avgChange.toFixed(2)}% | ${worst.positiveRate.toFixed(0)}% positive years`;
}

// ============================================
// Heatmap
// ============================================

function createHeatmap(monthlyData) {
    const table = document.getElementById('heatmapTable');

    // Group by year
    const byYear = {};
    Object.values(monthlyData).forEach(m => {
        if (!byYear[m.year]) byYear[m.year] = {};
        byYear[m.year][m.month] = m;
    });

    const years = Object.keys(byYear).sort((a, b) => b - a);

    // Create header
    let html = '<thead><tr><th>Year</th>';
    MONTH_NAMES_SHORT.forEach(m => {
        html += `<th>${m}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Create rows
    years.forEach(year => {
        html += `<tr><td class="year-cell">${year}</td>`;
        for (let month = 0; month < 12; month++) {
            const m = byYear[year][month];
            if (m) {
                const colorClass = m.isPositive ? 'positive' : 'negative';
                const sign = m.isPositive ? '+' : '';
                html += `<td><div class="heatmap-cell ${colorClass}" title="${MONTH_NAMES[month]} ${year}: ${sign}${m.changePct.toFixed(1)}%">${sign}${m.changePct.toFixed(1)}%</div></td>`;
            } else {
                html += '<td>-</td>';
            }
        }
        html += '</tr>';
    });

    html += '</tbody>';
    table.innerHTML = html;
}

// ============================================
// Data Table
// ============================================

function prepareMonthlyTableData(monthlyData) {
    return Object.entries(monthlyData).map(([key, val]) => ({
        key,
        year: val.year,
        month: val.month,
        monthName: val.monthName,
        openPrice: val.openPrice,
        closePrice: val.closePrice,
        change: val.change,
        changePct: val.changePct,
        range: val.range,
        bullish: val.bullish,
        bearish: val.bearish,
        total: val.total,
        isPositive: val.isPositive
    }));
}

function filterMonthlyTableData(data, yearFilter) {
    if (!yearFilter) return data;
    return data.filter(row => row.year === parseInt(yearFilter));
}

function sortMonthlyTableData(data) {
    return [...data].sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
    });
}

function renderMonthlyTable() {
    const sorted = sortMonthlyTableData(filteredMonthlyData);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = sorted.slice(start, end);

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    pageData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.monthName} ${row.year}</td>
            <td>$${row.openPrice.toFixed(2)}</td>
            <td>$${row.closePrice.toFixed(2)}</td>
            <td class="${row.isPositive ? 'positive' : 'negative'}">${row.isPositive ? '+' : ''}$${row.change.toFixed(2)}</td>
            <td class="${row.isPositive ? 'positive' : 'negative'}">${row.isPositive ? '+' : ''}${row.changePct.toFixed(2)}%</td>
            <td>$${row.range.toFixed(2)}</td>
            <td class="bullish">${row.bullish}</td>
            <td class="bearish">${row.bearish}</td>
        `;
        tbody.appendChild(tr);
    });

    renderPagination();
}

function renderPagination() {
    const container = document.getElementById('paginationContainer');
    container.innerHTML = '';

    const pagination = createPagination(filteredMonthlyData.length, currentPage, itemsPerPage, (page) => {
        currentPage = page;
        renderMonthlyTable();
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
    // Filter
    document.getElementById('filterYear').addEventListener('change', (e) => {
        currentPage = 1;
        filteredMonthlyData = filterMonthlyTableData(tableData, e.target.value);
        renderMonthlyTable();
    });

    // Export
    document.getElementById('exportBtn').addEventListener('click', () => {
        const exportData = filteredMonthlyData.map(row => ({
            Month: `${row.monthName} ${row.year}`,
            Open: row.openPrice.toFixed(2),
            Close: row.closePrice.toFixed(2),
            'Change ($)': row.change.toFixed(2),
            'Change (%)': row.changePct.toFixed(2),
            Range: row.range.toFixed(2),
            'Bull Days': row.bullish,
            'Bear Days': row.bearish
        }));
        exportToCSV(exportData, 'monthly_data.csv');
    });

    // Table sorting
    initTableSort('monthlyTable');
    document.getElementById('monthlyTable').addEventListener('tableSort', (e) => {
        sortKey = e.detail.key;
        sortAsc = e.detail.ascending;
        renderMonthlyTable();
    });
}

// ============================================
// Initialize
// ============================================

async function init() {
    try {
        rawData = await loadData();
        console.log('Monthly page - Data loaded:', rawData.length, 'rows');

        // Calculate monthly stats
        allMonthlyData = calculateMonthlyStats(rawData);
        const seasonalData = calculateSeasonalPattern(rawData);

        // Update UI
        updateSummaryStats(allMonthlyData);
        createSeasonalBars(seasonalData);
        createHeatmap(allMonthlyData);

        // Populate year filter
        populateYearFilter(rawData);

        // Prepare table data
        const tableData = prepareMonthlyTableData(allMonthlyData);
        filteredMonthlyData = [...tableData];

        // Setup event handlers
        setupEventHandlers(tableData);

        // Initial render
        renderMonthlyTable();

        hideLoading();
        showContent();
        initSidebar();

        // Initialize market selector with refresh callback
        initMarketSelector(async (newData) => {
            rawData = newData;
            allMonthlyData = calculateMonthlyStats(rawData);
            const seasonalData = calculateSeasonalPattern(rawData);

            updateSummaryStats(allMonthlyData);
            createSeasonalBars(seasonalData);
            createHeatmap(allMonthlyData);

            // Update year filter
            const yearSelect = document.getElementById('filterYear');
            yearSelect.innerHTML = '<option value="">All Years</option>';
            populateYearFilter(rawData);

            // Refresh table
            const newTableData = prepareMonthlyTableData(allMonthlyData);
            filteredMonthlyData = [...newTableData];
            setupEventHandlers(newTableData);
            currentPage = 1;
            renderMonthlyTable();
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
