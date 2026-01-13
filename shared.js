// Gold Candle Analysis Dashboard - Shared JavaScript
// Version 4.0 - Multi-Market Support (XAUUSD + GC1!)
// ============================================

// Global variables
let rawData = [];
let charts = {};
let currentMarket = 'xauusd'; // Default market

// Market configurations
const MARKETS = {
    xauusd: {
        id: 'xauusd',
        symbol: 'XAUUSD',
        name: 'Gold Spot CFD',
        exchange: 'OANDA',
        type: 'CFD',
        dataFile: 'xauusd_10years_data.csv',
        color: '#7367F0',
        icon: '💰'
    },
    gc1: {
        id: 'gc1',
        symbol: 'GC1!',
        name: 'Gold Futures',
        exchange: 'COMEX',
        type: 'Futures',
        dataFile: 'gc1_10years_data.csv',
        color: '#fbbf24',
        icon: '📊'
    }
};

// Data cache for both markets
const dataCache = {
    xauusd: null,
    gc1: null
};

// Candle type mapping
const CANDLE_TYPES = {
    0: 'Doji Bullish',
    1: 'Doji Bearish',
    2: 'Full Body Bullish',
    3: 'Full Body Bearish',
    4: 'Normal Candle Bullish',
    5: 'Normal Candle Bearish',
    6: 'Long Wick Bullish',
    7: 'Long Wick Bearish'
};

// Day of week names
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Month names
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Color scheme - Professional Purple Theme
const COLORS = {
    neon: {
        cyan: '#7367F0',
        purple: '#7367F0',
        pink: '#E859A3',
        orange: '#FF9F43',
        green: '#28C76F',
        yellow: '#FFCA2C',
        blue: '#5A8DEE',
        red: '#FF4C51'
    },
    primary: '#7367F0',
    bullish: '#28C76F',
    bearish: '#FF4C51',
    types: [
        'rgba(115, 103, 240, 0.8)',
        'rgba(40, 199, 111, 0.8)',
        'rgba(90, 141, 238, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(143, 133, 243, 0.8)',
        'rgba(255, 159, 67, 0.8)',
        'rgba(232, 89, 163, 0.8)',
        'rgba(255, 202, 44, 0.8)'
    ]
};

// Chart.js Global Defaults
Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
Chart.defaults.font.family = 'Inter, sans-serif';

// ============================================
// Data Loading - Multi-Market Support
// ============================================

async function loadData(marketId = null) {
    const market = marketId || currentMarket;
    const config = MARKETS[market];

    if (!config) {
        console.error(`Unknown market: ${market}`);
        return null;
    }

    // Return cached data if available
    if (dataCache[market]) {
        return dataCache[market];
    }

    return new Promise((resolve, reject) => {
        Papa.parse(config.dataFile, {
            download: true,
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: function(results) {
                if (results.errors.length > 0) {
                    console.warn(`CSV parsing warnings for ${market}:`, results.errors);
                }
                // Cache the data
                dataCache[market] = results.data;
                resolve(results.data);
            },
            error: function(error) {
                console.error(`Error loading ${market} data:`, error);
                reject(error);
            }
        });
    });
}

// Load data for specific market
async function loadMarketData(marketId) {
    return loadData(marketId);
}

// Load data for both markets (for comparison)
async function loadAllMarketsData() {
    const results = {};
    for (const marketId of Object.keys(MARKETS)) {
        try {
            results[marketId] = await loadData(marketId);
        } catch (error) {
            console.error(`Failed to load ${marketId}:`, error);
            results[marketId] = null;
        }
    }
    return results;
}

// Clear cache for a market
function clearCache(marketId = null) {
    if (marketId) {
        dataCache[marketId] = null;
    } else {
        Object.keys(dataCache).forEach(key => dataCache[key] = null);
    }
}

// Get current market config
function getCurrentMarket() {
    return MARKETS[currentMarket];
}

// Set current market
function setCurrentMarket(marketId) {
    if (MARKETS[marketId]) {
        currentMarket = marketId;
        // Update UI
        updateMarketSelector();
        return true;
    }
    return false;
}

