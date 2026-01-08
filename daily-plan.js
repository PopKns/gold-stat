// Gold Candle Analysis Dashboard - Daily Trading Plan
// Version 3.1

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
    if (select && info && rawData) {
        const days = parseInt(select.value);
        const actualDays = Math.min(days, rawData.length);
        info.textContent = `(${actualDays.toLocaleString()} days)`;
    }
}

function getPeriodLabel(days) {
    const numDays = parseInt(days);
    if (numDays >= 3650) return '10 years';
    if (numDays >= 1825) return '5 years';
    if (numDays >= 1095) return '3 years';
    if (numDays >= 730) return '2 years';
    return '1 year';
}

// ============================================
// Calculate Average Distance by Type
// ============================================

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
            open_low_dist: sums[type].open_low_dist / count,
            count: counts[type]
        };
    });

    return averages;
}

// ============================================
// Pattern Prediction
// ============================================

function getLatestPattern(data) {
    const len = data.length;
    if (len < 3) return { prev1: null, prev2: null, prev3: null, openPrice: 0 };

    return {
        prev1: data[len - 1]?.candle_type,
        prev2: data[len - 2]?.candle_type,
        prev3: data[len - 3]?.candle_type,
        openPrice: data[len - 1]?.close || 0
    };
}

function filterDataByPattern(data, prev1, prev2, prev3) {
    return data.filter(row => {
        const match1 = prev1 === null || prev1 === '' || row.prev_candle_1 == prev1;
        const match2 = prev2 === null || prev2 === '' || row.prev_candle_2 == prev2;
        const match3 = prev3 === null || prev3 === '' || row.prev_candle_3 == prev3;
        return match1 && match2 && match3;
    });
}

// Fallback logic: ถ้าไม่พบข้อมูล ให้ตัดวันออกทีละวัน
function getPatternWithFallback(data) {
    const pattern = getLatestPattern(data);
    let prev1 = pattern.prev1;
    let prev2 = pattern.prev2;
    let prev3 = pattern.prev3;

    // Try 3 days
    let filtered = filterDataByPattern(data, prev1, prev2, prev3);
    if (filtered.length > 0) {
        return { prev1, prev2, prev3, openPrice: pattern.openPrice, usedDays: 3 };
    }

    // Fallback: Try 2 days (remove prev3)
    filtered = filterDataByPattern(data, prev1, prev2, '');
    if (filtered.length > 0) {
        return { prev1, prev2, prev3: null, openPrice: pattern.openPrice, usedDays: 2 };
    }

    // Fallback: Try 1 day (remove prev2)
    filtered = filterDataByPattern(data, prev1, '', '');
    if (filtered.length > 0) {
        return { prev1, prev2: null, prev3: null, openPrice: pattern.openPrice, usedDays: 1 };
    }

    // Fallback: Use all data
    return { prev1: null, prev2: null, prev3: null, openPrice: pattern.openPrice, usedDays: 0 };
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

    const bullPct = total > 0 ? (bullish / total * 100) : 0;
    const bearPct = total > 0 ? (bearish / total * 100) : 0;

    return { counts, percentages, topType, topPercent, bullish, bearish, bullPct, bearPct, total };
}

// ============================================
// Trade Setup Calculation
// ============================================

