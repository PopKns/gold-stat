# Gold Candle Analysis Dashboard - Development Log

## Version 4.0.0 - Multi-Market Support
**Release Date:** 2026-01-04

---

## Overview

Dashboard สำหรับวิเคราะห์ข้อมูลแท่งเทียนทองคำย้อนหลัง 10 ปี รองรับหลายตลาด พร้อมระบบเปรียบเทียบและวิเคราะห์ Correlation

**What's New in v4.0:**
- Multi-Market Support (XAUUSD CFD + GC1! Futures)
- Market Selector Dropdown
- Compare Side-by-Side Page
- Correlation Analysis Page
- Futures Basis Display
- Mini Candlestick Chart (20 แท่งล่าสุด)
- Python Script รองรับหลาย Symbol

---

## Key Features

### 1. Multi-Market Support
รองรับ 2 ตลาดทองคำ:

| Market | Symbol | Exchange | Type |
|--------|--------|----------|------|
| **XAUUSD** | XAUUSD | OANDA | CFD (Spot) |
| **GC1!** | GC1! | COMEX | Futures |

### 2. Market Selector
- Dropdown ให้เลือกตลาดในทุกหน้า
- Data Caching ไม่ต้องโหลดซ้ำ
- Auto-refresh เมื่อเปลี่ยนตลาด

### 3. Compare Section
- **Side-by-Side:** เปรียบเทียบราคา, สถิติ, Pattern
- **Correlation:** วิเคราะห์ความสัมพันธ์ระหว่าง 2 ตลาด

### 4. Futures Basis
- แสดงส่วนต่างราคาระหว่าง Futures กับ Spot
- `Basis = GC1! Close - XAUUSD Close`
- แสดงในหน้า Dashboard และ Compare

### 5. Mini Candlestick Chart
- แสดง 20 แท่งเทียนล่าสุดในหน้า Daily Plan
- แสดง Price Change จากเมื่อวาน
- สถิติ Bullish/Bearish/Avg Range

---

## File Structure

```
version4/
├── index.html              # Dashboard หลัก
├── daily.html              # Daily Analysis (Day of Week)
├── weekly.html             # Weekly Analysis (Week of Month)
├── monthly.html            # Monthly Report (Seasonal)
├── daily-plan.html         # Daily Trading Plan + Mini Chart
├── compare-side-by-side.html   # Side-by-Side Comparison
├── compare-correlation.html    # Correlation Analysis
├── shared.css              # CSS ที่ใช้ร่วมกันทุกหน้า
├── shared.js               # JavaScript functions + Multi-market
├── dashboard.js            # Dashboard logic
├── daily.js                # Daily page logic
├── weekly.js               # Weekly page logic
├── monthly.js              # Monthly page logic
├── daily-plan.js           # Daily Trading Plan logic
├── compare-side-by-side.js # Side-by-Side comparison logic
├── compare-correlation.js  # Correlation analysis logic
├── tradingview_10years.py  # Data fetcher (multi-symbol)
├── xauusd_10years_data.csv # XAUUSD data
├── gc1_10years_data.csv    # GC1! data
└── DEVLOG.md               # Development log
```

---

## Pages & Features

### 1. Dashboard (index.html)
- **Hero Stats:** Futures Basis, Latest Price, 10Y Change, Years of Data
- **Market Selector:** เลือก XAUUSD หรือ GC1!
- **Market Overview:** Sentiment Chart, Type Distribution
- **Distance Analysis:** Average distance by candle type
- **Pattern Predictor:** 3-candle pattern prediction

### 2. Daily Analysis (daily.html)
- **Day of Week Statistics:** Mon-Fri performance
- **Best/Worst Day:** Highlight best and worst trading day
- **Data Table:** Sortable, filterable, exportable

### 3. Weekly Analysis (weekly.html)
- **Week of Month Statistics:** 1st-4th week performance
- **Weekly Performance Chart:** By year
- **Data Table:** Win rate, range, net change

### 4. Monthly Report (monthly.html)
- **Seasonal Pattern:** Average % change by month
- **Monthly Heatmap:** Year x Month grid
- **Data Table:** Open, close, change, range