// Update market selector UI
function updateMarketSelector() {
    const selector = document.getElementById('marketSelector');
    if (selector) {
        selector.value = currentMarket;
    }

    // Update market badge in header
    const badge = document.getElementById('marketBadge');
    if (badge) {
        const market = MARKETS[currentMarket];
        badge.innerHTML = `${market.icon} ${market.symbol}`;
        badge.style.borderColor = market.color;
        badge.style.color = market.color;
    }

    // Update page title if exists
    const marketName = document.getElementById('currentMarketName');
    if (marketName) {
        marketName.textContent = MARKETS[currentMarket].name;
    }
}

// ============================================
// Date Utilities
// ============================================

function parseDate(dateStr) {
    // Handle format: "2024-12-23" or similar
    return new Date(dateStr);
}

function getDayOfWeek(dateStr) {
    const date = parseDate(dateStr);
    return date.getDay(); // 0 = Sunday, 1 = Monday, etc.
}

function getWeekOfMonth(dateStr) {
    const date = parseDate(dateStr);
    const dayOfMonth = date.getDate();

    if (dayOfMonth <= 7) return 1;
    if (dayOfMonth <= 14) return 2;
    if (dayOfMonth <= 21) return 3;
    return 4;
}

function getMonth(dateStr) {
    const date = parseDate(dateStr);
    return date.getMonth(); // 0-11
}

function getYear(dateStr) {
    const date = parseDate(dateStr);
    return date.getFullYear();
}