function calculateTradeSetup(openPrice, predictedType, avgDistances) {
    const isBullish = predictedType % 2 === 0;
    const metrics = avgDistances[predictedType];

    let entry, entryLow, entryHigh, sl, tp1, tp2;
    let strategy = '';

    if (isBullish) {
        // BUY Setup
        entry = openPrice - metrics.open_low_dist;
        entryLow = entry - 10;  // Entry Zone: entry - 10
        entryHigh = entry;
        sl = entryLow - 10;  // SL: Entry Zone Low - 10
        tp1 = entry + 10;  // TP1: Entry + 10
        tp2 = entry + 20;  // TP2: Entry + 20
        strategy = `รอราคาลงมาทำไส้ล่างบริเวณ Entry Zone ($${entryLow.toFixed(2)} - $${entryHigh.toFixed(2)}) แล้ว Buy เมื่อเห็นสัญญาณกลับตัว เช่น Pin Bar หรือ Bullish Engulfing ตั้ง Stop Loss ใต้ไส้ล่าง`;
    } else {
        // SELL Setup
        entry = openPrice + metrics.high_open_dist;
        entryLow = entry;
        entryHigh = entry + 10;  // Entry Zone: entry to entry + 10
        sl = entryHigh + 10;  // SL: Entry Zone High + 10
        tp1 = entry - 10;  // TP1: Entry - 10
        tp2 = entry - 20;  // TP2: Entry - 20
        strategy = `รอราคาขึ้นไปทำไส้บนบริเวณ Entry Zone ($${entryLow.toFixed(2)} - $${entryHigh.toFixed(2)}) แล้ว Sell เมื่อเห็นสัญญาณกลับตัว เช่น Pin Bar หรือ Bearish Engulfing ตั้ง Stop Loss เหนือไส้บน`;
    }

    // Calculate R:R ratio
    const risk = Math.abs(entry - sl);
    const reward1 = Math.abs(tp1 - entry);
    const reward2 = Math.abs(tp2 - entry);
    const rr1 = risk > 0 ? (reward1 / risk).toFixed(1) : 0;
    const rr2 = risk > 0 ? (reward2 / risk).toFixed(1) : 0;

    return {
        isBullish,
        entry,
        entryLow,
        entryHigh,
        sl,
        tp1,
        tp2,
        risk,
        reward1,
        reward2,
        rr1,
        rr2,
        strategy,
        metrics
    };
}

// ============================================
// Draw Candle SVG
// ============================================

function drawPredictedCandle(type, setup) {
    const isBullish = type % 2 === 0;
    const color = isBullish ? '#22c55e' : '#ef4444';

    const svgWidth = 120;
    const svgHeight = 300;
    const centerX = svgWidth / 2;
    const bodyWidth = 50;

    let upperWickHeight, bodyHeight, lowerWickHeight;

    switch(parseInt(type)) {
        case 0: case 1: // Doji
            upperWickHeight = 80;
            bodyHeight = 10;
            lowerWickHeight = 80;
            break;
        case 2: case 3: // Full Body
            upperWickHeight = 20;
            bodyHeight = 180;
            lowerWickHeight = 20;
            break;
        case 4: case 5: // Normal
            upperWickHeight = 50;
            bodyHeight = 100;
            lowerWickHeight = 50;
            break;
        case 6: case 7: // Long Wick
            upperWickHeight = 100;
            bodyHeight = 60;
            lowerWickHeight = 40;
            break;
        default:
            upperWickHeight = 50;
            bodyHeight = 100;
            lowerWickHeight = 50;
    }

    const margin = 30;
    const upperWickY = margin;
    const bodyY = margin + upperWickHeight;
    const lowerWickY = bodyY + bodyHeight;

    return `
        <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
            <!-- Upper Wick -->
            <line x1="${centerX}" y1="${upperWickY}" x2="${centerX}" y2="${bodyY}"
                  stroke="${color}" stroke-width="4"/>
            <!-- Body -->
            <rect x="${centerX - bodyWidth/2}" y="${bodyY}"
                  width="${bodyWidth}" height="${bodyHeight}"
                  fill="${color}" stroke="${color}" stroke-width="2" rx="4"/>
            <!-- Lower Wick -->
            <line x1="${centerX}" y1="${lowerWickY}" x2="${centerX}" y2="${lowerWickY + lowerWickHeight}"
                  stroke="${color}" stroke-width="4"/>

            <!-- Labels -->
            <text x="${svgWidth - 5}" y="${upperWickY + 5}" fill="${color}" font-size="10" text-anchor="end">High</text>
            <text x="${svgWidth - 5}" y="${bodyY + 15}" fill="${color}" font-size="10" text-anchor="end">${isBullish ? 'Close' : 'Open'}</text>
            <text x="${svgWidth - 5}" y="${lowerWickY - 5}" fill="${color}" font-size="10" text-anchor="end">${isBullish ? 'Open' : 'Close'}</text>
            <text x="${svgWidth - 5}" y="${lowerWickY + lowerWickHeight}" fill="${color}" font-size="10" text-anchor="end">Low</text>
        </svg>
    `;
}

