// Gold Candle Analysis Dashboard - Weekly Analysis Page
// Version 3.0

let currentPage = 1;
const itemsPerPage = 20;
let filteredWeeklyData = [];
let allWeeklyData = {};
let sortKey = 'key';
let sortAsc = false;

// ============================================
// Summary Stats
// ============================================

function updateSummaryStats(womStats) {
    let totalWeeks = 0;
    let totalBullishPct = 0;
    let totalBearishPct = 0;
    let totalChange = 0;

    Object.values(womStats.stats).forEach(stat => {
        totalWeeks += stat.weeks;
        totalBullishPct += stat.bullishPct;
        totalBearishPct += stat.bearishPct;
        totalChange += stat.avgChange;
    });

    const avgBullish = totalBullishPct / 4;
    const avgBearish = totalBearishPct / 4;
    const avgChange = totalChange / 4;

    document.getElementById('statTotalWeeks').textContent = totalWeeks.toLocaleString();
    document.getElementById('statAvgBullish').textContent = avgBullish.toFixed(1) + '%';
    document.getElementById('statAvgBearish').textContent = avgBearish.toFixed(1) + '%';
    document.getElementById('statAvgChange').textContent = (avgChange >= 0 ? '+' : '') + '$' + avgChange.toFixed(2);
}

// ============================================
// Week of Month Cards
// ============================================

function createWeekOfMonthCards(womStats) {
    const grid = document.getElementById('womGrid');
    grid.innerHTML = '';

    for (let week = 1; week <= 4; week++) {
        const stat = womStats.stats[week];
        const isBest = week === womStats.bestWeek;
        const isWorst = week === womStats.worstWeek;

        const card = document.createElement('div');
        card.className = `wom-card ${isBest ? 'best' : ''} ${isWorst ? 'worst' : ''}`;

        const changeClass = stat.avgChange >= 0 ? 'positive' : 'negative';
        const changeSign = stat.avgChange >= 0 ? '+' : '';

        card.innerHTML = `
            <div class="wom-name">${stat.name}${isBest ? ' (Best)' : ''}${isWorst ? ' (Worst)' : ''}</div>
            <div class="wom-period">${stat.period}</div>
            <div class="wom-stats">
                <div class="wom-bull">
                    <span>Bullish</span>
                    <span>${stat.bullishPct.toFixed(1)}%</span>
                </div>
                <div class="wom-bear">
                    <span>Bearish</span>
                    <span>${stat.bearishPct.toFixed(1)}%</span>
                </div>
            </div>
            <div class="wom-count">${stat.total.toLocaleString()} trading days</div>
            <div class="wom-change ${changeClass}">Avg Change: ${changeSign}$${Math.abs(stat.avgChange).toFixed(2)}</div>
        `;

        grid.appendChild(card);
    }

    // Update best/worst cards
    const best = womStats.stats[womStats.bestWeek];
    const worst = womStats.stats[womStats.worstWeek];

    document.getElementById('bestWeekName').textContent = best.name;
    document.getElementById('bestWeekStats').textContent =
        `${best.bullishPct.toFixed(1)}% Bullish | Avg Change: +$${Math.abs(best.avgChange).toFixed(2)}`;

    document.getElementById('worstWeekName').textContent = worst.name;
    document.getElementById('worstWeekStats').textContent =
        `${worst.bullishPct.toFixed(1)}% Bullish | Avg Change: -$${Math.abs(worst.avgChange).toFixed(2)}`;
}

// ============================================
// Weekly Performance Chart
// ============================================

function createWeeklyChart(weeklyData, year) {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    if (charts.weekly) charts.weekly.destroy();

    // Filter data for selected year
    const filtered = Object.entries(weeklyData)
        .filter(([key, val]) => val.year === year)
        .sort((a, b) => a[1].week - b[1].week);

    const labels = filtered.map(([key, val]) => `W${val.week}`);
    const changes = filtered.map(([key, val]) => val.change);
    const colors = changes.map(c => c >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)');

    charts.weekly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Weekly Net Change ($)',
                data: changes,
                backgroundColor: colors,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { callback: v => '$' + v.toFixed(0) }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// ============================================
// Data Table
// ============================================

function prepareWeeklyTableData(weeklyData) {
    return Object.entries(weeklyData).map(([key, val]) => ({
        key,
        year: val.year,
        week: val.week,
        startDate: val.startDate,
        endDate: val.endDate,
        bullish: val.bullish,
        bearish: val.bearish,
        total: val.total,
        winRate: val.winRate,
        range: val.range,
        change: val.change,
        isPositive: val.isPositive
    }));
}

function filterWeeklyTableData(data, yearFilter) {
    if (!yearFilter) return data;
    return data.filter(row => row.year === parseInt(yearFilter));
}

function sortWeeklyTableData(data) {
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

function renderWeeklyTable() {
    const sorted = sortWeeklyTableData(filteredWeeklyData);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = sorted.slice(start, end);

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    pageData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.year} W${row.week}</td>
            <td>${formatDate(row.startDate)} - ${formatDate(row.endDate)}</td>
            <td class="bullish">${row.bullish} days</td>
            <td class="bearish">${row.bearish} days</td>
            <td>${row.winRate.toFixed(1)}%</td>
            <td>$${row.range.toFixed(2)}</td>
            <td class="${row.isPositive ? 'positive' : 'negative'}">${row.isPositive ? '+' : ''}$${row.change.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });

    renderPagination();
}