function getWeekNumber(dateStr) {
    const date = parseDate(dateStr);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

function formatDate(dateStr, format = 'short') {
    const date = parseDate(dateStr);
    if (format === 'short') {
        return `${MONTH_NAMES_SHORT[date.getMonth()]} ${date.getDate()}`;
    }
    return dateStr;
}

// ============================================
// Data Processing Functions
// ============================================

function calculateSentiment(data) {
    let bullish = 0;
    let bearish = 0;

    data.forEach(row => {
        const candleType = row.candle_type;
        if (candleType % 2 === 0) {
            bullish++;
        } else {
            bearish++;
        }
    });

    return { bullish, bearish };
}

function calculateTypeDistribution(data) {
    const counts = {};
    Object.keys(CANDLE_TYPES).forEach(key => {
        counts[key] = 0;
    });

    data.forEach(row => {
        const type = row.candle_type;
        if (type !== null && type !== undefined && counts.hasOwnProperty(type)) {
            counts[type]++;
        }
    });

    return counts;
}

function isBullish(candleType) {
    return candleType % 2 === 0;
}

function calculateDailyRange(row) {
    return row.high - row.low;
}

function calculateChange(row) {
    return row.close - row.open;
}

// ============================================
// Day of Week Statistics
// ============================================

function calculateDayOfWeekStats(data) {
    // Initialize stats for Mon-Fri (1-5)
    const stats = {};
    for (let i = 1; i <= 5; i++) {
        stats[i] = {
            name: DAY_NAMES[i],
            shortName: DAY_NAMES_SHORT[i],
            bullish: 0,
            bearish: 0,
            total: 0,
            totalRange: 0,
            totalChange: 0
        };
    }

    data.forEach(row => {
        if (!row.datetime) return;

        const dow = getDayOfWeek(row.datetime);

        // Skip weekends
        if (dow === 0 || dow === 6) return;
        if (!stats[dow]) return;

        stats[dow].total++;

        if (isBullish(row.candle_type)) {
            stats[dow].bullish++;
        } else {
            stats[dow].bearish++;
        }

        stats[dow].totalRange += calculateDailyRange(row);
        stats[dow].totalChange += calculateChange(row);
    });

    // Calculate percentages and averages
    Object.keys(stats).forEach(day => {
        const s = stats[day];
        s.bullishPct = s.total > 0 ? (s.bullish / s.total * 100) : 0;
        s.bearishPct = s.total > 0 ? (s.bearish / s.total * 100) : 0;
        s.avgRange = s.total > 0 ? (s.totalRange / s.total) : 0;
        s.avgChange = s.total > 0 ? (s.totalChange / s.total) : 0;
    });

    // Find best and worst days
    let bestDay = null, worstDay = null;
    let bestPct = 0, worstPct = 100;

    Object.keys(stats).forEach(day => {
        if (stats[day].bullishPct > bestPct) {
            bestPct = stats[day].bullishPct;
            bestDay = parseInt(day);
        }
        if (stats[day].bullishPct < worstPct) {
            worstPct = stats[day].bullishPct;
            worstDay = parseInt(day);
        }
    });

    return { stats, bestDay, worstDay };
}

// ============================================
// Week of Month Statistics
// ============================================

function calculateWeekOfMonthStats(data) {
    // Initialize stats for weeks 1-4
    const stats = {};
    for (let i = 1; i <= 4; i++) {
        stats[i] = {
            name: `${i}${getOrdinalSuffix(i)} Week`,
            period: getWeekPeriod(i),
            bullish: 0,
            bearish: 0,
            total: 0,
            totalChange: 0,
            weeks: 0 // Number of unique weeks
        };
    }

    // Track unique weeks
    const weeksSeen = {};
    for (let i = 1; i <= 4; i++) {
        weeksSeen[i] = new Set();
    }

    data.forEach(row => {
        if (!row.datetime) return;

        const wom = getWeekOfMonth(row.datetime);
        const yearMonth = row.datetime.substring(0, 7); // "2024-12"

        if (!stats[wom]) return;

        stats[wom].total++;
        weeksSeen[wom].add(yearMonth);

        if (isBullish(row.candle_type)) {
            stats[wom].bullish++;
        } else {
            stats[wom].bearish++;
        }

        stats[wom].totalChange += calculateChange(row);
    });

    // Calculate percentages and averages
    Object.keys(stats).forEach(week => {
        const s = stats[week];
        s.weeks = weeksSeen[week].size;
        s.bullishPct = s.total > 0 ? (s.bullish / s.total * 100) : 0;
        s.bearishPct = s.total > 0 ? (s.bearish / s.total * 100) : 0;
        s.avgChange = s.weeks > 0 ? (s.totalChange / s.weeks) : 0;
    });

    // Find best and worst weeks
    let bestWeek = null, worstWeek = null;
    let bestPct = 0, worstPct = 100;

    Object.keys(stats).forEach(week => {
        if (stats[week].bullishPct > bestPct) {
            bestPct = stats[week].bullishPct;
            bestWeek = parseInt(week);
        }
        if (stats[week].bullishPct < worstPct) {
            worstPct = stats[week].bullishPct;
            worstWeek = parseInt(week);
        }
    });

    return { stats, bestWeek, worstWeek };
}

function getOrdinalSuffix(n) {
    if (n === 1) return 'st';
    if (n === 2) return 'nd';
    if (n === 3) return 'rd';
    return 'th';
}

function getWeekPeriod(weekNum) {
    if (weekNum === 1) return 'Day 1-7';
    if (weekNum === 2) return 'Day 8-14';
    if (weekNum === 3) return 'Day 15-21';
    return 'Day 22-31';
}

// ============================================
// Monthly Statistics
// ============================================

function calculateMonthlyStats(data) {
    // Group by year and month
    const monthly = {};

    data.forEach(row => {
        if (!row.datetime) return;

        const year = getYear(row.datetime);
        const month = getMonth(row.datetime);
        const key = `${year}-${month}`;

        if (!monthly[key]) {
            monthly[key] = {
                year,
                month,
                monthName: MONTH_NAMES_SHORT[month],
                openPrice: row.open,
                closePrice: row.close,
                bullish: 0,
                bearish: 0,
                total: 0,
                highestHigh: row.high,
                lowestLow: row.low
            };
        }

        monthly[key].closePrice = row.close;
        monthly[key].total++;

        if (isBullish(row.candle_type)) {
            monthly[key].bullish++;
        } else {
            monthly[key].bearish++;
        }

        if (row.high > monthly[key].highestHigh) {
            monthly[key].highestHigh = row.high;
        }
        if (row.low < monthly[key].lowestLow) {
            monthly[key].lowestLow = row.low;
        }
    });

    // Calculate monthly change
    Object.keys(monthly).forEach(key => {
        const m = monthly[key];
        m.change = m.closePrice - m.openPrice;
        m.changePct = m.openPrice > 0 ? (m.change / m.openPrice * 100) : 0;
        m.range = m.highestHigh - m.lowestLow;
        m.isPositive = m.change >= 0;
        m.bullishPct = m.total > 0 ? (m.bullish / m.total * 100) : 0;
    });

    return monthly;
}

function calculateSeasonalPattern(data) {
    // Calculate average performance by month across all years
    const seasonal = {};

    for (let i = 0; i < 12; i++) {
        seasonal[i] = {
            month: i,
            monthName: MONTH_NAMES_SHORT[i],
            totalChange: 0,
            positiveYears: 0,
            totalYears: 0
        };
    }

    const monthly = calculateMonthlyStats(data);

    Object.values(monthly).forEach(m => {
        seasonal[m.month].totalChange += m.changePct;
        seasonal[m.month].totalYears++;
        if (m.isPositive) {
            seasonal[m.month].positiveYears++;
        }
    });

    // Calculate averages
    Object.keys(seasonal).forEach(month => {
        const s = seasonal[month];
        s.avgChange = s.totalYears > 0 ? (s.totalChange / s.totalYears) : 0;
        s.positiveRate = s.totalYears > 0 ? (s.positiveYears / s.totalYears * 100) : 0;
    });

    // Find best and worst months
    let bestMonth = 0, worstMonth = 0;
    let bestAvg = -Infinity, worstAvg = Infinity;

    Object.keys(seasonal).forEach(month => {
        if (seasonal[month].avgChange > bestAvg) {
            bestAvg = seasonal[month].avgChange;
            bestMonth = parseInt(month);
        }
        if (seasonal[month].avgChange < worstAvg) {
            worstAvg = seasonal[month].avgChange;
            worstMonth = parseInt(month);
        }
    });

    return { seasonal, bestMonth, worstMonth };
}

// ============================================
// Weekly Performance (by calendar week)
// ============================================

function calculateWeeklyPerformance(data, year = null) {
    const weekly = {};

    data.forEach(row => {
        if (!row.datetime) return;

        const rowYear = getYear(row.datetime);
        if (year !== null && rowYear !== year) return;

        const weekNum = getWeekNumber(row.datetime);
        const key = `${rowYear}-W${weekNum}`;

        if (!weekly[key]) {
            weekly[key] = {
                year: rowYear,
                week: weekNum,
                startDate: row.datetime,
                endDate: row.datetime,
                openPrice: row.open,
                closePrice: row.close,
                bullish: 0,
                bearish: 0,
                total: 0,
                highestHigh: row.high,
                lowestLow: row.low
            };
        }

        weekly[key].endDate = row.datetime;
        weekly[key].closePrice = row.close;
        weekly[key].total++;

        if (isBullish(row.candle_type)) {
            weekly[key].bullish++;
        } else {
            weekly[key].bearish++;
        }

        if (row.high > weekly[key].highestHigh) {
            weekly[key].highestHigh = row.high;
        }
        if (row.low < weekly[key].lowestLow) {
            weekly[key].lowestLow = row.low;
        }
    });

    // Calculate weekly stats
    Object.keys(weekly).forEach(key => {
        const w = weekly[key];
        w.change = w.closePrice - w.openPrice;
        w.range = w.highestHigh - w.lowestLow;
        w.winRate = w.total > 0 ? (w.bullish / w.total * 100) : 0;
        w.isPositive = w.change >= 0;
    });

    return weekly;
}

// ============================================
// UI Helpers
// ============================================

function showLoading(elementId = 'loading') {
    const el = document.getElementById(elementId);
    if (el) el.classList.remove('hidden');
}

function hideLoading(elementId = 'loading') {
    const el = document.getElementById(elementId);
    if (el) el.classList.add('hidden');
}

function showContent(elementId = 'content') {
    const el = document.getElementById(elementId);
    if (el) el.classList.remove('hidden');
}

function formatNumber(num, decimals = 2) {
    return num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatCurrency(num, decimals = 2) {
    return '$' + formatNumber(num, decimals);
}

function formatPercent(num, decimals = 1) {
    return formatNumber(num, decimals) + '%';
}

// ============================================
// Sidebar Navigation
// ============================================

function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    // Sidebar collapse toggle
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 300);
        });
    }

    // Mobile menu toggle
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
            sidebarOverlay.classList.toggle('active');
        });
    }

    // Mobile overlay close
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('active');
        });
    }

    // Submenu toggle - คลิกเปิด/ปิด dropdown
    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            const navItem = link.closest('.nav-item');
            const hasSubmenu = navItem.querySelector('.submenu');

            // If link has href and it's a real link (not just "#"), navigate
            if (href && href !== '#' && href !== '') {
                // Allow navigation, don't prevent default
                return;
            }

            // Otherwise toggle submenu
            e.preventDefault();
            if (hasSubmenu) {
                navItem.classList.toggle('open');
            }
        });
    });

    // Handle window resize for charts
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            Object.values(charts || {}).forEach(chart => {
                if (chart && typeof chart.resize === 'function') {
                    chart.resize();
                }
            });
        }, 250);
    });
}

