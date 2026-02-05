# Gold Candle Analysis Dashboard - Development Log

## Version 5.0.0 - Professional Theme + Trading Plans
**Release Date:** 2026-01-13

---

## Overview

Dashboard สำหรับวิเคราะห์ข้อมูลแท่งเทียนทองคำย้อนหลัง 10 ปี พร้อม Trading Plan แบบ 2 แผน (Plan A / Plan B)

---

## What's New in v5.0

### 1. Professional Theme (Purple)
- เปลี่ยนจาก Cyan (#00f5ff) เป็น Purple (#7367F0)
- Elevated shadow cards แทน Glass morphism
- ปรับ background ให้อ่อนลง (#1E1E2D)

### 2. Daily Plan - 2 Trading Plans
- **Pattern Analysis:** แสดง TOP 2 predictions พร้อม %
- **Plan A (Primary):** ใช้ TOP 1 prediction
- **Plan B (Alternative):** ใช้ TOP 2 prediction
- แต่ละแผนมี: Candle Visualization, Predicted Prices, Trade Levels, Trade Setup

### 3. Dashboard - Price Chart Section
- Mini Candlestick Chart 50 แท่ง (เต็มความกว้าง)
- Current Price + Change Badge
- Bullish/Bearish count, Avg Range
- ย้าย Pattern Predictor ขึ้นมาต่อจาก Chart

---

## Color System

| Element | v4 (Old) | v5 (New) |
|---------|----------|----------|
| Primary | #00f5ff (Cyan) | #7367F0 (Purple) |
| Background | #0a0a1a | #1E1E2D |
| Card | Glass blur | Solid + Shadow |
| Bullish | #22c55e | #28C76F |
| Bearish | #ef4444 | #FF4C51 |

---

## File Structure

```
version5/
├── index.html              # Dashboard + Price Chart
├── daily.html              # Daily Analysis
├── weekly.html             # Weekly Analysis
├── monthly.html            # Monthly Report
├── daily-plan.html         # Trading Plan (2 Plans)
├── compare-side-by-side.html
├── compare-correlation.html
├── shared.css              # Purple theme CSS
├── shared.js               # Shared functions
├── dashboard.js            # Dashboard + Mini Chart
├── daily.js / weekly.js / monthly.js
├── daily-plan.js           # 2-Plan logic
├── compare-*.js
├── tradingview_10years.py
├── xauusd_10years_data.csv
├── gc1_10years_data.csv
├── push_all.bat            # Git push script
└── update_and_push.bat     # Data update script
```

---

## Dashboard Layout (index.html)

```
1. Hero Section
   └── Futures Basis, Latest Price, 10Y Change, Years

2. Price Chart Section (NEW)
   ├── Current Price + Change Badge
   ├── Mini Candlestick Chart (50 แท่ง)
   └── Bullish/Bearish/Avg Range

3. Pattern Predictor (moved up)
   ├── Pattern Selector (3 candles)
   ├── Most Likely Next Candle
   └── Bull/Bear Distribution

4. Market Overview
   ├── Sentiment Chart
   └── Type Distribution

5. Average Distance by Type

6. Candle Types Analysis (8 cards)
```

---

## Daily Plan Layout (daily-plan.html)

```
1. Open Price + Mini Chart (20 แท่ง)

2. Pattern Analysis
   └── [Day -3] → [Day -2] → [Day -1] → [TOP 1 xx%] [TOP 2 xx%]

3. Trading Plans (2 columns)
   ┌─────────────────┬─────────────────┐
   │ Plan A (Primary)│ Plan B (Alt)    │
   ├─────────────────┼─────────────────┤
   │ Candle Drawing  │ Candle Drawing  │
   │ Predicted Prices│ Predicted Prices│
   │ Trade Levels    │ Trade Levels    │
   │ Candle Metrics  │ Candle Metrics  │
   └─────────────────┴─────────────────┘

4. Trade Setup (2 columns)
   ┌─────────────────┬─────────────────┐
   │ BUY/SELL        │ BUY/SELL        │
   │ Entry Zone      │ Entry Zone      │
   │ Stop Loss       │ Stop Loss       │
   │ TP1, TP2        │ TP1, TP2        │
   │ Strategy        │ Strategy        │
   └─────────────────┴─────────────────┘

5. Summary Stats
   └── Win Rate, Avg Range, Bull/Bear Probability
```

---

## Key Functions

### Pattern Prediction (daily-plan.js)
```javascript
calculateNextCandleDistribution(data)
// Returns: { topType, topPercent, secondType, secondPercent, ... }
```

### Mini Chart (dashboard.js)
```javascript
renderFullMiniChart(data, 50)  // 50 candles
```

### Render Both Plans (daily-plan.js)
```javascript
renderBothPlans(prediction, avgDistances, openPrice)
// Renders Plan A (topType) and Plan B (secondType)
```

---

## Scripts

### push_all.bat
```batch
cd /d "C:\Users\USER\Desktop\code lab\gold-stat"
git add .
git commit -m "message"
git push
```

### update_and_push.bat
```batch
python tradingview_10years.py --symbols all
git add *.csv
git commit -m "Update gold data"
git push
```

---

## Changelog

### v5.0.0 (2026-01-13)
- **NEW:** Professional Purple Theme (#7367F0)
- **NEW:** Elevated shadow cards (ลบ glass morphism)
- **NEW:** Daily Plan - 2 Trading Plans (Plan A / Plan B)
- **NEW:** Pattern Analysis แสดง TOP 2 predictions พร้อม %
- **NEW:** Trade Setup แบ่ง 2 คอลัมน์
- **NEW:** Dashboard Price Chart (50 แท่ง, เต็มความกว้าง)
- **MOVED:** Pattern Predictor ย้ายขึ้นมาต่อจาก Price Chart
- **IMPROVED:** Color consistency ทุกหน้า

### v4.0.0 (2026-01-04)
- Multi-Market Support (XAUUSD + GC1!)
- Compare Side-by-Side & Correlation pages
- Futures Basis Display
- Mini Candlestick Chart (20 แท่ง)

---

## Credits

- **Data:** TradingView (OANDA:XAUUSD, COMEX:GC1!)
- **Charts:** Chart.js
- **CSV Parser:** Papa Parse
- **Font:** Inter (Google Fonts)
- **Development:** Claude Code Assistant
