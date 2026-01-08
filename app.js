// Gold Candle Analysis Dashboard - Modern Dark Theme
// ============================================

// Global variables
let rawData = [];
let charts = {};

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

// Modern Neon Color scheme
const COLORS = {
    neon: {
        cyan: '#00f5ff',
        purple: '#a855f7',
        pink: '#ec4899',
        orange: '#f97316',
        green: '#22c55e',
        yellow: '#fbbf24',
        blue: '#3b82f6',
        red: '#ef4444'
    },
    bullish: 'rgba(0, 245, 255, 0.8)',      // Neon Cyan
    bearish: 'rgba(34, 197, 94, 0.8)',       // Neon Green
    types: [
        'rgba(0, 245, 255, 0.8)',    // 0: Doji Bullish - Cyan
        'rgba(34, 197, 94, 0.8)',    // 1: Doji Bearish - Green
        'rgba(59, 130, 246, 0.8)',   // 2: Full Body Bullish - Blue
        'rgba(16, 185, 129, 0.8)',   // 3: Full Body Bearish - Emerald
        'rgba(168, 85, 247, 0.8)',   // 4: Normal Candle Bullish - Purple
        'rgba(249, 115, 22, 0.8)',   // 5: Normal Candle Bearish - Orange
        'rgba(236, 72, 153, 0.8)',   // 6: Long Wick Bullish - Pink
        'rgba(251, 191, 36, 0.8)'    // 7: Long Wick Bearish - Yellow
    ],
    typesBorder: [
        '#00f5ff', '#22c55e', '#3b82f6', '#10b981',
        '#a855f7', '#f97316', '#ec4899', '#fbbf24'
    ],
    distanceMetrics: {
        high_open_dist: 'rgba(59, 130, 246, 0.8)',
        upper_wick: 'rgba(168, 85, 247, 0.8)',
        body_size: 'rgba(156, 163, 175, 0.8)',
        lower_wick: 'rgba(251, 191, 36, 0.8)',
        open_low_dist: 'rgba(249, 115, 22, 0.8)'
    }
};

// Chart.js Global Defaults for Dark Theme
Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
Chart.defaults.font.family = 'Inter, sans-serif';

// ============================================
// Data Loading
// ============================================

async function loadData() {
    return new Promise((resolve, reject) => {
        Papa.parse('xauusd_10years_data.csv', {
            download: true,
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: function(results) {
                if (results.errors.length > 0) {
                    console.warn('CSV parsing warnings:', results.errors);
                }
                resolve(results.data);
            },
            error: function(error) {
                reject(error);
            }
        });
    });
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

function calculateAvgDistanceByType(data) {
    const metrics = ['high_open_dist', 'upper_wick', 'body_size', 'lower_wick', 'open_low_dist'];
    const result = {};

    Object.keys(CANDLE_TYPES).forEach(type => {
        result[type] = { count: 0, sums: {} };
        metrics.forEach(metric => {
            result[type].sums[metric] = 0;
        });
    });

    data.forEach(row => {
        const type = row.candle_type;
        if (type !== null && type !== undefined && result.hasOwnProperty(type)) {
            result[type].count++;
            metrics.forEach(metric => {
                if (row[metric] !== null && !isNaN(row[metric])) {
                    result[type].sums[metric] += row[metric];
                }
            });
        }
    });

    const averages = {};
    Object.keys(result).forEach(type => {
        averages[type] = {};
        metrics.forEach(metric => {
            averages[type][metric] = result[type].count > 0
                ? result[type].sums[metric] / result[type].count
                : 0;
        });
    });

    return averages;
}

function filterDataByPattern(data, prev1, prev2, prev3) {
    return data.filter(row => {
        const match1 = prev1 === '' || row.prev_candle_1 == prev1;
        const match2 = prev2 === '' || row.prev_candle_2 == prev2;
        const match3 = prev3 === '' || row.prev_candle_3 == prev3;
        return match1 && match2 && match3;
    });
}

function calculateNextCandleDistribution(filteredData) {
    const distribution = calculateTypeDistribution(filteredData);
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);

    let topType = null;
    let topCount = 0;
    let topPercent = 0;

    const percentages = {};
    Object.keys(distribution).forEach(type => {
        const count = distribution[type];
        const percent = total > 0 ? (count / total * 100) : 0;
        percentages[type] = percent;

        if (count > topCount) {
            topCount = count;
            topType = type;
            topPercent = percent;
        }
    });

    let bullish = 0;
    let bearish = 0;
    Object.keys(distribution).forEach(type => {
        if (parseInt(type) % 2 === 0) {
            bullish += distribution[type];
        } else {
            bearish += distribution[type];
        }
    });

    return {
        distribution,
        percentages,
        total,
        topType,
        topName: CANDLE_TYPES[topType] || '-',
        topPercent,
        bullish,
        bearish
    };
}

