// Gold Candle Analysis Dashboard - Dashboard Page JavaScript
// Version 4.0 - Multi-Market Support

// ============================================
// Period Filter Helper
// ============================================

function filterDataByPeriod(data, days) {
    if (!data || data.length === 0) return data;
    const numDays = parseInt(days);
    if (numDays >= data.length) return data;
    return data.slice(-numDays);
}

function updatePeriodInfo(selectId, infoId) {
    const select = document.getElementById(selectId);
    const info = document.getElementById(infoId);
    if (select && info) {
        const days = parseInt(select.value);
        const actualDays = Math.min(days, rawData.length);
        info.textContent = `(${actualDays.toLocaleString()} days)`;
    }
}

// ============================================
// Dashboard Specific Functions
// ============================================

async function updateHeroStats(data) {
    const firstRow = data[0];
    const lastRow = data[data.length - 1];

    const latestPrice = lastRow.close || 0;
    const firstPrice = firstRow.open || 1;
    const change10Y = ((latestPrice - firstPrice) / firstPrice * 100);

    const firstDate = parseDate(firstRow.datetime);
    const lastDate = parseDate(lastRow.datetime);
    const years = Math.round((lastDate - firstDate) / (365.25 * 24 * 60 * 60 * 1000));

    // Calculate Futures Basis (GC1! - XAUUSD)
    let basisText = '-';
    try {
        const allData = await loadAllMarketsData();
        if (allData.xauusd && allData.gc1 && allData.xauusd.length > 0 && allData.gc1.length > 0) {
            const latestXauusd = allData.xauusd[allData.xauusd.length - 1];
            const latestGc1 = allData.gc1[allData.gc1.length - 1];
            const basis = latestGc1.close - latestXauusd.close;
            const sign = basis >= 0 ? '+' : '';
            basisText = sign + '$' + basis.toFixed(2);
        }
    } catch (e) {
        console.warn('Could not calculate basis:', e);
    }

    document.getElementById('statBasis').textContent = basisText;
    document.getElementById('statLatestPrice').textContent = '$' + latestPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('stat10YChange').textContent = (change10Y >= 0 ? '+' : '') + change10Y.toFixed(2) + '%';
    document.getElementById('statDateRange').textContent = years + ' Years';

    document.getElementById('headerDate').textContent = lastRow.datetime || 'Latest';
}

function calculateAvgDistanceByType(data) {
    const sums = {};
    const counts = {};

    Object.keys(CANDLE_TYPES).forEach(type => {
        sums[type] = { high_open_dist: 0, upper_wick: 0, body_size: 0, lower_wick: 0, open_low_dist: 0 };
        counts[type] = 0;
    });

    data.forEach(row => {
        const type = row.candle_type;
        if (type !== null && type !== undefined && sums.hasOwnProperty(type)) {
            sums[type].high_open_dist += row.high_open_dist || 0;
            sums[type].upper_wick += row.upper_wick || 0;
            sums[type].body_size += row.body_size || 0;
            sums[type].lower_wick += row.lower_wick || 0;
            sums[type].open_low_dist += row.open_low_dist || 0;
            counts[type]++;
        }
    });

    const averages = {};
    Object.keys(sums).forEach(type => {
        const count = counts[type] || 1;
        averages[type] = {
            high_open_dist: sums[type].high_open_dist / count,
            upper_wick: sums[type].upper_wick / count,
            body_size: sums[type].body_size / count,
            lower_wick: sums[type].lower_wick / count,
            open_low_dist: sums[type].open_low_dist / count
        };
    });

    return averages;
}