### 5. Daily Trading Plan (daily-plan.html)
- **Today's Open Price + Mini Chart:**
  - 20 แท่งเทียนล่าสุด
  - Price change จากเมื่อวาน (+$xx.xx / +x.xx%)
  - สถิติ Bullish/Bearish/Avg Range
- **Pattern Analysis:** 3-candle pattern with fallback
- **Predicted Candle:** SVG visualization with price levels
- **Trade Setup:** Entry Zone, SL, TP1, TP2

### 6. Compare Side-by-Side (compare-side-by-side.html)
- **Price Cards:** Latest price + candle visualization
- **Futures Basis:** ส่วนต่างราคา + %
- **Type Match Status:** Match / Direction Match / Divergence
- **Statistics Table:** 10-year comparison
- **Charts:** Type distribution, Day of Week comparison

### 7. Correlation Analysis (compare-correlation.html)
- **Correlation Cards:**
  - Price Correlation (0.xxx)
  - Direction Match (xx.x%)
  - Type Match (xx.x%)
- **Agreement Chart:** Direction agreement by day of week
- **Scatter Plot:** Daily price change correlation
- **Divergence Table:** Recent divergence events (30 days)
- **Basis Chart:** Futures basis over time (90 days)

---

## Sidebar Navigation

```
Main Menu
├── Dashboard           → index.html
├── History (collapsible)
│   ├── Daily Data      → daily.html
│   ├── Weekly Summary  → weekly.html
│   └── Monthly Report  → monthly.html
└── Trading (collapsible)
    └── Daily Plan      → daily-plan.html

Compare
└── Compare (collapsible)
    ├── Side-by-Side    → compare-side-by-side.html
    └── Correlation     → compare-correlation.html

Tools
├── Settings (placeholder)
├── Export Data (placeholder)
└── Help (placeholder)
```

---

## Market Configuration (shared.js)

```javascript
const MARKETS = {
    xauusd: {
        id: 'xauusd',
        symbol: 'XAUUSD',
        name: 'Gold Spot CFD',
        exchange: 'OANDA',
        type: 'CFD',
        dataFile: 'xauusd_10years_data.csv',
        color: '#00f5ff',
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
```

---

## Comparison Functions (shared.js)

| Function | Description |
|----------|-------------|
| `loadAllMarketsData()` | โหลดข้อมูลทั้ง 2 ตลาด |
| `alignDataByDate(data1, data2)` | จับคู่วันที่ที่ตรงกัน |
| `calculateCorrelation(arr1, arr2)` | คำนวณ Pearson correlation |
| `calculateDirectionMatch(data1, data2)` | % วันที่ทิศทางเหมือนกัน |
| `calculateTypeMatch(data1, data2)` | % วันที่ candle type เหมือนกัน |
| `findDivergences(data1, data2)` | หาวันที่ทิศทางต่างกัน |
| `calculateBasis(data1, data2)` | คำนวณ Futures Basis |
| `getComparisonStats(data1, data2)` | สรุปสถิติเปรียบเทียบ |

---

## Type Match Status

| Status | Condition | Meaning |
|--------|-----------|---------|
| **Match** | candle_type เท่ากัน | ตลาดเห็นพ้องต้องกัน 100% |
| **Direction Match** | Bullish/Bearish เหมือนกัน | ทิศทางเดียวกัน |
| **Divergence** | ทิศทางตรงข้าม | ตลาดขัดแย้งกัน |

---

## Futures Basis

```
Basis = GC1! Close - XAUUSD Close
```

| Basis | Status | Meaning |
|-------|--------|---------|
| **> 0** (บวก) | Contango | Futures แพงกว่า Spot (ปกติ) |
| **< 0** (ลบ) | Backwardation | Futures ถูกกว่า Spot |
| **≈ 0** | Convergence | ใกล้วันหมดอายุ Futures |

---

## Python Script (tradingview_10years.py)

### Usage

```bash
# ดึงข้อมูลทั้ง 2 ตลาด
python tradingview_10years.py --symbols all

# ดึงเฉพาะ XAUUSD
python tradingview_10years.py --symbols xauusd

# ดึงเฉพาะ GC1!
python tradingview_10years.py --symbols gc1

# กำหนด output directory
python tradingview_10years.py --symbols all --output-dir ./data
```