// ============================================
// Draw Pattern Candles (Small)
// ============================================

function drawSmallCandle(type) {
    const isBullish = type % 2 === 0;
    const color = isBullish ? '#22c55e' : '#ef4444';

    const svgWidth = 30;
    const svgHeight = 50;
    const centerX = svgWidth / 2;
    const bodyWidth = 14;

    let upperWickHeight, bodyHeight, lowerWickHeight;

    switch(parseInt(type)) {
        case 0: case 1: upperWickHeight = 15; bodyHeight = 3; lowerWickHeight = 15; break;
        case 2: case 3: upperWickHeight = 4; bodyHeight = 30; lowerWickHeight = 4; break;
        case 4: case 5: upperWickHeight = 10; bodyHeight = 18; lowerWickHeight = 10; break;
        case 6: case 7: upperWickHeight = 18; bodyHeight = 12; lowerWickHeight = 8; break;
        default: upperWickHeight = 10; bodyHeight = 18; lowerWickHeight = 10;
    }

    const margin = 5;
    const upperWickY = margin;
    const bodyY = margin + upperWickHeight;
    const lowerWickY = bodyY + bodyHeight;

    return `
        <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
            <line x1="${centerX}" y1="${upperWickY}" x2="${centerX}" y2="${bodyY}" stroke="${color}" stroke-width="2"/>
            <rect x="${centerX - bodyWidth/2}" y="${bodyY}" width="${bodyWidth}" height="${bodyHeight}" fill="${color}" rx="2"/>
            <line x1="${centerX}" y1="${lowerWickY}" x2="${centerX}" y2="${lowerWickY + lowerWickHeight}" stroke="${color}" stroke-width="2"/>
        </svg>
    `;
}

// ============================================
// Render UI
// ============================================

function renderPatternFlow(pattern, prediction) {
    const container = document.getElementById('patternFlow');
    let html = '';

    // แสดงเฉพาะวันที่ใช้ตาม usedDays
    if (pattern.usedDays >= 3 && pattern.prev3 !== null) {
        html += `
            <div class="pattern-candle">
                <span class="pattern-candle-label">Day -3</span>
                ${drawSmallCandle(pattern.prev3)}
                <span class="pattern-candle-name">${CANDLE_TYPES[pattern.prev3]}</span>
            </div>
            <span class="pattern-arrow">&#8594;</span>
        `;
    }

    if (pattern.usedDays >= 2 && pattern.prev2 !== null) {
        html += `
            <div class="pattern-candle">
                <span class="pattern-candle-label">Day -2</span>
                ${drawSmallCandle(pattern.prev2)}
                <span class="pattern-candle-name">${CANDLE_TYPES[pattern.prev2]}</span>
            </div>
            <span class="pattern-arrow">&#8594;</span>
        `;
    }

    if (pattern.usedDays >= 1 && pattern.prev1 !== null) {
        html += `
            <div class="pattern-candle">
                <span class="pattern-candle-label">Day -1</span>
                ${drawSmallCandle(pattern.prev1)}
                <span class="pattern-candle-name">${CANDLE_TYPES[pattern.prev1]}</span>
            </div>
            <span class="pattern-arrow">&#8594;</span>
        `;
    }

    // ถ้าไม่มีวันใดเลย แสดงข้อความ
    if (pattern.usedDays === 0) {
        html += `
            <div class="pattern-candle">
                <span class="pattern-candle-label">All Data</span>
                <span class="pattern-candle-name" style="color: var(--text-muted);">No specific pattern</span>
            </div>
            <span class="pattern-arrow">&#8594;</span>
        `;
    }

    // แสดงผลลัพธ์การทำนาย
    html += `
        <div class="pattern-candle pattern-result">
            <span class="pattern-candle-label">TODAY?</span>
            ${drawSmallCandle(prediction.topType)}
            <span class="pattern-candle-name">${CANDLE_TYPES[prediction.topType]}</span>
        </div>
    `;

    container.innerHTML = html;
}