// ============================================
// Chart Creation
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
                borderSkipped: false
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
                            const total = sentiment.bullish + sentiment.bearish;
                            const percent = ((context.raw / total) * 100).toFixed(1);
                            return `Count: ${context.raw.toLocaleString()} (${percent}%)`;
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

    // Order types for better visualization
    const typeOrder = [2, 4, 6, 0, 7, 1, 5, 3];
    const labels = typeOrder.map(t => CANDLE_TYPES[t]);

    const metrics = ['high_open_dist', 'upper_wick', 'body_size', 'lower_wick', 'open_low_dist'];
    const metricColors = {
        high_open_dist: 'rgba(59, 130, 246, 0.8)',
        upper_wick: 'rgba(168, 85, 247, 0.8)',
        body_size: 'rgba(156, 163, 175, 0.8)',
        lower_wick: 'rgba(251, 191, 36, 0.8)',
        open_low_dist: 'rgba(249, 115, 22, 0.8)'
    };

    const datasets = metrics.map((metric) => ({
        label: metric,
        data: typeOrder.map(type => averages[type][metric]),
        backgroundColor: metricColors[metric],
        borderColor: metricColors[metric].replace('0.8', '1'),
        borderWidth: 1,
        borderRadius: 4
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
            labels: ['Bullish', 'Bearish'],
            datasets: [{
                data: [bullish, bearish],
                backgroundColor: ['rgba(0, 245, 255, 0.8)', 'rgba(34, 197, 94, 0.8)'],
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
                        font: { size: 11, weight: '500' },
                        color: '#ffffff',
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
                                    fontColor: '#ffffff',
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

    // Sort by percentage (high to low)
    const entries = Object.entries(percentages)
        .filter(([type, percent]) => percent > 0)
        .sort((a, b) => b[1] - a[1]);

    const labels = entries.map(([type]) => CANDLE_TYPES[type]);
    const data = entries.map(([, percent]) => percent);
    const colors = entries.map(([type]) => COLORS.types[parseInt(type)]);

    // Create gradient for each bar
    const gradients = entries.map(([type], index) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, colors[index]);
        gradient.addColorStop(1, colors[index].replace('0.8', '0.2'));
        return gradient;
    });

    charts.nextCandleDist = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: gradients,
                borderColor: colors.map(c => c.replace('0.8', '1')),
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false
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
// Pattern Predictor Functions
// ============================================

function filterDataByPattern(data, prev1, prev2, prev3) {
    return data.filter(row => {
        const match1 = prev1 === '' || row.prev_candle_1 == prev1;
        const match2 = prev2 === '' || row.prev_candle_2 == prev2;
        const match3 = prev3 === '' || row.prev_candle_3 == prev3;
        return match1 && match2 && match3;
    });
}

function calculateNextCandleDistribution(filteredData) {
    const counts = {};
    Object.keys(CANDLE_TYPES).forEach(key => counts[key] = 0);

    filteredData.forEach(row => {
        const type = row.candle_type;
        if (type !== null && type !== undefined && counts.hasOwnProperty(type)) {
            counts[type]++;
        }
    });

    const total = filteredData.length;
    const percentages = {};
    Object.keys(counts).forEach(key => {
        percentages[key] = total > 0 ? (counts[key] / total * 100) : 0;
    });

    let topType = 0;
    let topPercent = 0;
    Object.keys(percentages).forEach(key => {
        if (percentages[key] > topPercent) {
            topPercent = percentages[key];
            topType = parseInt(key);
        }
    });

    let bullish = 0, bearish = 0;
    Object.keys(counts).forEach(key => {
        if (parseInt(key) % 2 === 0) bullish += counts[key];
        else bearish += counts[key];
    });

    return { counts, percentages, topType, topPercent, bullish, bearish, total };
}

function populateDropdowns(defaultValues) {
    const selects = ['prevCandle1', 'prevCandle2', 'prevCandle3'];
    const defaults = [defaultValues.prevCandle1, defaultValues.prevCandle2, defaultValues.prevCandle3];

    selects.forEach((selectId, index) => {
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">-- All --</option>';

        Object.keys(CANDLE_TYPES).forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = CANDLE_TYPES[key];
            if (defaults[index] !== undefined && defaults[index] !== '' && parseInt(defaults[index]) === parseInt(key)) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.addEventListener('change', updatePatternPredictor);
    });
}

function getLatestCandlePattern(data) {
    const len = data.length;
    if (len < 3) return { prevCandle1: '', prevCandle2: '', prevCandle3: '' };

    return {
        prevCandle1: data[len - 1]?.candle_type,
        prevCandle2: data[len - 2]?.candle_type,
        prevCandle3: data[len - 3]?.candle_type
    };
}

// Fallback logic: ถ้าไม่พบข้อมูล ให้ตัดวันออกทีละวัน
function getPatternWithFallback(data) {
    const pattern = getLatestCandlePattern(data);
    let prev1 = pattern.prevCandle1;
    let prev2 = pattern.prevCandle2;
    let prev3 = pattern.prevCandle3;

    // Try 3 days
    let filtered = filterDataByPattern(data, prev1, prev2, prev3);
    if (filtered.length > 0) {
        return { prevCandle1: prev1, prevCandle2: prev2, prevCandle3: prev3, usedDays: 3 };
    }

    // Fallback: Try 2 days (remove prev3)
    filtered = filterDataByPattern(data, prev1, prev2, '');
    if (filtered.length > 0) {
        return { prevCandle1: prev1, prevCandle2: prev2, prevCandle3: '', usedDays: 2 };
    }

    // Fallback: Try 1 day (remove prev2)
    filtered = filterDataByPattern(data, prev1, '', '');
    if (filtered.length > 0) {
        return { prevCandle1: prev1, prevCandle2: '', prevCandle3: '', usedDays: 1 };
    }

    // Fallback: Use all data
    return { prevCandle1: '', prevCandle2: '', prevCandle3: '', usedDays: 0 };
}

function updatePatternPredictor() {
    const prev1 = document.getElementById('prevCandle1').value;
    const prev2 = document.getElementById('prevCandle2').value;
    const prev3 = document.getElementById('prevCandle3').value;

    const filtered = filterDataByPattern(rawData, prev1, prev2, prev3);
    const dist = calculateNextCandleDistribution(filtered);

    document.getElementById('topCandleName').textContent = CANDLE_TYPES[dist.topType] || '-';
    document.getElementById('topCandlePercent').textContent = dist.topPercent.toFixed(2) + '%';
    document.getElementById('totalPatternCount').textContent = dist.total.toLocaleString();

    document.getElementById('distributionSubtitle').textContent =
        `Samples: ${dist.total.toLocaleString()} | Top: ${CANDLE_TYPES[dist.topType] || '-'}`;

    createBullBearPieChart(dist.bullish, dist.bearish);
    createNextCandleDistChart(dist.percentages, dist.counts);
}

// ============================================
// Candle Type Cards
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

function drawCandleSVG(type) {
    const isBullish = type % 2 === 0;
    const color = isBullish ? '#22c55e' : '#ef4444';

    const svgWidth = 60;
    const svgHeight = 100;
    const centerX = svgWidth / 2;
    const bodyWidth = 24;

    let upperWickHeight, bodyHeight, lowerWickHeight;

    switch(parseInt(type)) {
        case 0: case 1: // Doji
            upperWickHeight = 35;
            bodyHeight = 5;
            lowerWickHeight = 35;
            break;
        case 2: case 3: // Full Body
            upperWickHeight = 8;
            bodyHeight = 65;
            lowerWickHeight = 8;
            break;
        case 4: case 5: // Normal
            upperWickHeight = 20;
            bodyHeight = 40;
            lowerWickHeight = 20;
            break;
        case 6: case 7: // Long Wick
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

    return `
        <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
            <line x1="${centerX}" y1="${upperWickY}" x2="${centerX}" y2="${bodyY}"
                  stroke="${color}" stroke-width="2"/>
            <rect x="${centerX - bodyWidth/2}" y="${bodyY}"
                  width="${bodyWidth}" height="${bodyHeight}"
                  fill="${color}" stroke="${color}" stroke-width="2" rx="2"/>
            <line x1="${centerX}" y1="${lowerWickY}" x2="${centerX}" y2="${lowerWickY + lowerWickHeight}"
                  stroke="${color}" stroke-width="2"/>
        </svg>
    `;
}

function createCandleTypeCards(averages, distribution, periodLabel = '10 years') {
    const grid = document.getElementById('candleTypesGrid');
    if (!grid) return;

    grid.innerHTML = '';
    const typeOrder = [0, 2, 4, 6, 1, 3, 5, 7];

    typeOrder.forEach(type => {
        const isBullish = type % 2 === 0;
        const avg = averages[type];
        const count = distribution[type] || 0;

        const card = document.createElement('div');
        card.className = `candle-type-card ${isBullish ? 'bullish' : 'bearish'}`;

        card.innerHTML = `
            <div class="candle-visual">${drawCandleSVG(type)}</div>
            <div class="candle-type-name">${CANDLE_TYPES[type]}</div>
            <div class="candle-type-code">Type ${type} | ${CANDLE_DESCRIPTIONS[type]}</div>
            <div class="candle-metrics">
                <div class="metric-row"><span class="metric-label">high_open_dist</span><span class="metric-value">$${avg.high_open_dist.toFixed(2)}</span></div>
                <div class="metric-row"><span class="metric-label">upper_wick</span><span class="metric-value">$${avg.upper_wick.toFixed(2)}</span></div>
                <div class="metric-row"><span class="metric-label">body_size</span><span class="metric-value">$${avg.body_size.toFixed(2)}</span></div>
                <div class="metric-row"><span class="metric-label">lower_wick</span><span class="metric-value">$${avg.lower_wick.toFixed(2)}</span></div>
                <div class="metric-row"><span class="metric-label">open_low_dist</span><span class="metric-value">$${avg.open_low_dist.toFixed(2)}</span></div>
            </div>
            <div class="candle-count">
                <div class="count-value ${isBullish ? 'bullish' : 'bearish'}">${count.toLocaleString()}</div>
                <div class="count-label">occurrences in ${periodLabel}</div>
            </div>
        `;

        grid.appendChild(card);
    });
}

// ============================================
// Initialize Dashboard
// ============================================

function getPeriodLabel(days) {
    const numDays = parseInt(days);
    if (numDays >= 3650) return '10 years';
    if (numDays >= 1825) return '5 years';
    if (numDays >= 1095) return '3 years';
    if (numDays >= 730) return '2 years';
    return '1 year';
}

function updateDistanceChart() {
    const select = document.getElementById('distancePeriodSelect');
    if (!select) return;

    const days = parseInt(select.value);
    const filteredData = filterDataByPeriod(rawData, days);
    const avgDistances = calculateAvgDistanceByType(filteredData);

    createAvgDistanceChart(avgDistances);
    updatePeriodInfo('distancePeriodSelect', 'distancePeriodInfo');
}

function updateCandleTypesCards() {
    const select = document.getElementById('candleTypesPeriodSelect');
    if (!select) return;

    const days = parseInt(select.value);
    const filteredData = filterDataByPeriod(rawData, days);
    const avgDistances = calculateAvgDistanceByType(filteredData);
    const typeDistribution = calculateTypeDistribution(filteredData);
    const periodLabel = getPeriodLabel(days);

    createCandleTypeCards(avgDistances, typeDistribution, periodLabel);
    updatePeriodInfo('candleTypesPeriodSelect', 'candleTypesPeriodInfo');
}

function initPeriodSelectors() {
    // Distance chart period selector
    const distanceSelect = document.getElementById('distancePeriodSelect');
    if (distanceSelect) {
        distanceSelect.addEventListener('change', updateDistanceChart);
        updatePeriodInfo('distancePeriodSelect', 'distancePeriodInfo');
    }

    // Candle types period selector
    const candleTypesSelect = document.getElementById('candleTypesPeriodSelect');
    if (candleTypesSelect) {
        candleTypesSelect.addEventListener('change', updateCandleTypesCards);
        updatePeriodInfo('candleTypesPeriodSelect', 'candleTypesPeriodInfo');
    }
}

async function renderDashboard(data) {
    // Use 1 year data by default for period-filtered sections
    const defaultPeriod = 365;
    const filteredData = filterDataByPeriod(data, defaultPeriod);

    const sentiment = calculateSentiment(data);
    const typeDistribution = calculateTypeDistribution(filteredData);
    const avgDistances = calculateAvgDistanceByType(filteredData);

    await updateHeroStats(data);
    createSentimentChart(sentiment);
    createTypeDistributionChart(typeDistribution);
    createAvgDistanceChart(avgDistances);
    createCandleTypeCards(avgDistances, typeDistribution, '1 year');

    // Use fallback pattern if no data found
    const latestPattern = getPatternWithFallback(data);
    console.log('Pattern with fallback:', latestPattern, 'Used days:', latestPattern.usedDays);
    populateDropdowns(latestPattern);
    updatePatternPredictor();

    // Update period info labels
    updatePeriodInfo('distancePeriodSelect', 'distancePeriodInfo');
    updatePeriodInfo('candleTypesPeriodSelect', 'candleTypesPeriodInfo');
}

async function init() {
    try {
        rawData = await loadData();
        console.log('Data loaded:', rawData.length, 'rows for', currentMarket);

        await renderDashboard(rawData);

        hideLoading();
        showContent();
        initSidebar();

        // Initialize period selectors
        initPeriodSelectors();

        // Initialize market selector with callback
        initMarketSelector(async (newData) => {
            await renderDashboard(newData);
            // Re-initialize period info after market change
            updatePeriodInfo('distancePeriodSelect', 'distancePeriodInfo');
            updatePeriodInfo('candleTypesPeriodSelect', 'candleTypesPeriodInfo');
        });

        // Update market badge
        updateMarketSelector();

    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('loading').innerHTML = `
            <p style="color: var(--neon-red);">Error loading data</p>
            <p style="color: var(--text-muted); font-size: 0.875rem;">${error.message}</p>
        `;
    }
}

// Start
init();