function renderPagination() {
    const container = document.getElementById('paginationContainer');
    container.innerHTML = '';

    const pagination = createPagination(filteredWeeklyData.length, currentPage, itemsPerPage, (page) => {
        currentPage = page;
        renderWeeklyTable();
    });

    container.appendChild(pagination);
}

function populateYearFilters(data) {
    const years = getAvailableYears(data);

    // Chart year filter
    const chartSelect = document.getElementById('chartYear');
    years.forEach((year, i) => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (i === 0) option.selected = true;
        chartSelect.appendChild(option);
    });

    // Table year filter
    const tableSelect = document.getElementById('filterYear');
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        tableSelect.appendChild(option);
    });
}

// ============================================
// Event Handlers
// ============================================

function setupEventHandlers(tableData) {
    // Chart year change
    document.getElementById('chartYear').addEventListener('change', (e) => {
        createWeeklyChart(allWeeklyData, parseInt(e.target.value));
    });

    // Table filter
    document.getElementById('filterYear').addEventListener('change', (e) => {
        currentPage = 1;
        filteredWeeklyData = filterWeeklyTableData(tableData, e.target.value);
        renderWeeklyTable();
    });

    // Export
    document.getElementById('exportBtn').addEventListener('click', () => {
        const exportData = filteredWeeklyData.map(row => ({
            Week: `${row.year} W${row.week}`,
            Start: row.startDate,
            End: row.endDate,
            'Bull Days': row.bullish,
            'Bear Days': row.bearish,
            'Win Rate': row.winRate.toFixed(1) + '%',
            Range: row.range.toFixed(2),
            'Net Change': row.change.toFixed(2)
        }));
        exportToCSV(exportData, 'weekly_data.csv');
    });

    // Table sorting
    initTableSort('weeklyTable');
    document.getElementById('weeklyTable').addEventListener('tableSort', (e) => {
        sortKey = e.detail.key;
        sortAsc = e.detail.ascending;
        renderWeeklyTable();
    });
}

// ============================================
// Initialize
// ============================================

async function init() {
    try {
        rawData = await loadData();
        console.log('Weekly page - Data loaded:', rawData.length, 'rows');

        // Calculate week of month stats
        const womStats = calculateWeekOfMonthStats(rawData);

        // Calculate weekly performance
        allWeeklyData = calculateWeeklyPerformance(rawData);

        // Update UI
        updateSummaryStats(womStats);
        createWeekOfMonthCards(womStats);

        // Populate year filters
        populateYearFilters(rawData);

        // Create chart with latest year
        const years = getAvailableYears(rawData);
        createWeeklyChart(allWeeklyData, years[0]);

        // Prepare table data
        const tableData = prepareWeeklyTableData(allWeeklyData);
        filteredWeeklyData = [...tableData];

        // Setup event handlers
        setupEventHandlers(tableData);

        // Initial render
        renderWeeklyTable();

        hideLoading();
        showContent();
        initSidebar();

        // Initialize market selector with refresh callback
        initMarketSelector(async (newData) => {
            rawData = newData;
            const womStats = calculateWeekOfMonthStats(rawData);
            allWeeklyData = calculateWeeklyPerformance(rawData);

            updateSummaryStats(womStats);
            createWeekOfMonthCards(womStats);

            // Update year filters
            const chartSelect = document.getElementById('chartYear');
            const tableSelect = document.getElementById('filterYear');
            chartSelect.innerHTML = '';
            tableSelect.innerHTML = '<option value="">All Years</option>';
            populateYearFilters(rawData);

            // Refresh chart with latest year
            const years = getAvailableYears(rawData);
            createWeeklyChart(allWeeklyData, years[0]);

            // Refresh table
            const newTableData = prepareWeeklyTableData(allWeeklyData);
            filteredWeeklyData = [...newTableData];
            setupEventHandlers(newTableData);
            currentPage = 1;
            renderWeeklyTable();
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