// Calculate predicted OHLC prices from metrics
function calculatePredictedPrices(openPrice, metrics, isBullish) {
    const high = openPrice + metrics.high_open_dist;
    const low = openPrice - metrics.open_low_dist;
    const close = isBullish ? openPrice + metrics.body_size : openPrice - metrics.body_size;

    return { open: openPrice, high, low, close };
}

// Render Predicted Prices (Left side)
function renderPredictedPrices(predictedPrices, isBullish) {
    const container = document.getElementById('predictedPrices');

    // Order: High, Close (bullish) or Open (bearish), Open (bullish) or Close (bearish), Low
    const prices = isBullish ? [
        { name: 'High', value: predictedPrices.high, class: 'high' },
        { name: 'Close', value: predictedPrices.close, class: 'close' },
        { name: 'Open', value: predictedPrices.open, class: 'open' },
        { name: 'Low', value: predictedPrices.low, class: 'low' }
    ] : [
        { name: 'High', value: predictedPrices.high, class: 'high' },
        { name: 'Open', value: predictedPrices.open, class: 'open' },
        { name: 'Close', value: predictedPrices.close, class: 'close' },
        { name: 'Low', value: predictedPrices.low, class: 'low' }
    ];

    container.innerHTML = prices.map(price => `
        <div class="predicted-price ${price.class}">
            <div class="predicted-price-info">
                <p class="predicted-price-name">${price.name}</p>
                <p class="predicted-price-value">$${price.value.toFixed(2)}</p>
            </div>
            <div class="predicted-price-line"></div>
        </div>
    `).join('');
}

// Render Trade Levels (Right side)
function renderTradeLevels(setup, openPrice) {
    const container = document.getElementById('tradeLevels');
    const levels = setup.isBullish ? [
        { name: 'TP2', value: setup.tp2, class: 'tp2' },
        { name: 'TP1', value: setup.tp1, class: 'tp1' },
        { name: 'Open', value: openPrice, class: 'open' },
        { name: 'Entry', value: `${setup.entryLow.toFixed(2)} - ${setup.entryHigh.toFixed(2)}`, class: 'entry', isRange: true },
        { name: 'SL', value: setup.sl, class: 'sl' }
    ] : [
        { name: 'SL', value: setup.sl, class: 'sl' },
        { name: 'Entry', value: `${setup.entryLow.toFixed(2)} - ${setup.entryHigh.toFixed(2)}`, class: 'entry', isRange: true },
        { name: 'Open', value: openPrice, class: 'open' },
        { name: 'TP1', value: setup.tp1, class: 'tp1' },
        { name: 'TP2', value: setup.tp2, class: 'tp2' }
    ];

    container.innerHTML = levels.map(level => `
        <div class="trade-level ${level.class}">
            <div class="trade-level-line"></div>
            <div class="trade-level-info">
                <p class="trade-level-name">${level.name}</p>
                <p class="trade-level-value">${level.isRange ? '$' + level.value : '$' + level.value.toFixed(2)}</p>
            </div>
        </div>
    `).join('');
}

function renderCandleMetrics(metrics) {
    const container = document.getElementById('candleMetrics');
    const items = [
        { label: 'high_open_dist', value: metrics.high_open_dist },
        { label: 'upper_wick', value: metrics.upper_wick },
        { label: 'body_size', value: metrics.body_size },
        { label: 'lower_wick', value: metrics.lower_wick },
        { label: 'open_low_dist', value: metrics.open_low_dist }
    ];

    container.innerHTML = items.map(item => `
        <div class="candle-info-item">
            <p class="candle-info-label">${item.label}</p>
            <p class="candle-info-value">$${item.value.toFixed(2)}</p>
        </div>
    `).join('');
}

