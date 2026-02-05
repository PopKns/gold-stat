// Compare Correlation - JavaScript
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
            renderCorrelationAnalysis();
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

function renderCorrelationAnalysis() {
    renderCorrelationCards();
    renderAgreementChart();
    renderScatterChart();
    renderDivergenceTable();
    renderBasisChart();
}

function renderCorrelationCards() {
    const stats = getComparisonStats(xauusdData, gc1Data);

    // Price Correlation
    const priceCorr = stats.priceCorr;
    const priceCorrEl = document.getElementById('priceCorr');
    const priceCorrBar = document.getElementById('priceCorrBar');
    priceCorrEl.textContent = priceCorr.toFixed(3);
    priceCorrBar.style.width = `${Math.abs(priceCorr) * 100}%`;
    setCorrClass(priceCorrEl, priceCorrBar, Math.abs(priceCorr));

    // Direction Match
    const dirMatch = stats.directionMatch;
    const dirMatchEl = document.getElementById('dirMatch');
    const dirMatchBar = document.getElementById('dirMatchBar');
    dirMatchEl.textContent = `${dirMatch.toFixed(1)}%`;
    dirMatchBar.style.width = `${dirMatch}%`;
    setCorrClass(dirMatchEl, dirMatchBar, dirMatch / 100);

    // Type Match
    const typeMatch = stats.typeMatch;
    const typeMatchEl = document.getElementById('typeMatch');
    const typeMatchBar = document.getElementById('typeMatchBar');
    typeMatchEl.textContent = `${typeMatch.toFixed(1)}%`;
    typeMatchBar.style.width = `${typeMatch}%`;
    setCorrClass(typeMatchEl, typeMatchBar, typeMatch / 100);
}

function setCorrClass(valueEl, barEl, value) {
    const classes = ['high', 'medium', 'low'];
    classes.forEach(c => {
        valueEl.classList.remove(c);
        barEl.classList.remove(c);
    });

    if (value >= 0.8) {
        valueEl.classList.add('high');
        barEl.classList.add('high');
    } else if (value >= 0.5) {
        valueEl.classList.add('medium');
        barEl.classList.add('medium');
    } else {
        valueEl.classList.add('low');
        barEl.classList.add('low');
    }
}

function renderAgreementChart() {
    const ctx = document.getElementById('agreementChart');
    if (!ctx) return;

    const { aligned1, aligned2, dates } = alignDataByDate(xauusdData, gc1Data);

    // Group by day of week (1=Monday, 2=Tuesday, ..., 5=Friday)
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const agreement = { 1: { match: 0, total: 0 }, 2: { match: 0, total: 0 }, 3: { match: 0, total: 0 }, 4: { match: 0, total: 0 }, 5: { match: 0, total: 0 } };

    for (let i = 0; i < aligned1.length; i++) {
        const dow = getDayOfWeek(dates[i]); // 0=Sunday, 1=Monday, ..., 6=Saturday
        if (dow >= 1 && dow <= 5) {
            agreement[dow].total++;
            if (isBullish(aligned1[i].candle_type) === isBullish(aligned2[i].candle_type)) {
                agreement[dow].match++;
            }
        }
    }

    const agreementPcts = days.map((_, i) => agreement[i + 1].total > 0 ? (agreement[i + 1].match / agreement[i + 1].total * 100) : 0);

    // Find best and worst
    let bestDay = 0, worstDay = 0;
    agreementPcts.forEach((pct, i) => {
        if (pct > agreementPcts[bestDay]) bestDay = i;
        if (pct < agreementPcts[worstDay]) worstDay = i;
    });

    if (charts.agreement) charts.agreement.destroy();

    charts.agreement = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [{
                label: 'Direction Agreement %',
                data: agreementPcts,
                backgroundColor: agreementPcts.map((_, i) =>
                    i === bestDay ? 'rgba(34, 197, 94, 0.8)' :
                    i === worstDay ? 'rgba(239, 68, 68, 0.8)' :
                    'rgba(168, 85, 247, 0.7)'
                ),
                borderColor: agreementPcts.map((_, i) =>
                    i === bestDay ? '#22c55e' :
                    i === worstDay ? '#ef4444' :
                    '#a855f7'
                ),
                borderWidth: 1
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
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'Agreement (%)' }
                }
            }
        }
    });

    // Insight
    document.getElementById('agreementInsight').innerHTML = `
        <strong>${days[bestDay]}</strong> has the highest direction agreement at <strong>${agreementPcts[bestDay].toFixed(1)}%</strong>.
        <strong>${days[worstDay]}</strong> shows the most divergence at <strong>${agreementPcts[worstDay].toFixed(1)}%</strong> agreement.
    `;
}