### Symbol Configuration

```python
SYMBOLS = {
    'xauusd': {
        'symbol': 'XAUUSD',
        'exchange': 'OANDA',
        'name': 'Gold Spot CFD',
        'output_file': 'xauusd_10years_data.csv',
        'market_type': 'CFD'
    },
    'gc1': {
        'symbol': 'GC1!',
        'exchange': 'COMEX',
        'name': 'Gold Futures',
        'output_file': 'gc1_10years_data.csv',
        'market_type': 'Futures'
    }
}
```

---

## Mini Candlestick Chart

แสดง 20 แท่งเทียนล่าสุดในหน้า Daily Plan:

```
┌─────────────────────────────────────────────┐
│  Today's Open Price          +$12.30        │
│  $2,635.42                   (+0.47%)       │
├─────────────────────────────────────────────┤
│  ║ ║ ║ ║ ║ ║ ║ ║ ║ ║ ║ ║ ║ ║ ║ ║ ║ ║ ║ ║  │
│  Dec 1          Last 20 Candles      Dec 23 │
├─────────────────────────────────────────────┤
│  ● Bullish: 12   ● Bearish: 8   Range: $45  │
└─────────────────────────────────────────────┘
```

### Features:
- Auto-scaling ตาม price range
- แท่งล่าสุดมี glow effect
- Price change จากเมื่อวาน (+ สีเขียว, - สีแดง)
- สถิติ Bullish/Bearish/Avg Range

---

## Technical Stack

- **HTML5** - Semantic markup
- **CSS3** - Custom properties, Flexbox, Grid, Responsive
- **JavaScript (ES6+)** - Vanilla JS, async/await
- **Chart.js** - Charts (CDN)
- **Papa Parse** - CSV parsing (CDN)
- **Google Fonts** - Inter font family
- **Python 3** - Data fetching (tvdatafeed)

---

## How to Run

### 1. Generate Data
```bash
cd version4
python tradingview_10years.py --symbols all
```

### 2. Start Web Server
```bash
python -m http.server 8000
```

### 3. Open Browser
- Dashboard: http://localhost:8000/index.html
- Daily: http://localhost:8000/daily.html
- Weekly: http://localhost:8000/weekly.html
- Monthly: http://localhost:8000/monthly.html
- Daily Plan: http://localhost:8000/daily-plan.html
- Side-by-Side: http://localhost:8000/compare-side-by-side.html
- Correlation: http://localhost:8000/compare-correlation.html

---

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

---

## Changelog

### v4.0.0 (2026-01-04)
- **NEW:** Multi-Market Support (XAUUSD CFD + GC1! Futures)
- **NEW:** Market Selector Dropdown ในทุกหน้า
- **NEW:** Compare Side-by-Side Page
  - Price cards with candle visualization
  - Statistics comparison table
  - Type distribution chart
  - Day of Week comparison chart
- **NEW:** Correlation Analysis Page
  - Price correlation score
  - Direction match percentage
  - Type match percentage
  - Agreement by day of week chart
  - Scatter plot (daily price change)
  - Divergence detection table
  - Basis chart (90 days)
- **NEW:** Futures Basis Display
  - แสดงใน Dashboard Hero Stats
  - แสดงใน Compare Side-by-Side
  - Basis Chart ใน Correlation page
- **NEW:** Mini Candlestick Chart (Daily Plan)
  - 20 แท่งเทียนล่าสุด
  - Price change จากเมื่อวาน
  - Bullish/Bearish/Avg Range stats
- **NEW:** Python Script Multi-Symbol Support
  - `--symbols xauusd gc1 all`
  - `--output-dir` option
- **IMPROVED:** Sidebar Navigation
  - Compare section with Side-by-Side and Correlation
  - Dashboard link แก้ไขให้ navigate ได้
- **RENAMED:** "Spread" → "Basis" ทั้งหมด

---

## Credits

- **Data:** TradingView (OANDA:XAUUSD, COMEX:GC1!)
- **Charts:** Chart.js
- **CSV Parser:** Papa Parse
- **Font:** Inter (Google Fonts)
- **Development:** Claude Code Assistant
