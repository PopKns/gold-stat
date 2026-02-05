// CME Open Interest - Intraday Volume Chart
// Mock data based on G1MG6 Gold Options

// Strike prices from 4350 to 5150
// Vol Settle forms a "Volatility Smile" - higher at OTM strikes, lower at ATM
const strikeData = [
    { strike: 4350, put: 5, call: 0, vol: 77.5 },    // Far OTM Put - high vol
    { strike: 4400, put: 12, call: 2, vol: 74.8 },
    { strike: 4450, put: 8, call: 1, vol: 71.5 },
    { strike: 4500, put: 60, call: 3, vol: 68.2 },
    { strike: 4550, put: 15, call: 2, vol: 65.8 },
    { strike: 4600, put: 45, call: 5, vol: 64.0 },
    { strike: 4650, put: 38, call: 8, vol: 63.0 },
    { strike: 4700, put: 25, call: 18, vol: 62.5 },  // Near ATM - lowest vol
    { strike: 4716, put: 0, call: 0, vol: 62.3 },    // ATM - lowest point
    { strike: 4750, put: 18, call: 22, vol: 62.5 },
    { strike: 4800, put: 12, call: 60, vol: 63.2 },
    { strike: 4850, put: 8, call: 15, vol: 64.5 },
    { strike: 4900, put: 5, call: 35, vol: 66.0 },
    { strike: 4950, put: 3, call: 18, vol: 68.2 },
    { strike: 5000, put: 2, call: 123, vol: 70.5 },  // Major call wall
    { strike: 5050, put: 1, call: 45, vol: 73.0 },
    { strike: 5100, put: 0, call: 25, vol: 75.8 },
    { strike: 5150, put: 0, call: 8, vol: 78.0 }     // Far OTM Call - high vol
];

// Summary stats
const summaryStats = {
    totalPut: 594,
    totalCall: 640,
    vol: 62.98,
    volChange: -0.24,
    futureChange: -28.3,
    currentPrice: 4716.8,
    pcRatio: 0.93,
    maxPain: 4700,
    highestPut: { strike: 4500, volume: 60 },
    highestCall: { strike: 5000, volume: 123 }
};

// Range bands data (delta levels)
const rangeBands = [
    { label: '15ΔP', value: 377.1, strike: 4340 },
    { label: '25ΔP', value: 255.4, strike: 4460 },
    { label: '35ΔP', value: 130.4, strike: 4585 },
    { label: '45ΔP/C', value: 130.4, strike: 4716 },
    { label: '35ΔC', value: 266.2, strike: 4850 },
    { label: '25ΔC', value: 405.9, strike: 4980 },
    { label: '15ΔC', value: 0, strike: 5120 }
];

// ==================== BASIS CALCULATION ====================
// Basis data - will be populated from H1 CSV files
// Uses SMA20 on H1 timeframe (20 hours = ~1 trading day)
let basisData = {
    sma20GC: 0,
    sma20XAU: 0,
    currentXAU: 0,
    currentGC: 0,
    openDayXAU: 0,
    basis: 0,
    dataLoaded: false
};

// Calculate SMA from array of prices
function calculateSMA(prices, period = 20) {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
}

// Load Open Day data from JSON file (saved by Python script before cutting today's row)
async function loadOpenDayFromJSON() {
    try {
        const response = await fetch('open_day_xauusd.json');
        if (response.ok) {
            const data = await response.json();
            console.log('Open Day loaded from JSON:', data);
            return data;
        }
    } catch (error) {
        console.log('No Open Day JSON file found, will use CSV data');
    }
    return null;
}

