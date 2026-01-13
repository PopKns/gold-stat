// Compare Side-by-Side - JavaScript
// Version 4.0

let xauusdData = [];
let gc1Data = [];

document.addEventListener('DOMContentLoaded', async () => {
    initSidebar();
    setCurrentDate();

    try {
        // Load both markets data
        const allData = await loadAllMarketsData();
        xauusdData = allData.xauusd || [];
        gc1Data = allData.gc1 || [];

        if (xauusdData.length > 0 && gc1Data.length > 0) {
            renderComparison();
        } else {
            showError();
        }
    } catch (error) {
        console.error('Error loading data:', error);
        showError();
    }

    hideLoading();
    showContent();
});

function showError() {
    document.getElementById('content').innerHTML = `
        <div class="page-header">
            <p class="page-subtitle">ERROR</p>
            <h1 class="page-title"><span class="gradient">Data Not Available</span></h1>
            <p class="page-desc">Please ensure both xauusd_10years_data.csv and gc1_10years_data.csv exist.</p>
        </div>
    `;
}

function renderComparison() {
    renderPriceCards();
    renderStatsTable();
    renderTypeCompareChart();
    renderDOWCompareChart();
}

function renderPriceCards() {
    // Get latest data
    const latestXauusd = xauusdData[xauusdData.length - 1];
    const latestGc1 = gc1Data[gc1Data.length - 1];

    if (!latestXauusd || !latestGc1) return;

    // XAUUSD
    document.getElementById('xauusdPrice').textContent = `$${latestXauusd.close.toFixed(2)}`;
    const xauusdChange = latestXauusd.close - latestXauusd.open;
    const xauusdChangePct = (xauusdChange / latestXauusd.open * 100);
    document.getElementById('xauusdChange').innerHTML = `
        <span class="${xauusdChange >= 0 ? 'positive' : 'negative'}">
            ${xauusdChange >= 0 ? '&#9650;' : '&#9660;'}
            $${Math.abs(xauusdChange).toFixed(2)} (${xauusdChangePct >= 0 ? '+' : ''}${xauusdChangePct.toFixed(2)}%)
        </span>
    `;
    document.getElementById('xauusdCandleType').textContent = CANDLE_TYPES[latestXauusd.candle_type] || '-';
    drawCandle('xauusdCandle', latestXauusd, isBullish(latestXauusd.candle_type));

    // GC1!
    document.getElementById('gc1Price').textContent = `$${latestGc1.close.toFixed(2)}`;
    const gc1Change = latestGc1.close - latestGc1.open;
    const gc1ChangePct = (gc1Change / latestGc1.open * 100);
    document.getElementById('gc1Change').innerHTML = `
        <span class="${gc1Change >= 0 ? 'positive' : 'negative'}">
            ${gc1Change >= 0 ? '&#9650;' : '&#9660;'}
            $${Math.abs(gc1Change).toFixed(2)} (${gc1ChangePct >= 0 ? '+' : ''}${gc1ChangePct.toFixed(2)}%)
        </span>
    `;
    document.getElementById('gc1CandleType').textContent = CANDLE_TYPES[latestGc1.candle_type] || '-';
    drawCandle('gc1Candle', latestGc1, isBullish(latestGc1.candle_type));

    // Basis (Futures - Spot)
    const basis = latestGc1.close - latestXauusd.close;
    const basisPct = (basis / latestXauusd.close * 100);
    document.getElementById('priceBasis').textContent = `$${basis.toFixed(2)}`;
    document.getElementById('basisPct').textContent = `${basisPct.toFixed(3)}%`;

    // Type match
    const typesMatch = latestXauusd.candle_type === latestGc1.candle_type;
    const directionsMatch = isBullish(latestXauusd.candle_type) === isBullish(latestGc1.candle_type);

    document.getElementById('typeMatchToday').textContent = typesMatch ? 'Match' : directionsMatch ? 'Direction Match' : 'Divergence';

    // Warning box
    const warningBox = document.getElementById('typeMatchWarning');
    const warningMsg = document.getElementById('typeMatchMessage');

    if (!directionsMatch) {
        warningBox.style.display = 'flex';
        warningBox.classList.remove('match');
        warningMsg.textContent = `Divergence detected! XAUUSD: ${CANDLE_TYPES[latestXauusd.candle_type]}, GC1!: ${CANDLE_TYPES[latestGc1.candle_type]}`;
    } else if (typesMatch) {
        warningBox.style.display = 'flex';
        warningBox.classList.add('match');
        warningMsg.textContent = `Both markets show the same pattern: ${CANDLE_TYPES[latestXauusd.candle_type]}`;
    } else {
        warningBox.style.display = 'none';
    }
}