function renderTradeSetup(setup, prediction) {
    const header = document.getElementById('tradeHeader');
    const typeEl = document.getElementById('tradeType');
    const badgeEl = document.getElementById('tradeBadge');

    if (setup.isBullish) {
        header.className = 'trade-setup-header buy';
        typeEl.className = 'trade-type buy';
        typeEl.textContent = 'BUY';
        badgeEl.className = 'trade-badge buy';
        badgeEl.textContent = CANDLE_TYPES[prediction.topType];
    } else {
        header.className = 'trade-setup-header sell';
        typeEl.className = 'trade-type sell';
        typeEl.textContent = 'SELL';
        badgeEl.className = 'trade-badge sell';
        badgeEl.textContent = CANDLE_TYPES[prediction.topType];
    }

    document.getElementById('entryZone').textContent = `$${setup.entryLow.toFixed(2)} - $${setup.entryHigh.toFixed(2)}`;
    document.getElementById('entryDetail').textContent = setup.isBullish ? 'Wait for lower wick' : 'Wait for upper wick';

    document.getElementById('stopLoss').textContent = `$${setup.sl.toFixed(2)}`;
    document.getElementById('slDetail').textContent = `-${setup.risk.toFixed(2)} pts | -${(setup.risk / setup.entry * 100).toFixed(2)}%`;

    document.getElementById('takeProfit1').textContent = `$${setup.tp1.toFixed(2)}`;
    document.getElementById('tp1Detail').textContent = `+${setup.reward1.toFixed(2)} pts | R:R ${setup.rr1}:1`;

    document.getElementById('takeProfit2').textContent = `$${setup.tp2.toFixed(2)}`;
    document.getElementById('tp2Detail').textContent = `+${setup.reward2.toFixed(2)} pts | R:R ${setup.rr2}:1`;

    document.getElementById('strategyText').textContent = setup.strategy;
}

function renderSummaryStats(prediction, avgRange) {
    // Win rate = bullish probability if predicted bullish, else bearish probability
    const predictedIsBullish = prediction.topType % 2 === 0;
    const winRate = predictedIsBullish ? prediction.bullPct : prediction.bearPct;

    document.getElementById('statWinRate').textContent = winRate.toFixed(1) + '%';
    document.getElementById('statAvgRange').textContent = '$' + avgRange.toFixed(2);
    document.getElementById('statBullPct').textContent = prediction.bullPct.toFixed(1) + '%';
    document.getElementById('statBearPct').textContent = prediction.bearPct.toFixed(1) + '%';
}

// ============================================
// Update Prediction with Period Filter
// ============================================

function updatePredictionWithPeriod() {
    const select = document.getElementById('predictionPeriodSelect');
    if (!select || !rawData) return;

    const days = parseInt(select.value);
    const periodFilteredData = filterDataByPeriod(rawData, days);

    // Get latest pattern (always from full data - last 3 candles)
    const pattern = getPatternWithFallback(rawData);
    const openPrice = pattern.openPrice;

    // Calculate prediction with period-filtered data
    const filteredData = filterDataByPattern(periodFilteredData, pattern.prev1, pattern.prev2, pattern.prev3);
    const prediction = calculateNextCandleDistribution(filteredData);

    // Calculate average distances with period-filtered data
    const avgDistances = calculateAvgDistanceByType(periodFilteredData);

    // Calculate trade setup
    const setup = calculateTradeSetup(openPrice, prediction.topType, avgDistances);

    // Calculate average range
    const avgRange = periodFilteredData.reduce((sum, row) => sum + (row.high - row.low || 0), 0) / periodFilteredData.length;

    // Calculate predicted prices (OHLC)
    const isBullish = prediction.topType % 2 === 0;
    const predictedPrices = calculatePredictedPrices(openPrice, setup.metrics, isBullish);

    // Update UI
    document.getElementById('predProbability').textContent = prediction.topPercent.toFixed(1) + '%';
    document.getElementById('predSamples').textContent = prediction.total.toLocaleString();
    document.getElementById('candleTypeBadge').textContent = CANDLE_TYPES[prediction.topType];

    renderPatternFlow(pattern, prediction);
    document.getElementById('candleDrawing').innerHTML = drawPredictedCandle(prediction.topType, setup);
    renderPredictedPrices(predictedPrices, isBullish);
    renderTradeLevels(setup, openPrice);
    renderCandleMetrics(setup.metrics);
    renderTradeSetup(setup, prediction);
    renderSummaryStats(prediction, avgRange);

    // Update period info
    updatePeriodInfo('predictionPeriodSelect', 'predictionPeriodInfo');
}

function initPeriodSelector() {
    const select = document.getElementById('predictionPeriodSelect');
    if (select) {
        select.addEventListener('change', updatePredictionWithPeriod);
        updatePeriodInfo('predictionPeriodSelect', 'predictionPeriodInfo');
    }
}