// Load and process H1 CSV data for basis calculation
// Uses H1 (hourly) data with SMA20 for more responsive basis
async function loadBasisDataFromCSV() {
    try {
        // Load H1 CSV files and Open Day JSON in parallel
        const [xauResponse, gcResponse, openDayData] = await Promise.all([
            fetch('xauusd_h1_data.csv'),
            fetch('gc1_h1_data.csv'),
            loadOpenDayFromJSON()
        ]);

        const xauText = await xauResponse.text();
        const gcText = await gcResponse.text();

        // Parse CSV files
        const xauData = Papa.parse(xauText, { header: true, dynamicTyping: true }).data;
        const gcData = Papa.parse(gcText, { header: true, dynamicTyping: true }).data;

        // Filter valid data (remove empty rows)
        const xauValid = xauData.filter(row => row.close && !isNaN(row.close));
        const gcValid = gcData.filter(row => row.close && !isNaN(row.close));

        if (xauValid.length < 20 || gcValid.length < 20) {
            console.error('Not enough H1 data for SMA20 calculation');
            return false;
        }

        // Get close prices for SMA calculation
        const xauCloses = xauValid.map(row => parseFloat(row.close));
        const gcCloses = gcValid.map(row => parseFloat(row.close));

        // Calculate SMA20 on H1 data (20 hours = ~1 trading day)
        basisData.sma20XAU = calculateSMA(xauCloses, 20);
        basisData.sma20GC = calculateSMA(gcCloses, 20);

        // Get latest data (last row from CSV)
        const latestXAU = xauValid[xauValid.length - 1];
        const latestGC = gcValid[gcValid.length - 1];

        basisData.currentXAU = parseFloat(latestXAU.close);
        basisData.currentGC = parseFloat(latestGC.close);

        // Use Open Day from JSON if available (today's open before row was cut)
        // Otherwise use the last row's open from CSV
        if (openDayData && openDayData.open) {
            basisData.openDayXAU = parseFloat(openDayData.open);
            basisData.openDayDate = openDayData.date;
            console.log('Using Open Day from JSON:', basisData.openDayXAU);
        } else {
            basisData.openDayXAU = parseFloat(latestXAU.open);
            basisData.openDayDate = latestXAU.datetime;
            console.log('Using Open Day from H1 CSV last row:', basisData.openDayXAU);
        }

        // Calculate basis: SMA20(GC) - SMA20(XAUUSD) on H1 timeframe
        basisData.basis = basisData.sma20GC - basisData.sma20XAU;
        basisData.dataLoaded = true;

        console.log('Basis data loaded from H1 CSV:', basisData);
        console.log('SMA20 H1 GC:', basisData.sma20GC.toFixed(2));
        console.log('SMA20 H1 XAU:', basisData.sma20XAU.toFixed(2));
        console.log('Basis:', basisData.basis.toFixed(2));
        return true;

    } catch (error) {
        console.error('Error loading H1 CSV data:', error);
        // Fallback to mock data
        basisData = {
            sma20GC: 2820.50,
            sma20XAU: 2805.30,
            currentXAU: 2810.65,
            currentGC: 2825.50,
            openDayXAU: 2808.54,
            basis: 15.20,
            dataLoaded: false
        };
        return false;
    }
}

// Generate GC strike grid (00/25/50/75 levels)
// Range: around current price ±200
function generateGCStrikeGrid(centerPrice, range = 200) {
    const strikes = [];
    const baseStart = Math.floor((centerPrice - range) / 100) * 100;
    const baseEnd = Math.ceil((centerPrice + range) / 100) * 100;

    for (let base = baseStart; base <= baseEnd; base += 100) {
        strikes.push(base);        // 00
        strikes.push(base + 25);   // 25
        strikes.push(base + 50);   // 50
        strikes.push(base + 75);   // 75
    }

    return strikes.filter(s => s >= centerPrice - range && s <= centerPrice + range);
}

// Get zone type class
function getZoneClass(strike) {
    const mod = strike % 100;
    if (mod === 0) return 'z00';
    if (mod === 25) return 'z25';
    if (mod === 50) return 'z50';
    if (mod === 75) return 'z75';
    return '';
}

// Get zone label
function getZoneLabel(strike) {
    const mod = strike % 100;
    if (mod === 0) return '00';
    if (mod === 25) return '25';
    if (mod === 50) return '50';
    if (mod === 75) return '75';
    return '';
}

// Check if this is a major zone (00 or 50)
function isMajorZone(strike) {
    const mod = strike % 100;
    return mod === 0 || mod === 50;
}

// Current range setting
let currentRange = 150;