// ============================================
// Candle SVG Drawing Function
// ============================================

function drawCandleSVG(type) {
    const isBullish = type % 2 === 0;
    const color = isBullish ? '#22c55e' : '#ef4444'; // Green for bullish, Red for bearish

    const svgWidth = 60;
    const svgHeight = 100;
    const centerX = svgWidth / 2;
    const bodyWidth = 24;

    // Different proportions for each candle type
    let upperWickHeight, bodyHeight, lowerWickHeight;

    switch(parseInt(type)) {
        case 0: case 1: // Doji - very small body, long wicks
            upperWickHeight = 35;
            bodyHeight = 5;
            lowerWickHeight = 35;
            break;
        case 2: case 3: // Full Body - large body, short wicks
            upperWickHeight = 8;
            bodyHeight = 65;
            lowerWickHeight = 8;
            break;
        case 4: case 5: // Normal - balanced body and wicks
            upperWickHeight = 20;
            bodyHeight = 40;
            lowerWickHeight = 20;
            break;
        case 6: case 7: // Long Wick - long upper wick
            upperWickHeight = 40;
            bodyHeight = 25;
            lowerWickHeight = 15;
            break;
        default:
            upperWickHeight = 20;
            bodyHeight = 40;
            lowerWickHeight = 20;
    }

    const margin = 5;
    const upperWickY = margin;
    const bodyY = margin + upperWickHeight;
    const lowerWickY = bodyY + bodyHeight;

    // Both bullish and bearish are filled (solid color)
    return `
        <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
            <!-- Upper Wick -->
            <line x1="${centerX}" y1="${upperWickY}" x2="${centerX}" y2="${bodyY}"
                  stroke="${color}" stroke-width="2"/>
            <!-- Body (filled) -->
            <rect x="${centerX - bodyWidth/2}" y="${bodyY}"
                  width="${bodyWidth}" height="${bodyHeight}"
                  fill="${color}" stroke="${color}" stroke-width="2" rx="2"/>
            <!-- Lower Wick -->
            <line x1="${centerX}" y1="${lowerWickY}" x2="${centerX}" y2="${lowerWickY + lowerWickHeight}"
                  stroke="${color}" stroke-width="2"/>
        </svg>
    `;
}

// ============================================
// Candle Type Cards Creation
// ============================================

const CANDLE_DESCRIPTIONS = {
    0: 'Body < 10%, Bullish',
    1: 'Body < 10%, Bearish',
    2: 'Body > 70%, Strong Up',
    3: 'Body > 70%, Strong Down',
    4: 'Balanced, Bullish',
    5: 'Balanced, Bearish',
    6: 'Wick > 40%, Bullish',
    7: 'Wick > 40%, Bearish'
};

function createCandleTypeCards(averages, distribution) {
    const grid = document.getElementById('candleTypesGrid');
    if (!grid) return;

    grid.innerHTML = '';

    // Order: Bullish first (0,2,4,6), then Bearish (1,3,5,7)
    const typeOrder = [0, 2, 4, 6, 1, 3, 5, 7];

    typeOrder.forEach(type => {
        const isBullish = type % 2 === 0;
        const metrics = averages[type] || {};
        const count = distribution[type] || 0;

        const card = document.createElement('div');
        card.className = `candle-type-card ${isBullish ? 'bullish' : 'bearish'}`;

        card.innerHTML = `
            <div class="candle-visual">${drawCandleSVG(type)}</div>
            <div class="candle-type-name">${CANDLE_TYPES[type]}</div>
            <div class="candle-type-code">Type ${type} | ${CANDLE_DESCRIPTIONS[type]}</div>
            <div class="candle-metrics">
                <div class="metric-row">
                    <span class="metric-label">high_open_dist</span>
                    <span class="metric-value">$${(metrics.high_open_dist || 0).toFixed(2)}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">upper_wick</span>
                    <span class="metric-value">$${(metrics.upper_wick || 0).toFixed(2)}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">body_size</span>
                    <span class="metric-value">$${(metrics.body_size || 0).toFixed(2)}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">lower_wick</span>
                    <span class="metric-value">$${(metrics.lower_wick || 0).toFixed(2)}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">open_low_dist</span>
                    <span class="metric-value">$${(metrics.open_low_dist || 0).toFixed(2)}</span>
                </div>
            </div>
            <div class="candle-count">
                <div class="count-value ${isBullish ? 'bullish' : 'bearish'}">${count.toLocaleString()}</div>
                <div class="count-label">occurrences in 10 years</div>
            </div>
        `;

        grid.appendChild(card);
    });
}