function drawCandle(svgId, data, bullish) {
    const svg = document.getElementById(svgId);
    if (!svg) return;

    const color = bullish ? '#22c55e' : '#ef4444';
    const range = data.high - data.low;
    if (range === 0) return;

    const scale = 100 / range;
    const bodyTop = Math.max(data.open, data.close);
    const bodyBottom = Math.min(data.open, data.close);

    const wickTop = 10 + (data.high - data.high) * scale;
    const wickBottom = 10 + (data.high - data.low) * scale;
    const bodyY = 10 + (data.high - bodyTop) * scale;
    const bodyHeight = Math.max((bodyTop - bodyBottom) * scale, 2);

    svg.innerHTML = `
        <!-- Wick -->
        <line x1="30" y1="${wickTop}" x2="30" y2="${bodyY}" stroke="${color}" stroke-width="2"/>
        <line x1="30" y1="${bodyY + bodyHeight}" x2="30" y2="${wickBottom}" stroke="${color}" stroke-width="2"/>
        <!-- Body -->
        <rect x="15" y="${bodyY}" width="30" height="${bodyHeight}"
              fill="${bullish ? color : color}"
              stroke="${color}" stroke-width="1" rx="2"/>
    `;
}

function renderStatsTable() {
    const stats = getComparisonStats(xauusdData, gc1Data);
    const tbody = document.getElementById('statsTableBody');

    const metrics = [
        { name: 'Total Trading Days', xauusd: xauusdData.length, gc1: gc1Data.length, format: 'number' },
        { name: 'Common Trading Days', xauusd: stats.totalDays, gc1: stats.totalDays, format: 'number' },
        { name: 'Bullish Days %', xauusd: stats.bullishPct.xauusd, gc1: stats.bullishPct.gc1, format: 'pct' },
        { name: 'Avg Daily Range', xauusd: stats.avgRange.xauusd, gc1: stats.avgRange.gc1, format: 'price' },
        { name: 'Avg Body Size', xauusd: stats.avgBody.xauusd, gc1: stats.avgBody.gc1, format: 'price' },
        { name: 'Direction Match', xauusd: stats.directionMatch, gc1: stats.directionMatch, format: 'pct', single: true },
        { name: 'Type Match', xauusd: stats.typeMatch, gc1: stats.typeMatch, format: 'pct', single: true },
        { name: 'Price Correlation', xauusd: stats.priceCorr * 100, gc1: stats.priceCorr * 100, format: 'pct', single: true }
    ];

    tbody.innerHTML = metrics.map(m => {
        let xVal, gVal, diff, diffClass;

        if (m.format === 'number') {
            xVal = m.xauusd.toLocaleString();
            gVal = m.gc1.toLocaleString();
            diff = m.gc1 - m.xauusd;
            diffClass = diff > 0 ? 'positive' : diff < 0 ? 'negative' : '';
            diff = diff > 0 ? `+${diff}` : diff;
        } else if (m.format === 'pct') {
            xVal = `${m.xauusd.toFixed(1)}%`;
            gVal = m.single ? '-' : `${m.gc1.toFixed(1)}%`;
            diff = m.single ? '-' : (m.gc1 - m.xauusd).toFixed(1) + '%';
            diffClass = !m.single && (m.gc1 - m.xauusd) > 0 ? 'positive' : !m.single && (m.gc1 - m.xauusd) < 0 ? 'negative' : '';
        } else if (m.format === 'price') {
            xVal = `$${m.xauusd.toFixed(2)}`;
            gVal = `$${m.gc1.toFixed(2)}`;
            diff = m.gc1 - m.xauusd;
            diffClass = diff > 0 ? 'positive' : diff < 0 ? 'negative' : '';
            diff = `${diff > 0 ? '+' : ''}$${diff.toFixed(2)}`;
        }

        return `
            <tr>
                <td class="metric-name">${m.name}</td>
                <td class="xauusd-value">${xVal}</td>
                <td class="gc1-value">${m.single ? xVal : gVal}</td>
                <td class="diff-value ${diffClass}">${m.single ? '-' : diff}</td>
            </tr>
        `;
    }).join('');

    // Insight
    const insight = document.getElementById('statsInsight');
    const rangeDiff = stats.avgRange.gc1 - stats.avgRange.xauusd;
    const bodyDiff = stats.avgBody.gc1 - stats.avgBody.xauusd;

    insight.innerHTML = `
        <strong>Futures (GC1!)</strong> shows ${rangeDiff > 0 ? 'higher' : 'lower'} volatility with
        <strong>$${Math.abs(rangeDiff).toFixed(2)}</strong> ${rangeDiff > 0 ? 'wider' : 'narrower'} average daily range.
        Direction agreement is <strong>${stats.directionMatch.toFixed(1)}%</strong>,
        meaning both markets move in the same direction on most days.
        Price correlation is <strong>${(stats.priceCorr * 100).toFixed(1)}%</strong>.
    `;
}