// Populate basis table
function populateBasisTable(range = currentRange) {
    const tbody = document.getElementById('basisTableBody');
    if (!tbody) return;

    currentRange = range;

    // Generate strikes around current GC price
    const gcStrikes = generateGCStrikeGrid(basisData.currentGC, range);

    // Update header stats
    document.getElementById('sma20GC').textContent = basisData.sma20GC.toFixed(2);
    document.getElementById('sma20XAU').textContent = basisData.sma20XAU.toFixed(2);
    document.getElementById('basisValue').textContent = basisData.basis.toFixed(2);

    // Update Open Day display
    const openDayEl = document.getElementById('openDayXAU');
    if (openDayEl) {
        openDayEl.textContent = basisData.openDayXAU.toFixed(2);
    }

    // Build table rows
    let html = '';
    gcStrikes.forEach(gcStrike => {
        // Calculate XAUUSD equivalent: XAUUSD Level = GC Strike - abs(Basis)
        const xauLevel = gcStrike - Math.abs(basisData.basis);

        // Calculate distance from Open Day XAUUSD (center reference)
        const distance = xauLevel - basisData.openDayXAU;
        const distanceStr = distance >= 0 ? `+${distance.toFixed(2)}` : distance.toFixed(2);

        // Determine row class
        const isMajor = isMajorZone(gcStrike);
        const isOpenZone = Math.abs(distance) < 15;  // Near Open Day price
        let rowClass = '';
        if (isOpenZone) {
            rowClass = 'current-zone';
        } else if (isMajor) {
            rowClass = 'major-zone';
        }

        // Determine note
        let note = '';
        if (isOpenZone) {
            note = '<span style="color: var(--success);">Open Day Zone</span>';
        } else if (isMajor) {
            note = '<span style="color: var(--primary);">Major Level</span>';
        }

        // Zone type badge
        const zoneClass = getZoneClass(gcStrike);
        const zoneLabel = getZoneLabel(gcStrike);

        html += `
            <tr class="${rowClass}">
                <td><span class="zone-type ${zoneClass}">${zoneLabel}</span></td>
                <td class="gc-strike">${gcStrike.toFixed(0)}</td>
                <td class="xau-level">${xauLevel.toFixed(2)}</td>
                <td style="color: ${distance >= 0 ? 'var(--success)' : 'var(--danger)'}">${distanceStr}</td>
                <td>${note}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// Chart colors
const colors = {
    put: '#FFA726',      // Orange
    putBg: 'rgba(255, 167, 38, 0.8)',
    call: '#42A5F5',     // Blue
    callBg: 'rgba(66, 165, 245, 0.8)',
    volLine: '#EF5350',  // Red dashed
    currentPrice: '#7367F0', // Purple
    gridColor: 'rgba(255, 255, 255, 0.1)',
    textColor: '#A8A4BF'
};

// Initialize chart
let oiChart = null;

function initChart() {
    const ctx = document.getElementById('oiChart').getContext('2d');

    // Prepare data
    const labels = strikeData.map(d => d.strike);
    const putData = strikeData.map(d => d.put);
    const callData = strikeData.map(d => d.call);
    const volData = strikeData.map(d => d.vol);

    // Find current price index
    const currentPriceIndex = labels.findIndex(s => s >= summaryStats.currentPrice) - 1;

    // Custom plugin for range bands background
    const rangeBandsPlugin = {
        id: 'rangeBands',
        beforeDraw: (chart) => {
            const ctx = chart.ctx;
            const chartArea = chart.chartArea;
            const xScale = chart.scales.x;

            // Define range zones with colors (faded/subtle)
            const zones = [
                { start: 4350, end: 4460, color: 'rgba(158, 158, 158, 0.06)' },  // Gray - faded
                { start: 4460, end: 4585, color: 'rgba(255, 235, 59, 0.06)' },   // Yellow - faded
                { start: 4585, end: 4650, color: 'rgba(255, 152, 0, 0.08)' },    // Orange - faded
                { start: 4650, end: 4780, color: 'rgba(244, 67, 54, 0.08)' },    // Red (center) - faded
                { start: 4780, end: 4850, color: 'rgba(255, 152, 0, 0.08)' },    // Orange - faded
                { start: 4850, end: 4980, color: 'rgba(255, 235, 59, 0.06)' },   // Yellow - faded
                { start: 4980, end: 5150, color: 'rgba(158, 158, 158, 0.06)' }   // Gray - faded
            ];

            zones.forEach(zone => {
                const startIndex = labels.indexOf(zone.start) !== -1 ? labels.indexOf(zone.start) : 0;
                const endIndex = labels.indexOf(zone.end) !== -1 ? labels.indexOf(zone.end) : labels.length - 1;

                // Calculate pixel positions
                let x1, x2;
                if (startIndex >= 0 && startIndex < labels.length) {
                    x1 = xScale.getPixelForValue(startIndex);
                } else {
                    x1 = chartArea.left;
                }
                if (endIndex >= 0 && endIndex < labels.length) {
                    x2 = xScale.getPixelForValue(endIndex);
                } else {
                    x2 = chartArea.right;
                }

                ctx.fillStyle = zone.color;
                ctx.fillRect(x1, chartArea.top, x2 - x1, chartArea.bottom - chartArea.top);
            });

            // Draw current price line
            const priceIndex = labels.findIndex(s => s >= summaryStats.currentPrice);
            if (priceIndex > 0) {
                const x = xScale.getPixelForValue(priceIndex - 0.5);
                ctx.beginPath();
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = colors.currentPrice;
                ctx.lineWidth = 2;
                ctx.moveTo(x, chartArea.top);
                ctx.lineTo(x, chartArea.bottom);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    };

    oiChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Put',
                    data: putData,
                    backgroundColor: colors.putBg,
                    borderColor: colors.put,
                    borderWidth: 1,
                    borderRadius: 2,
                    barPercentage: 0.8,
                    categoryPercentage: 0.9,
                    order: 2
                },
                {
                    label: 'Call',
                    data: callData,
                    backgroundColor: colors.callBg,
                    borderColor: colors.call,
                    borderWidth: 1,
                    borderRadius: 2,
                    barPercentage: 0.8,
                    categoryPercentage: 0.9,
                    order: 2
                },
                {
                    label: 'Vol Settle',
                    data: volData,
                    type: 'line',
                    borderColor: colors.volLine,
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'yVol',
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 30, 45, 0.95)',
                    titleColor: '#E1DEF5',
                    bodyColor: '#A8A4BF',
                    borderColor: '#3B4056',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        title: function(context) {
                            return `Strike: ${context[0].label}`;
                        },
                        label: function(context) {
                            if (context.dataset.label === 'Vol Settle') {
                                return `Vol: ${context.raw.toFixed(2)}%`;
                            }
                            return `${context.dataset.label}: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: colors.gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: colors.textColor,
                        font: { size: 10 },
                        maxRotation: 0,
                        callback: function(value, index) {
                            // Show every other label
                            return index % 2 === 0 ? this.getLabelForValue(value) : '';
                        }
                    }
                },
                y: {
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Intraday Volume',
                        color: colors.textColor,
                        font: { size: 11 }
                    },
                    grid: {
                        color: colors.gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: colors.textColor,
                        font: { size: 10 }
                    },
                    beginAtZero: true,
                    max: 140
                },
                yVol: {
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Volatility',
                        color: colors.volLine,
                        font: { size: 11 }
                    },
                    grid: {
                        drawOnChartArea: false
                    },
                    ticks: {
                        color: colors.volLine,
                        font: { size: 10 },
                        callback: function(value) {
                            return value.toFixed(1);
                        }
                    },
                    min: 58,
                    max: 78
                }
            }
        },
        plugins: [rangeBandsPlugin]
    });
}