// ============================================
// Chart Creation Functions
// ============================================

function createSentimentChart(sentiment) {
    const ctx = document.getElementById('sentimentChart').getContext('2d');
    if (charts.sentiment) charts.sentiment.destroy();

    // Create gradient for bars
    const gradientBullish = ctx.createLinearGradient(0, 0, 0, 300);
    gradientBullish.addColorStop(0, 'rgba(0, 245, 255, 0.8)');
    gradientBullish.addColorStop(1, 'rgba(0, 245, 255, 0.2)');

    const gradientBearish = ctx.createLinearGradient(0, 0, 0, 300);
    gradientBearish.addColorStop(0, 'rgba(34, 197, 94, 0.8)');
    gradientBearish.addColorStop(1, 'rgba(34, 197, 94, 0.2)');

    charts.sentiment = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Bullish', 'Bearish'],
            datasets: [{
                data: [sentiment.bullish, sentiment.bearish],
                backgroundColor: [gradientBullish, gradientBearish],
                borderColor: [COLORS.neon.cyan, COLORS.neon.green],
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(10, 10, 26, 0.9)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    titleColor: '#fff',
                    bodyColor: 'rgba(255, 255, 255, 0.8)',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const total = sentiment.bullish + sentiment.bearish;
                            const percent = ((context.raw / total) * 100).toFixed(1);
                            return `Count: ${context.raw} (${percent}%)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.5)' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: 'rgba(255, 255, 255, 0.7)', font: { weight: '500' } }
                }
            }
        },
        plugins: [{
            afterDatasetsDraw: function(chart) {
                const ctx = chart.ctx;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((bar, index) => {
                        const data = dataset.data[index];
                        ctx.fillStyle = '#fff';
                        ctx.font = 'bold 16px Inter';
                        ctx.textAlign = 'center';
                        ctx.fillText(data.toLocaleString(), bar.x, bar.y - 10);
                    });
                });
            }
        }]
    });
}

function createTypeDistributionChart(distribution) {
    const ctx = document.getElementById('typeDistributionChart').getContext('2d');
    if (charts.typeDistribution) charts.typeDistribution.destroy();

    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    const labels = Object.keys(distribution).map(key => CANDLE_TYPES[key]);
    const data = Object.values(distribution);

    charts.typeDistribution = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: COLORS.types,
                borderColor: 'rgba(10, 10, 26, 1)',
                borderWidth: 3,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '55%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        boxHeight: 12,
                        padding: 10,
                        font: { size: 10 },
                        color: 'rgba(255, 255, 255, 0.7)',
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 10, 26, 0.9)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const percent = ((value / total) * 100).toFixed(2);
                            return ` ${value.toLocaleString()} (${percent}%)`;
                        }
                    }
                }
            }
        }
    });
}

function createAvgDistanceChart(averages) {
    const ctx = document.getElementById('avgDistanceChart').getContext('2d');
    if (charts.avgDistance) charts.avgDistance.destroy();

    const typeOrder = [2, 4, 6, 0, 7, 1, 5, 3];
    const labels = typeOrder.map(t => CANDLE_TYPES[t]);

    const metrics = ['high_open_dist', 'upper_wick', 'body_size', 'lower_wick', 'open_low_dist'];

    const datasets = metrics.map((metric) => ({
        label: metric,
        data: typeOrder.map(type => averages[type][metric]),
        backgroundColor: COLORS.distanceMetrics[metric],
        borderColor: COLORS.distanceMetrics[metric].replace('0.8', '1'),
        borderWidth: 1,
        borderRadius: 4,
    }));

    charts.avgDistance = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        boxHeight: 12,
                        padding: 15,
                        font: { size: 10 },
                        color: 'rgba(255, 255, 255, 0.7)',
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 10, 26, 0.9)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: $${context.raw.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 9 },
                        color: 'rgba(255, 255, 255, 0.6)',
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.5)' }
                }
            }
        }
    });
}

function createBullBearPieChart(bullish, bearish) {
    const ctx = document.getElementById('bullBearPieChart').getContext('2d');
    if (charts.bullBearPie) charts.bullBearPie.destroy();

    const total = bullish + bearish;

    charts.bullBearPie = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Bearish', 'Bullish'],
            datasets: [{
                data: [bearish, bullish],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(0, 245, 255, 0.8)'
                ],
                borderColor: 'rgba(10, 10, 26, 1)',
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        boxHeight: 12,
                        padding: 15,
                        font: { size: 11 },
                        color: 'rgba(255, 255, 255, 0.7)',
                        usePointStyle: true,
                        pointStyle: 'circle',
                        generateLabels: function(chart) {
                            const data = chart.data;
                            const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                            return data.labels.map((label, i) => {
                                const value = data.datasets[0].data[i];
                                const percent = total > 0 ? ((value / total) * 100).toFixed(0) : 0;
                                return {
                                    text: `${label} (${percent}%)`,
                                    fillStyle: data.datasets[0].backgroundColor[i],
                                    hidden: false,
                                    index: i
                                };
                            });
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 10, 26, 0.9)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return ` ${value.toLocaleString()} (${percent}%)`;
                        }
                    }
                }
            }
        }
    });
}

function createNextCandleDistChart(percentages, distribution) {
    const ctx = document.getElementById('nextCandleDistChart').getContext('2d');
    if (charts.nextCandleDist) charts.nextCandleDist.destroy();

    const entries = Object.entries(percentages)
        .filter(([type, percent]) => percent > 0)
        .sort((a, b) => b[1] - a[1]);

    const labels = entries.map(([type]) => CANDLE_TYPES[type]);
    const data = entries.map(([, percent]) => percent);
    const colors = entries.map(([type]) => COLORS.types[parseInt(type)]);

    // Create gradient
    const gradients = entries.map(([type], index) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, colors[index]);
        gradient.addColorStop(1, colors[index].replace('0.8', '0.2'));
        return gradient;
    });

    charts.nextCandleDist = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: gradients,
                borderColor: colors.map(c => c.replace('0.8', '1')),
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(10, 10, 26, 0.9)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.raw.toFixed(2)}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)',
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 9 },
                        color: 'rgba(255, 255, 255, 0.6)',
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        },
        plugins: [{
            afterDatasetsDraw: function(chart) {
                const ctx = chart.ctx;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((bar, index) => {
                        const data = dataset.data[index];
                        if (data > 5) { // Only show label if bar is tall enough
                            ctx.fillStyle = '#fff';
                            ctx.font = 'bold 11px Inter';
                            ctx.textAlign = 'center';
                            ctx.fillText(data.toFixed(1) + '%', bar.x, bar.y - 8);
                        }
                    });
                });
            }
        }]
    });
}

// ============================================
// UI Functions
// ============================================

function populateDropdowns(defaultValues = {}) {
    const dropdowns = ['prevCandle1', 'prevCandle2', 'prevCandle3'];

    dropdowns.forEach(id => {
        const select = document.getElementById(id);
        Object.keys(CANDLE_TYPES).forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = CANDLE_TYPES[key];
            select.appendChild(option);
        });

        // Set default value if provided
        if (defaultValues[id] !== undefined && defaultValues[id] !== null) {
            select.value = defaultValues[id].toString();
        }
    });
}

function getLatestCandlePattern(data) {
    // Get last 3 candle types from latest data
    // prev1 = วันล่าสุด (row สุดท้าย)
    // prev2 = ย้อนไป 1 วัน (row ก่อนสุดท้าย)
    // prev3 = ย้อนไป 2 วัน (row ก่อนสุดท้าย 2 ตัว)

    const len = data.length;

    if (len < 3) {
        return { prevCandle1: '', prevCandle2: '', prevCandle3: '' };
    }

    const prev1 = data[len - 1]?.candle_type; // วันล่าสุด
    const prev2 = data[len - 2]?.candle_type; // ย้อนไป 1 วัน
    const prev3 = data[len - 3]?.candle_type; // ย้อนไป 2 วัน

    console.log(`Latest pattern: prev1=${CANDLE_TYPES[prev1]}, prev2=${CANDLE_TYPES[prev2]}, prev3=${CANDLE_TYPES[prev3]}`);
    console.log(`Dates: ${data[len-1]?.datetime}, ${data[len-2]?.datetime}, ${data[len-3]?.datetime}`);

    return {
        prevCandle1: prev1,
        prevCandle2: prev2,
        prevCandle3: prev3
    };
}

function updatePatternPredictor() {
    const prev1 = document.getElementById('prevCandle1').value;
    const prev2 = document.getElementById('prevCandle2').value;
    const prev3 = document.getElementById('prevCandle3').value;

    const filteredData = filterDataByPattern(rawData, prev1, prev2, prev3);
    const result = calculateNextCandleDistribution(filteredData);

    // Update cards with animation
    const topCandleEl = document.getElementById('topCandleName');
    const topPercentEl = document.getElementById('topCandlePercent');
    const totalCountEl = document.getElementById('totalPatternCount');

    topCandleEl.textContent = result.topName;
    topPercentEl.textContent = (result.topPercent).toFixed(2) + '%';
    totalCountEl.textContent = result.total.toLocaleString();

    // Update subtitle
    document.getElementById('distributionSubtitle').textContent =
        `Samples: ${result.total.toLocaleString()} | Top: ${result.topName} (${result.topPercent.toFixed(2)}%)`;

    // Update title with pattern info
    if (prev1 !== '' || prev2 !== '' || prev3 !== '') {
        let titleParts = [];
        if (prev1 !== '') titleParts.push(`P1: ${CANDLE_TYPES[prev1]}`);
        if (prev2 !== '') titleParts.push(`P2: ${CANDLE_TYPES[prev2]}`);
        if (prev3 !== '') titleParts.push(`P3: ${CANDLE_TYPES[prev3]}`);
        document.getElementById('distributionTitle').textContent =
            `Next Candle Distribution | ${titleParts.join(' | ')}`;
    } else {
        document.getElementById('distributionTitle').textContent =
            'Next Candle Type Distribution';
    }

    // Update charts
    createBullBearPieChart(result.bullish, result.bearish);
    createNextCandleDistChart(result.percentages, result.distribution);
}

function updateHeroStats(data) {
    const totalRecords = data.length;
    const firstDate = data[0]?.datetime || '-';
    const lastDate = data[data.length - 1]?.datetime || '-';
    const firstClose = data[0]?.close || 0;
    const latestClose = data[data.length - 1]?.close || 0;
    const change = latestClose - firstClose;
    const changePercent = firstClose > 0 ? ((change / firstClose) * 100).toFixed(1) : 0;

    // Calculate years
    const startYear = firstDate.split('-')[0];
    const endYear = lastDate.split('-')[0];
    const years = endYear - startYear;

    // Update hero stats
    document.getElementById('statTotalDays').textContent = totalRecords.toLocaleString();
    document.getElementById('statLatestPrice').textContent = `$${latestClose.toFixed(0)}`;
    document.getElementById('stat10YChange').textContent = `+${changePercent}%`;
    document.getElementById('statDateRange').textContent = `${years}`;

    // Update header date
    document.getElementById('headerDate').textContent = `Last: ${lastDate}`;
}

// ============================================
// Main Initialization
// ============================================

async function init() {
    try {
        rawData = await loadData();
        console.log(`Loaded ${rawData.length} records`);

        // Filter out invalid data
        rawData = rawData.filter(row =>
            row.candle_type !== null &&
            row.candle_type !== undefined &&
            !isNaN(row.candle_type)
        );
        console.log(`Filtered to ${rawData.length} valid records`);

        // Hide loading, show dashboard
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');

        // Update hero stats
        updateHeroStats(rawData);

        // Calculate and create charts
        const sentiment = calculateSentiment(rawData);
        const typeDistribution = calculateTypeDistribution(rawData);
        const avgDistances = calculateAvgDistanceByType(rawData);

        createSentimentChart(sentiment);
        createTypeDistributionChart(typeDistribution);
        createAvgDistanceChart(avgDistances);

        // Create Candle Type Cards
        createCandleTypeCards(avgDistances, typeDistribution);

        // Setup pattern predictor with latest data as default
        const latestPattern = getLatestCandlePattern(rawData);
        populateDropdowns(latestPattern);
        updatePatternPredictor();

        // Add event listeners
        ['prevCandle1', 'prevCandle2', 'prevCandle3'].forEach(id => {
            document.getElementById(id).addEventListener('change', updatePatternPredictor);
        });

        console.log('Dashboard initialized successfully!');

    } catch (error) {
        console.error('Error initializing dashboard:', error);
        document.getElementById('loading').innerHTML = `
            <div class="text-center">
                <div class="text-6xl mb-4">&#9888;</div>
                <p class="text-xl font-bold text-red-400">Error Loading Data</p>
                <p class="mt-2 text-gray-400">${error.message}</p>
                <p class="mt-4 text-sm text-gray-500">
                    Make sure <code class="bg-dark-700 px-2 py-1 rounded">xauusd_10years_data.csv</code> is in the same directory
                </p>
            </div>
        `;
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', init);