// ============================================
// Table Sorting
// ============================================

function initTableSort(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const headers = table.querySelectorAll('th[data-sort]');

    headers.forEach(header => {
        header.addEventListener('click', () => {
            const sortKey = header.dataset.sort;
            const isAsc = header.classList.contains('sorted-asc');

            // Remove sort classes from all headers
            headers.forEach(h => {
                h.classList.remove('sorted-asc', 'sorted-desc');
            });

            // Add sort class to clicked header
            header.classList.add(isAsc ? 'sorted-desc' : 'sorted-asc');

            // Trigger sort event
            const event = new CustomEvent('tableSort', {
                detail: { key: sortKey, ascending: !isAsc }
            });
            table.dispatchEvent(event);
        });
    });
}

// ============================================
// Pagination
// ============================================

function createPagination(totalItems, currentPage, itemsPerPage, onPageChange) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const container = document.createElement('div');
    container.className = 'pagination';

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn';
    prevBtn.textContent = '< Prev';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
    container.appendChild(prevBtn);

    // Page numbers
    const maxPages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(totalPages, startPage + maxPages - 1);

    if (endPage - startPage < maxPages - 1) {
        startPage = Math.max(1, endPage - maxPages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = 'pagination-btn' + (i === currentPage ? ' active' : '');
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => onPageChange(i));
        container.appendChild(pageBtn);
    }

    // Info
    const info = document.createElement('span');
    info.className = 'pagination-info';
    info.textContent = `of ${totalPages}`;
    container.appendChild(info);

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn';
    nextBtn.textContent = 'Next >';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
    container.appendChild(nextBtn);

    return container;
}