function renderScatterChart() {
    const ctx = document.getElementById('scatterChart');
    if (!ctx) return;

    const { aligned1, aligned2 } = alignDataByDate(xauusdData, gc1Data);

    // Calculate daily changes
    const scatterData = [];
    for (let i = 0; i < aligned1.length; i++) {
        const xChange = aligned1[i].close - aligned1[i].open;
        const gChange = aligned2[i].close - aligned2[i].open;
        scatterData.push({ x: xChange, y: gChange });
    }

    if (charts.scatter) charts.scatter.destroy();

    charts.scatter = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Daily Price Change',
                data: scatterData,
                backgroundColor: 'rgba(115, 103, 240, 0.5)',
                borderColor: '#7367F0',
                pointRadius: 3,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `XAUUSD: $${ctx.parsed.x.toFixed(2)}, GC1!: $${ctx.parsed.y.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'XAUUSD Daily Change ($)' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                y: {
                    title: { display: true, text: 'GC1! Daily Change ($)' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                }
            }
        }
    });

    // Calculate R-squared
    const xChanges = scatterData.map(d => d.x);
    const yChanges = scatterData.map(d => d.y);
    const corr = calculateCorrelation(xChanges, yChanges);
    const rSquared = corr * corr;

    // Calculate beta (slope)
    const xMean = xChanges.reduce((a, b) => a + b, 0) / xChanges.length;
    const yMean = yChanges.reduce((a, b) => a + b, 0) / yChanges.length;
    let numerator = 0, denominator = 0;
    for (let i = 0; i < xChanges.length; i++) {
        numerator += (xChanges[i] - xMean) * (yChanges[i] - yMean);
        denominator += (xChanges[i] - xMean) ** 2;
    }
    const beta = denominator !== 0 ? numerator / denominator : 0;

    document.getElementById('scatterInsight').innerHTML = `
        R&sup2; = <strong>${rSquared.toFixed(3)}</strong> |
        When XAUUSD changes by $10, GC1! typically changes by <strong>$${(beta * 10).toFixed(2)}</strong> (β = ${beta.toFixed(3)}).
        The close clustering around the diagonal line indicates strong correlation.
    `;
}

function renderDivergenceTable() {
    const { aligned1, aligned2, dates } = alignDataByDate(xauusdData, gc1Data);

    // Get last 30 days of divergences
    const recentDays = Math.min(30, aligned1.length);
    const divergences = [];

    for (let i = aligned1.length - recentDays; i < aligned1.length; i++) {
        const bull1 = isBullish(aligned1[i].candle_type);
        const bull2 = isBullish(aligned2[i].candle_type);

        if (bull1 !== bull2) {
            divergences.push({
                date: dates[i],
                xauusd: CANDLE_TYPES[aligned1[i].candle_type],
                gc1: CANDLE_TYPES[aligned2[i].candle_type],
                xauusdBullish: bull1,
                gc1Bullish: bull2
            });
        }
    }

    const tbody = document.getElementById('divergenceTableBody');

    if (divergences.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--neon-green);">No divergences in last 30 days</td></tr>`;
    } else {
        tbody.innerHTML = divergences.map(d => `
            <tr>
                <td>${d.date}</td>
                <td>${d.xauusd}</td>
                <td>${d.gc1}</td>
                <td class="${d.xauusdBullish ? 'bullish' : 'bearish'}">${d.xauusdBullish ? 'Bullish' : 'Bearish'}</td>
                <td class="${d.gc1Bullish ? 'bullish' : 'bearish'}">${d.gc1Bullish ? 'Bullish' : 'Bearish'}</td>
            </tr>
        `).join('');
    }

    // Total divergence stats
    const totalDivergences = findDivergences(xauusdData, gc1Data);
    const divergenceRate = (totalDivergences.length / aligned1.length * 100).toFixed(1);

    document.getElementById('divergenceInsight').innerHTML = `
        Found <strong>${divergences.length}</strong> divergence events in the last 30 days.
        Overall divergence rate is <strong>${divergenceRate}%</strong> (~${totalDivergences.length} days out of ${aligned1.length} common trading days).
    `;
}

function renderBasisChart() {
    const ctx = document.getElementById('basisChart');
    if (!ctx) return;

    const basisData = calculateBasis(xauusdData, gc1Data);

    // Get last 90 days
    const recent = basisData.slice(-90);

    if (charts.basis) charts.basis.destroy();

    charts.basis = new Chart(ctx, {
        type: 'line',
        data: {
            labels: recent.map(d => d.date),
            datasets: [{
                label: 'Basis (GC1! - XAUUSD)',
                data: recent.map(d => d.basis),
                borderColor: '#a855f7',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Basis: $${ctx.parsed.y.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: {
                        maxTicksLimit: 10
                    }
                },
                y: {
                    title: { display: true, text: 'Basis ($)' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                }
            }
        }
    });
}