// ============================================
// Initialize
// ============================================

// ============================================
// Mini Candlestick Chart
// ============================================

function renderMiniCandleChart(data, numCandles = 20) {
    const container = document.getElementById('miniCandleChart');
    if (!container || data.length < numCandles) return;

    // Get last N candles
    const candles = data.slice(-numCandles);

    // Find min/max for scaling
    let minLow = Infinity, maxHigh = -Infinity;
    candles.forEach(c => {
        if (c.low < minLow) minLow = c.low;
        if (c.high > maxHigh) maxHigh = c.high;
    });

    const priceRange = maxHigh - minLow;
    const chartHeight = 80; // px

    // Calculate stats
    let bullishCount = 0, bearishCount = 0, totalRange = 0;

    // Generate candle HTML
    const candlesHtml = candles.map((candle, index) => {
        const isBull = isBullish(candle.candle_type);
        if (isBull) bullishCount++; else bearishCount++;
        totalRange += (candle.high - candle.low);

        // Calculate positions (as percentage of chart height)
        const highPos = ((maxHigh - candle.high) / priceRange) * chartHeight;
        const lowPos = ((maxHigh - candle.low) / priceRange) * chartHeight;
        const bodyTop = ((maxHigh - Math.max(candle.open, candle.close)) / priceRange) * chartHeight;
        const bodyBottom = ((maxHigh - Math.min(candle.open, candle.close)) / priceRange) * chartHeight;
        const bodyHeight = Math.max(bodyBottom - bodyTop, 2);

        const wickHeight = lowPos - highPos;
        const isLast = index === candles.length - 1;

        return `
            <div class="mini-candle ${isBull ? 'bullish' : 'bearish'} ${isLast ? 'current' : ''}"
                 style="height: ${chartHeight}px;">
                <div class="mini-candle-wick" style="top: ${highPos}px; height: ${wickHeight}px;"></div>
                <div class="mini-candle-body" style="top: ${bodyTop}px; height: ${bodyHeight}px;"></div>
            </div>
        `;
    }).join('');

    container.innerHTML = candlesHtml;

    // Update stats
    document.getElementById('miniBullish').textContent = bullishCount;
    document.getElementById('miniBearish').textContent = bearishCount;
    document.getElementById('miniAvgRange').textContent = '$' + (totalRange / numCandles).toFixed(2);

    // Update axis labels
    const firstCandle = candles[0];
    const lastCandle = candles[candles.length - 1];
    document.getElementById('miniChartStart').textContent = formatDate(firstCandle.datetime);
    document.getElementById('miniChartEnd').textContent = formatDate(lastCandle.datetime);

    // Update price change (from previous day)
    const prevCandle = data[data.length - 2];
    const currentCandle = data[data.length - 1];
    if (prevCandle && currentCandle) {
        const change = currentCandle.close - prevCandle.close;
        const changePct = (change / prevCandle.close) * 100;
        const changeEl = document.getElementById('priceChange');
        const changePctEl = document.getElementById('priceChangePct');
        const containerEl = changeEl.parentElement;

        changeEl.textContent = (change >= 0 ? '+' : '') + '$' + change.toFixed(2);
        changePctEl.textContent = '(' + (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%)';
        containerEl.className = 'open-price-change ' + (change >= 0 ? 'positive' : 'negative');
    }
}