// ============================================
// Export Functions
// ============================================

function exportToCSV(data, filename) {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// ============================================
// Get Available Years
// ============================================

function getAvailableYears(data) {
    const years = new Set();
    data.forEach(row => {
        if (row.datetime) {
            years.add(getYear(row.datetime));
        }
    });
    return Array.from(years).sort((a, b) => b - a);
}

// ============================================
// Comparison Functions
// ============================================

function calculateCorrelation(arr1, arr2) {
    if (arr1.length !== arr2.length || arr1.length === 0) return 0;

    const n = arr1.length;
    const mean1 = arr1.reduce((a, b) => a + b, 0) / n;
    const mean2 = arr2.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;

    for (let i = 0; i < n; i++) {
        const diff1 = arr1[i] - mean1;
        const diff2 = arr2[i] - mean2;
        numerator += diff1 * diff2;
        denom1 += diff1 * diff1;
        denom2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(denom1) * Math.sqrt(denom2);
    return denominator === 0 ? 0 : numerator / denominator;
}

function alignDataByDate(data1, data2) {
    // Create date maps
    const map1 = new Map();
    const map2 = new Map();

    data1.forEach(row => {
        if (row.datetime) map1.set(row.datetime, row);
    });

    data2.forEach(row => {
        if (row.datetime) map2.set(row.datetime, row);
    });

    // Find common dates
    const commonDates = [];
    map1.forEach((value, date) => {
        if (map2.has(date)) {
            commonDates.push(date);
        }
    });

    // Sort dates
    commonDates.sort();

    // Build aligned arrays
    const aligned1 = commonDates.map(date => map1.get(date));
    const aligned2 = commonDates.map(date => map2.get(date));

    return { aligned1, aligned2, dates: commonDates };
}

function calculateDirectionMatch(data1, data2) {
    const { aligned1, aligned2 } = alignDataByDate(data1, data2);

    let matches = 0;
    let total = 0;

    for (let i = 0; i < aligned1.length; i++) {
        const bullish1 = isBullish(aligned1[i].candle_type);
        const bullish2 = isBullish(aligned2[i].candle_type);

        if (bullish1 === bullish2) matches++;
        total++;
    }

    return total > 0 ? (matches / total * 100) : 0;
}

function calculateTypeMatch(data1, data2) {
    const { aligned1, aligned2 } = alignDataByDate(data1, data2);

    let matches = 0;
    let total = 0;

    for (let i = 0; i < aligned1.length; i++) {
        if (aligned1[i].candle_type === aligned2[i].candle_type) matches++;
        total++;
    }

    return total > 0 ? (matches / total * 100) : 0;
}

function calculatePriceCorrelation(data1, data2) {
    const { aligned1, aligned2 } = alignDataByDate(data1, data2);

    const prices1 = aligned1.map(row => row.close);
    const prices2 = aligned2.map(row => row.close);

    return calculateCorrelation(prices1, prices2);
}

function calculateDailyChangeCorrelation(data1, data2) {
    const { aligned1, aligned2 } = alignDataByDate(data1, data2);

    const changes1 = aligned1.map(row => row.close - row.open);
    const changes2 = aligned2.map(row => row.close - row.open);

    return calculateCorrelation(changes1, changes2);
}

function findDivergences(data1, data2) {
    const { aligned1, aligned2, dates } = alignDataByDate(data1, data2);

    const divergences = [];

    for (let i = 0; i < aligned1.length; i++) {
        const bullish1 = isBullish(aligned1[i].candle_type);
        const bullish2 = isBullish(aligned2[i].candle_type);

        if (bullish1 !== bullish2) {
            divergences.push({
                date: dates[i],
                xauusd: aligned1[i],
                gc1: aligned2[i],
                xauusdBullish: bullish1,
                gc1Bullish: bullish2
            });
        }
    }

    return divergences;
}

function calculateBasis(data1, data2) {
    const { aligned1, aligned2, dates } = alignDataByDate(data1, data2);

    return dates.map((date, i) => ({
        date,
        xauusd: aligned1[i].close,
        gc1: aligned2[i].close,
        basis: aligned2[i].close - aligned1[i].close,
        basisPct: ((aligned2[i].close - aligned1[i].close) / aligned1[i].close * 100)
    }));
}

function getComparisonStats(data1, data2) {
    const { aligned1, aligned2 } = alignDataByDate(data1, data2);

    // Get latest data
    const latest1 = aligned1[aligned1.length - 1];
    const latest2 = aligned2[aligned2.length - 1];

    // Calculate stats
    const avgRange1 = aligned1.reduce((sum, r) => sum + (r.high - r.low), 0) / aligned1.length;
    const avgRange2 = aligned2.reduce((sum, r) => sum + (r.high - r.low), 0) / aligned2.length;

    const avgBody1 = aligned1.reduce((sum, r) => sum + r.body_size, 0) / aligned1.length;
    const avgBody2 = aligned2.reduce((sum, r) => sum + r.body_size, 0) / aligned2.length;

    const bullish1 = aligned1.filter(r => isBullish(r.candle_type)).length;
    const bullish2 = aligned2.filter(r => isBullish(r.candle_type)).length;

    return {
        totalDays: aligned1.length,
        latest: {
            xauusd: latest1,
            gc1: latest2,
            basis: latest2.close - latest1.close
        },
        avgRange: {
            xauusd: avgRange1,
            gc1: avgRange2,
            diff: avgRange2 - avgRange1
        },
        avgBody: {
            xauusd: avgBody1,
            gc1: avgBody2,
            diff: avgBody2 - avgBody1
        },
        bullishPct: {
            xauusd: (bullish1 / aligned1.length * 100),
            gc1: (bullish2 / aligned2.length * 100)
        },
        priceCorr: calculatePriceCorrelation(data1, data2),
        directionMatch: calculateDirectionMatch(data1, data2),
        typeMatch: calculateTypeMatch(data1, data2)
    };
}

// ============================================
// Market Selector Initialization
// ============================================

// Set current date in header
function setCurrentDate() {
    const headerDate = document.getElementById('headerDate');
    if (headerDate) {
        const today = new Date();
        headerDate.textContent = today.toLocaleDateString('en-US', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
        });
    }
}

function initMarketSelector(onChangeCallback) {
    const selector = document.getElementById('marketSelector');
    if (!selector) return;

    // Populate options
    selector.innerHTML = Object.values(MARKETS).map(market =>
        `<option value="${market.id}">${market.icon} ${market.symbol} (${market.type})</option>`
    ).join('');

    // Set current value
    selector.value = currentMarket;

    // Add change handler
    selector.addEventListener('change', async (e) => {
        const newMarket = e.target.value;
        setCurrentMarket(newMarket);

        if (onChangeCallback) {
            showLoading();
            try {
                const data = await loadData(newMarket);
                rawData = data;
                await onChangeCallback(data);
            } catch (error) {
                console.error('Error switching market:', error);
            }
            hideLoading();
            showContent();
        }
    });
}