// Update UI with stats
function updateStats() {
    document.getElementById('currentPrice').textContent = summaryStats.currentPrice.toFixed(1);
    document.getElementById('totalPut').textContent = summaryStats.totalPut;
    document.getElementById('totalCall').textContent = summaryStats.totalCall;
    document.getElementById('volValue').textContent = summaryStats.vol.toFixed(2);
    document.getElementById('volChange').textContent = summaryStats.volChange.toFixed(2);
    document.getElementById('futureChange').textContent = summaryStats.futureChange.toFixed(1);
    document.getElementById('pcRatio').textContent = summaryStats.pcRatio.toFixed(2);
    document.getElementById('maxPain').textContent = summaryStats.maxPain;
    document.getElementById('highestPut').textContent = `${summaryStats.highestPut.strike} (${summaryStats.highestPut.volume})`;
    document.getElementById('highestCall').textContent = `${summaryStats.highestCall.strike} (${summaryStats.highestCall.volume})`;

    // Price change styling
    const priceChangeEl = document.getElementById('priceChange');
    if (summaryStats.futureChange >= 0) {
        priceChangeEl.textContent = `+${summaryStats.futureChange.toFixed(1)}`;
        priceChangeEl.classList.remove('negative');
        priceChangeEl.classList.add('positive');
    } else {
        priceChangeEl.textContent = summaryStats.futureChange.toFixed(1);
        priceChangeEl.classList.remove('positive');
        priceChangeEl.classList.add('negative');
    }
}

// Set header date
function setHeaderDate() {
    const now = new Date();
    const options = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    };
    document.getElementById('headerDate').textContent = now.toLocaleDateString('en-US', options);
}

// Mobile menu toggle
function initMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('sidebar');

    if (toggle && sidebar) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }
}

// Sidebar navigation
function initSidebarNav() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        const link = item.querySelector('.nav-link');
        const submenu = item.querySelector('.submenu');

        if (link && submenu) {
            link.addEventListener('click', (e) => {
                e.preventDefault();

                // Toggle current item
                item.classList.toggle('open');

                // Close other items
                navItems.forEach(other => {
                    if (other !== item && other.classList.contains('open')) {
                        other.classList.remove('open');
                    }
                });
            });
        }
    });
}

// Initialize everything
// Initialize range selector
function initRangeSelector() {
    const rangeSelector = document.getElementById('rangeSelector');
    if (rangeSelector) {
        rangeSelector.addEventListener('change', (e) => {
            const range = parseInt(e.target.value, 10);
            populateBasisTable(range);
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    setHeaderDate();
    updateStats();
    initChart();
    initMobileMenu();
    initSidebarNav();
    initRangeSelector();   // Initialize range dropdown

    // Load real data from CSV files
    await loadBasisDataFromCSV();
    populateBasisTable();  // Initialize basis grid table with real data
});

// Handle window resize
window.addEventListener('resize', () => {
    if (oiChart) {
        oiChart.resize();
    }
});