function renderTypeCompareChart() {
    const ctx = document.getElementById('typeCompareChart');
    if (!ctx) return;

    // Calculate type distribution for both
    const xauusdTypes = {};
    const gc1Types = {};

    xauusdData.forEach(row => {
        const type = row.candle_type;
        xauusdTypes[type] = (xauusdTypes[type] || 0) + 1;
    });

    gc1Data.forEach(row => {
        const type = row.candle_type;
        gc1Types[type] = (gc1Types[type] || 0) + 1;
    });

    const labels = Object.keys(CANDLE_TYPES).map(k => CANDLE_TYPES[k]);
    const xauusdPcts = Object.keys(CANDLE_TYPES).map(k => ((xauusdTypes[k] || 0) / xauusdData.length * 100));
    const gc1Pcts = Object.keys(CANDLE_TYPES).map(k => ((gc1Types[k] || 0) / gc1Data.length * 100));

    if (charts.typeCompare) charts.typeCompare.destroy();

    charts.typeCompare = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'XAUUSD (CFD)',
                    data: xauusdPcts,
                    backgroundColor: 'rgba(115, 103, 240, 0.7)',
                    borderColor: '#7367F0',
                    borderWidth: 1
                },
                {
                    label: 'GC1! (Futures)',
                    data: gc1Pcts,
                    backgroundColor: 'rgba(251, 191, 36, 0.7)',
                    borderColor: '#fbbf24',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Percentage (%)' }
                }
            }
        }
    });
}

function renderDOWCompareChart() {
    const ctx = document.getElementById('dowCompareChart');
    if (!ctx) return;

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    // Calculate bullish % by day for both markets (1=Monday, 2=Tuesday, ..., 5=Friday)
    const xauusdByDay = { 1: { bull: 0, total: 0 }, 2: { bull: 0, total: 0 }, 3: { bull: 0, total: 0 }, 4: { bull: 0, total: 0 }, 5: { bull: 0, total: 0 } };
    const gc1ByDay = { 1: { bull: 0, total: 0 }, 2: { bull: 0, total: 0 }, 3: { bull: 0, total: 0 }, 4: { bull: 0, total: 0 }, 5: { bull: 0, total: 0 } };

    xauusdData.forEach(row => {
        if (!row.datetime) return;
        const dow = getDayOfWeek(row.datetime); // 0=Sunday, 1=Monday, ..., 6=Saturday
        if (dow >= 1 && dow <= 5) {
            xauusdByDay[dow].total++;
            if (isBullish(row.candle_type)) xauusdByDay[dow].bull++;
        }
    });

    gc1Data.forEach(row => {
        if (!row.datetime) return;
        const dow = getDayOfWeek(row.datetime); // 0=Sunday, 1=Monday, ..., 6=Saturday
        if (dow >= 1 && dow <= 5) {
            gc1ByDay[dow].total++;
            if (isBullish(row.candle_type)) gc1ByDay[dow].bull++;
        }
    });

    const xauusdPcts = days.map((_, i) => xauusdByDay[i + 1].total > 0 ? (xauusdByDay[i + 1].bull / xauusdByDay[i + 1].total * 100) : 0);
    const gc1Pcts = days.map((_, i) => gc1ByDay[i + 1].total > 0 ? (gc1ByDay[i + 1].bull / gc1ByDay[i + 1].total * 100) : 0);

    if (charts.dowCompare) charts.dowCompare.destroy();

    charts.dowCompare = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [
                {
                    label: 'XAUUSD Bullish %',
                    data: xauusdPcts,
                    backgroundColor: 'rgba(115, 103, 240, 0.7)',
                    borderColor: '#7367F0',
                    borderWidth: 1
                },
                {
                    label: 'GC1! Bullish %',
                    data: gc1Pcts,
                    backgroundColor: 'rgba(251, 191, 36, 0.7)',
                    borderColor: '#fbbf24',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'Bullish Percentage (%)' }
                }
            }
        }
    });
}