async function init() {
    try {
        rawData = await loadData();
        console.log('Daily Plan - Data loaded:', rawData.length, 'rows');

        // Use 1 year data by default for calculations
        const defaultPeriod = 365;
        const periodFilteredData = filterDataByPeriod(rawData, defaultPeriod);

        // Get latest pattern with fallback logic
        const pattern = getPatternWithFallback(rawData);
        const openPrice = pattern.openPrice;
        console.log('Pattern used:', pattern.usedDays, 'days -', pattern.prev1, pattern.prev2, pattern.prev3);

        // Calculate prediction with period-filtered data
        const filteredData = filterDataByPattern(periodFilteredData, pattern.prev1, pattern.prev2, pattern.prev3);
        const prediction = calculateNextCandleDistribution(filteredData);

        // Calculate average distances with period-filtered data
        const avgDistances = calculateAvgDistanceByType(periodFilteredData);

        // Calculate trade setup
        const setup = calculateTradeSetup(openPrice, prediction.topType, avgDistances);

        // Calculate average range from period-filtered data
        const avgRange = periodFilteredData.reduce((sum, row) => sum + (row.high - row.low || 0), 0) / periodFilteredData.length;

        // Update header date
        const today = new Date();
        document.getElementById('headerDate').textContent = today.toLocaleDateString('en-US', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
        });

        // Calculate predicted prices (OHLC)
        const isBullish = prediction.topType % 2 === 0;
        const predictedPrices = calculatePredictedPrices(openPrice, setup.metrics, isBullish);

        // Render UI
        document.getElementById('openPrice').textContent = '$' + openPrice.toFixed(2);
        document.getElementById('predProbability').textContent = prediction.topPercent.toFixed(1) + '%';
        document.getElementById('predSamples').textContent = prediction.total.toLocaleString();
        document.getElementById('candleTypeBadge').textContent = CANDLE_TYPES[prediction.topType];

        renderPatternFlow(pattern, prediction);
        document.getElementById('candleDrawing').innerHTML = drawPredictedCandle(prediction.topType, setup);
        renderPredictedPrices(predictedPrices, isBullish);  // Left: Predicted prices
        renderTradeLevels(setup, openPrice);                 // Right: Trade levels
        renderCandleMetrics(setup.metrics);
        renderTradeSetup(setup, prediction);
        renderSummaryStats(prediction, avgRange);
        renderMiniCandleChart(rawData, 20);                  // Mini candlestick chart

        hideLoading();
        showContent();
        initSidebar();

        // Initialize period selector
        initPeriodSelector();

        // Initialize market selector with refresh callback
        initMarketSelector(async (newData) => {
            rawData = newData;

            // Get current period selection
            const periodSelect = document.getElementById('predictionPeriodSelect');
            const days = periodSelect ? parseInt(periodSelect.value) : 365;
            const newPeriodFilteredData = filterDataByPeriod(rawData, days);

            // Recalculate everything with new data
            const newPattern = getPatternWithFallback(rawData);
            const newOpenPrice = newPattern.openPrice;
            const newFilteredData = filterDataByPattern(newPeriodFilteredData, newPattern.prev1, newPattern.prev2, newPattern.prev3);
            const newPrediction = calculateNextCandleDistribution(newFilteredData);
            const newAvgDistances = calculateAvgDistanceByType(newPeriodFilteredData);
            const newSetup = calculateTradeSetup(newOpenPrice, newPrediction.topType, newAvgDistances);
            const newAvgRange = newPeriodFilteredData.reduce((sum, row) => sum + (row.high - row.low || 0), 0) / newPeriodFilteredData.length;

            // Calculate predicted prices
            const newIsBullish = newPrediction.topType % 2 === 0;
            const newPredictedPrices = calculatePredictedPrices(newOpenPrice, newSetup.metrics, newIsBullish);

            // Update UI
            document.getElementById('openPrice').textContent = '$' + newOpenPrice.toFixed(2);
            document.getElementById('predProbability').textContent = newPrediction.topPercent.toFixed(1) + '%';
            document.getElementById('predSamples').textContent = newPrediction.total.toLocaleString();
            document.getElementById('candleTypeBadge').textContent = CANDLE_TYPES[newPrediction.topType];

            renderPatternFlow(newPattern, newPrediction);
            document.getElementById('candleDrawing').innerHTML = drawPredictedCandle(newPrediction.topType, newSetup);
            renderPredictedPrices(newPredictedPrices, newIsBullish);
            renderTradeLevels(newSetup, newOpenPrice);
            renderCandleMetrics(newSetup.metrics);
            renderTradeSetup(newSetup, newPrediction);
            renderSummaryStats(newPrediction, newAvgRange);
            renderMiniCandleChart(rawData, 20);              // Mini candlestick chart

            // Update period info
            updatePeriodInfo('predictionPeriodSelect', 'predictionPeriodInfo');
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
