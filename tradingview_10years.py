#!/usr/bin/env python3
"""
TradingView Data Fetcher - 10 Years Historical Data
Multi-Symbol Support: XAUUSD (CFD) and GC1! (Gold Futures)
Version 4.0
"""

import pandas as pd
import numpy as np
import talib
from datetime import datetime, timedelta
from typing import Optional, Dict, Union, List
import os
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv
from zoneinfo import ZoneInfo

# Import TradingView datafeed
try:
    from tvDatafeed import TvDatafeed, Interval
except ImportError:
    print("tvDatafeed not installed. Install with:")
    print("pip install --upgrade --no-cache-dir git+https://github.com/rongardF/tvdatafeed.git")
    exit(1)

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== Configuration ====================
DEFAULT_N_BARS = 5000  # Fetch maximum to ensure we have 10 years
START_DATE_10_YEARS = (datetime.now() - timedelta(days=365*10)).strftime('%Y-%m-%d')

# Symbol configurations - Multi-Market Support
SYMBOLS = {
    'xauusd': {
        'symbol': 'XAUUSD',
        'exchange': 'OANDA',
        'name': 'Gold Spot CFD',
        'output_file': 'xauusd_10years_data.csv',
        'description': 'XAUUSD CFD from OANDA (Spot Gold)',
        'market_type': 'CFD'
    },
    'gc1': {
        'symbol': 'GC1!',
        'exchange': 'COMEX',
        'name': 'Gold Futures',
        'output_file': 'gc1_10years_data.csv',
        'description': 'GC1! Gold Futures from COMEX (Continuous Contract)',
        'market_type': 'Futures'
    }
}

# H1 (Hourly) Symbol configurations for Basis calculation & Session Analysis
SYMBOLS_H1 = {
    'xauusd_h1': {
        'symbol': 'XAUUSD',
        'exchange': 'OANDA',
        'name': 'Gold Spot CFD (H1)',
        'output_file': 'xauusd_h1_data.csv',
        'description': 'XAUUSD H1 for Basis & Session Analysis',
        'market_type': 'CFD',
        'interval': 'h1',
        'n_bars': 5000  # ~7 months of hourly data (5000/24 = 208 days)
    },
    'gc1_h1': {
        'symbol': 'GC1!',
        'exchange': 'COMEX',
        'name': 'Gold Futures (H1)',
        'output_file': 'gc1_h1_data.csv',
        'description': 'GC1! H1 for Basis & Session Analysis',
        'market_type': 'Futures',
        'interval': 'h1',
        'n_bars': 5000  # ~7 months of hourly data (5000/24 = 208 days)
    }
}
# ========================================================

class TradingView10YearsFetcher:
    def __init__(self, username: str = None, password: str = None, timezone: str = 'Asia/Bangkok'):
        """
        Initialize TradingView fetcher with improved credential handling
        Configured for 10 years of historical data

        Args:
            username: TradingView username (optional, will check .env)
            password: TradingView password (optional, will check .env)
            timezone: Target timezone for data (default: Asia/Bangkok)
        """
        # Load environment variables
        env_path = Path('.env')
        if env_path.exists():
            load_dotenv(env_path)
            logger.info(f"Loaded environment from {env_path}")
        else:
            # Try parent directory
            parent_env = Path('../.env')
            if parent_env.exists():
                load_dotenv(parent_env)
                logger.info(f"Loaded environment from {parent_env}")
            else:
                logger.warning(".env file not found, using system environment variables")

        # Handle credentials securely
        self.username = self._get_credential('username', username, 'TRADINGVIEW_USERNAME')
        self.password = self._get_credential('password', password, 'TRADINGVIEW_PASSWORD')

        # Timezone handling
        try:
            self.timezone = ZoneInfo(timezone)
            logger.info(f"Using timezone: {timezone}")
        except Exception as e:
            logger.warning(f"Invalid timezone {timezone}, falling back to UTC: {e}")
            self.timezone = ZoneInfo('UTC')

        self.tv = None
        self._connection_verified = False

    def _get_credential(self, cred_type: str, provided_value: str, env_var: str) -> str:
        """Safely get credentials with proper fallback handling"""
        if provided_value:
            logger.info(f"{cred_type.capitalize()} provided directly")
            return provided_value

        env_value = os.getenv(env_var)
        if env_value:
            logger.info(f"{cred_type.capitalize()} loaded from environment variable {env_var}")
            return env_value

        logger.warning(f"No {cred_type} found in parameters or {env_var} environment variable")
        return None

    def connect(self) -> bool:
        """Connect to TradingView with improved error handling"""
        if self._connection_verified:
            logger.info("Already connected to TradingView")
            return True

        if not self.username:
            logger.error("No username provided. Set TRADINGVIEW_USERNAME environment variable or pass username parameter")
            return False

        try:
            logger.info(f"Attempting to connect to TradingView with username: {self.username[:3]}***")
            self.tv = TvDatafeed(self.username, self.password or '')

            # Test connection by trying to fetch a small amount of data
            test_data = self.tv.get_hist(symbol='XAUUSD', exchange='OANDA', interval=Interval.in_daily, n_bars=1)
            if test_data is not None and not test_data.empty:
                logger.info("Connected to TradingView successfully!")
                self._connection_verified = True
                return True
            else:
                logger.error("Connection test failed - no data received")
                return False

        except Exception as e:
            logger.error(f"Error connecting to TradingView: {e}")
            self.tv = None
            return False

    def fetch_data(self, symbol: str = 'XAUUSD', exchange: str = 'OANDA',
                   interval: Interval = Interval.in_daily, n_bars: int = DEFAULT_N_BARS) -> Optional[pd.DataFrame]:
        """
        Fetch OHLCV data from TradingView with comprehensive error handling

        Args:
            symbol: Trading symbol (default: XAUUSD)
            exchange: Exchange name (default: OANDA)
            interval: Time interval for bars
            n_bars: Number of bars to fetch (default: 5000 for 10+ years)

        Returns:
            DataFrame with OHLCV data or None if failed
        """
        if not self.tv:
            logger.info("Not connected, attempting to connect...")
            if not self.connect():
                logger.error("Failed to establish connection")
                return None

        # Validate inputs
        if not symbol or not isinstance(symbol, str):
            logger.error(f"Invalid symbol: {symbol}")
            return None

        if n_bars <= 0 or n_bars > 10000:
            logger.warning(f"n_bars ({n_bars}) adjusted to valid range (1-10000)")
            n_bars = min(max(1, n_bars), 10000)

        try:
            logger.info(f"Fetching {symbol} data from {exchange} (interval: {interval}, bars: {n_bars})...")
            logger.info(f"This should cover approximately {n_bars/260:.1f} years of trading data")
            data = self.tv.get_hist(symbol=symbol, exchange=exchange, interval=interval, n_bars=n_bars)

            if data is not None and not data.empty:
                logger.info(f"Successfully fetched {len(data)} bars of data for {symbol}")
                # Basic data validation
                if self._validate_ohlcv_data(data):
                    return data
                else:
                    logger.error("Data validation failed")
                    return None
            else:
                logger.warning(f"No data received from TradingView for {symbol}")
                return None

        except Exception as e:
            logger.error(f"Error fetching data for {symbol}: {e}")
            return None

    def calculate_indicators(self, data: pd.DataFrame) -> Optional[pd.DataFrame]:
        """
        Calculate technical indicators using TA-Lib with comprehensive error handling

        Args:
            data: DataFrame with OHLCV data

        Returns:
            DataFrame with indicators added or None if failed
        """
        if data is None or data.empty:
            logger.error("No data provided for indicator calculation")
            return None

        # Check minimum data requirements
        min_periods = 26  # Largest period we use
        if len(data) < min_periods:
            logger.error(f"Insufficient data for indicators: {len(data)} < {min_periods}")
            return None

        df = data.copy()

        # Check required columns
        required_columns = ['open', 'high', 'low', 'close']
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            logger.error(f"Missing required columns for indicators: {missing_cols}")
            return None

        try:
            logger.info("Calculating technical indicators...")

            # Calculate Moving Averages
            df['MA12'] = talib.SMA(df['close'].values, timeperiod=12)
            df['MA26'] = talib.SMA(df['close'].values, timeperiod=26)

            # Calculate RSI
            df['RSI14'] = talib.RSI(df['close'].values, timeperiod=14)

            # Calculate ATR (Average True Range)
            df['ATR14'] = talib.ATR(df['high'].values, df['low'].values, df['close'].values, timeperiod=14)

            # Calculate Exponential Moving Averages
            df['EMA12'] = talib.EMA(df['close'].values, timeperiod=12)
            df['EMA26'] = talib.EMA(df['close'].values, timeperiod=26)

            # Calculate MACD
            macd_line, macd_signal, macd_hist = talib.MACD(df['close'].values)
            df['MACD'] = macd_line
            df['MACD_signal'] = macd_signal
            df['MACD_hist'] = macd_hist

            # Calculate Bollinger Bands
            bb_upper, bb_middle, bb_lower = talib.BBANDS(df['close'].values)
            df['BB_upper'] = bb_upper
            df['BB_middle'] = bb_middle
            df['BB_lower'] = bb_lower

            # Calculate High-Open and Open-Low distances
            df['high_open_dist'] = df['high'] - df['open']
            df['open_low_dist'] = df['open'] - df['low']

            # Calculate candlestick body and wick sizes
            df['body_size'] = abs(df['close'] - df['open'])
            df['upper_wick'] = df['high'] - df[['open', 'close']].max(axis=1)
            df['lower_wick'] = df[['open', 'close']].min(axis=1) - df['low']

            # Total range for ratio calculations
            total_range = df['high'] - df['low']

            # Ratio calculations (as percentage 0-1)
            df['body_ratio'] = df['body_size'] / total_range.replace(0, np.nan)
            df['wick_ratio_upper'] = df['upper_wick'] / total_range.replace(0, np.nan)
            df['wick_ratio_lower'] = df['lower_wick'] / total_range.replace(0, np.nan)

            # Fill NaN with 0 for cases where total_range is 0
            df['body_ratio'] = df['body_ratio'].fillna(0)
            df['wick_ratio_upper'] = df['wick_ratio_upper'].fillna(0)
            df['wick_ratio_lower'] = df['wick_ratio_lower'].fillna(0)

            # Classify candlestick types
            df['candle_type'] = df.apply(self.classify_candle_type, axis=1)

            # Add human-readable names (10 types)
            candle_type_names = {
                0: 'Doji Bullish',
                1: 'Doji Bearish',
                2: 'Full Body Bullish',
                3: 'Full Body Bearish',
                4: 'Normal Candle Bullish',
                5: 'Normal Candle Bearish',
                6: 'Long Upper Wick Bullish',
                7: 'Long Upper Wick Bearish',
                8: 'Long Lower Wick Bullish',
                9: 'Long Lower Wick Bearish'
            }
            df['candle_type_name'] = df['candle_type'].map(candle_type_names)

            # Calculate previous candle types (last 3 days)
            df['prev_candle_1'] = df['candle_type'].shift(1)
            df['prev_candle_2'] = df['candle_type'].shift(2)
            df['prev_candle_3'] = df['candle_type'].shift(3)

            logger.info("Technical indicators calculated successfully!")
            return df

        except Exception as e:
            logger.error(f"Unexpected error calculating indicators: {e}")
            return None

    def _validate_ohlcv_data(self, data: pd.DataFrame) -> bool:
        """Validate OHLCV data for common issues"""
        required_columns = ['open', 'high', 'low', 'close']

        # Check required columns
        missing_cols = [col for col in required_columns if col not in data.columns]
        if missing_cols:
            logger.error(f"Missing required columns: {missing_cols}")
            return False

        # Check for negative prices
        for col in required_columns:
            if (data[col] <= 0).any():
                logger.error(f"Invalid prices found in {col} column (negative or zero values)")
                return False

        # Check OHLC logic
        invalid_high = (data['high'] < data[['open', 'close']].max(axis=1)).any()
        invalid_low = (data['low'] > data[['open', 'close']].min(axis=1)).any()

        if invalid_high or invalid_low:
            logger.error("Invalid OHLC relationships found")
            return False

        logger.info("Data validation passed")
        return True

    def classify_candle_type(self, row: pd.Series) -> int:
        """
        Classify candlestick type into 10 categories based on body and wick ratios

        Classification System (5 Core Types x 2 Directions = 10 Classes):
        0: Doji Bullish-biased (body < 10%, bullish)
        1: Doji Bearish-biased (body < 10%, bearish)
        2: Full Body Bullish (body > 70%, minimal wicks)
        3: Full Body Bearish (body > 70%, minimal wicks)
        4: Normal Candle Bullish (balanced body & wicks)
        5: Normal Candle Bearish (balanced body & wicks)
        6: Long Upper Wick Bullish (upper wick > 40%, bullish)
        7: Long Upper Wick Bearish (upper wick > 40%, bearish)
        8: Long Lower Wick Bullish (lower wick > 40%, bullish)
        9: Long Lower Wick Bearish (lower wick > 40%, bearish)
        """
        open_price = row['open']
        high_price = row['high']
        low_price = row['low']
        close_price = row['close']

        # Calculate sizes
        body_size = abs(close_price - open_price)
        total_range = high_price - low_price
        upper_wick = high_price - max(open_price, close_price)
        lower_wick = min(open_price, close_price) - low_price

        # Prevent division by zero
        if total_range == 0:
            return 0  # Default to Doji Bullish-biased

        # Calculate percentages
        body_pct = body_size / total_range
        upper_wick_pct = upper_wick / total_range
        lower_wick_pct = lower_wick / total_range

        # Determine direction
        is_bullish = close_price > open_price

        # === Classification Logic ===

        # 1. Doji (body < 10%)
        if body_pct < 0.10:
            return 0 if is_bullish else 1

        # 2. Full Body (body > 70%)
        elif body_pct > 0.70:
            return 2 if is_bullish else 3

        # 3. Long Upper Wick (upper wick > 40%)
        elif upper_wick_pct > 0.40:
            return 6 if is_bullish else 7

        # 4. Long Lower Wick (lower wick > 40%)
        elif lower_wick_pct > 0.40:
            return 8 if is_bullish else 9

        # 5. Normal Candle (everything else)
        else:
            return 4 if is_bullish else 5

    def filter_data_by_date(self, data: pd.DataFrame, start_date: str = None,
                           end_date: str = None) -> Optional[pd.DataFrame]:
        """Filter data by date range with proper timezone handling"""
        if data is None or data.empty:
            logger.error("No data provided for filtering")
            return None

        # Default to 10 years ago if not specified
        if start_date is None:
            start_date = START_DATE_10_YEARS
            logger.info(f"Using default 10-year lookback: {start_date}")

        try:
            # Reset index to make datetime a column if it's an index
            if isinstance(data.index, pd.DatetimeIndex):
                df = data.reset_index()
            else:
                df = data.copy()

            # Ensure datetime column exists
            if 'datetime' not in df.columns:
                if isinstance(df.index, pd.DatetimeIndex):
                    df['datetime'] = df.index
                else:
                    logger.error("No datetime column or index found")
                    return None

            # Convert to datetime with timezone awareness
            df['datetime'] = pd.to_datetime(df['datetime'])

            # If datetime is timezone-naive, localize to UTC then convert to target timezone
            if df['datetime'].dt.tz is None:
                df['datetime'] = df['datetime'].dt.tz_localize('UTC').dt.tz_convert(self.timezone)
            else:
                df['datetime'] = df['datetime'].dt.tz_convert(self.timezone)

            # Parse date filters
            start_date_parsed = pd.to_datetime(start_date).tz_localize(self.timezone)

            if end_date:
                end_date_parsed = pd.to_datetime(end_date).tz_localize(self.timezone)
            else:
                end_date_parsed = df['datetime'].max()

            # Validate date range
            if start_date_parsed >= end_date_parsed:
                logger.error(f"Start date ({start_date_parsed}) must be before end date ({end_date_parsed})")
                return None

            # Filter by date range
            mask = (df['datetime'] >= start_date_parsed) & (df['datetime'] <= end_date_parsed)
            filtered_data = df.loc[mask].copy()

            if filtered_data.empty:
                logger.warning(f"No data found in date range {start_date_parsed.date()} to {end_date_parsed.date()}")
                return None

            # Remove volume column if exists (often unreliable for forex)
            if 'volume' in filtered_data.columns:
                filtered_data = filtered_data.drop(columns=['volume'])

            # Remove incomplete candle (today's unfinished candle)
            # But FIRST save today's open price for Open Day reference
            today = datetime.now(self.timezone).date()
            last_date = pd.to_datetime(filtered_data['datetime'].iloc[-1]).date()

            if last_date >= today:
                # Save today's open price before removing the row
                today_open = filtered_data.iloc[-1]['open']
                today_row = filtered_data.iloc[-1].to_dict()
                self._save_open_day_data(today_row, filtered_data['datetime'].iloc[-1])

                logger.info(f"Saved Open Day price: {today_open} for {last_date}")
                logger.info(f"Removing incomplete candle for {last_date} (today or future)")
                filtered_data = filtered_data.iloc[:-1]

            logger.info(f"Data filtered from {start_date_parsed.date()} to {end_date_parsed.date()}")
            logger.info(f"Total trading days: {len(filtered_data)} (~{len(filtered_data)/260:.1f} years)")

            return filtered_data

        except Exception as e:
            logger.error(f"Error filtering data: {e}")
            return None

    def _save_open_day_data(self, row_data: dict, datetime_val) -> bool:
        """Save today's open price to a JSON file for Open Day reference
        Only saves the Open price since the day is not complete yet"""
        import json

        try:
            # Determine symbol from row data
            symbol = row_data.get('symbol', 'unknown')
            if 'XAUUSD' in symbol or 'xauusd' in symbol.lower():
                filename = 'open_day_xauusd.json'
            elif 'GC1' in symbol or 'gc1' in symbol.lower():
                filename = 'open_day_gc1.json'
            else:
                filename = 'open_day_data.json'

            # Only save Open price (day not complete, other values not final)
            open_day_data = {
                'date': pd.to_datetime(datetime_val).strftime('%Y-%m-%d'),
                'symbol': symbol,
                'open': float(row_data.get('open', 0))
            }

            filepath = Path(filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(open_day_data, f, indent=2)

            logger.info(f"Open Day data saved to {filepath}")
            return True

        except Exception as e:
            logger.error(f"Error saving Open Day data: {e}")
            return False

    def save_to_csv(self, data: pd.DataFrame, filename: str = 'xauusd_10years_data.csv') -> bool:
        """Save data to CSV file with proper error handling"""
        if data is None or data.empty:
            logger.error("No data to save")
            return False

        try:
            # Ensure directory exists
            filepath = Path(filename)
            filepath.parent.mkdir(parents=True, exist_ok=True)

            # Format datetime column to show only date (YYYY-MM-DD)
            df_to_save = data.copy()
            if 'datetime' in df_to_save.columns:
                df_to_save['datetime'] = pd.to_datetime(df_to_save['datetime']).dt.strftime('%Y-%m-%d')

            # Save with proper encoding
            df_to_save.to_csv(filepath, index=False, encoding='utf-8')

            # Verify file was created and has content
            if filepath.exists() and filepath.stat().st_size > 0:
                logger.info(f"Data saved to {filepath} ({len(data)} rows)")
                return True
            else:
                logger.error(f"File {filepath} was not created properly")
                return False

        except PermissionError:
            logger.error(f"Permission denied writing to {filename}")
            return False
        except Exception as e:
            logger.error(f"Error saving to CSV {filename}: {e}")
            return False

    def run_analysis_for_symbol(self, symbol_key: str, start_date: str = None,
                                 end_date: str = None, save_csv: bool = True,
                                 output_dir: str = None) -> Optional[pd.DataFrame]:
        """
        Run analysis pipeline for a specific symbol

        Args:
            symbol_key: Key from SYMBOLS dict ('xauusd' or 'gc1')
            start_date: Start date for filtering (YYYY-MM-DD)
            end_date: End date for filtering (YYYY-MM-DD)
            save_csv: Whether to save results to CSV
            output_dir: Directory to save output files (default: current directory)

        Returns:
            DataFrame with analysis results or None if failed
        """
        if symbol_key not in SYMBOLS:
            logger.error(f"Unknown symbol key: {symbol_key}. Available: {list(SYMBOLS.keys())}")
            return None

        config = SYMBOLS[symbol_key]
        symbol = config['symbol']
        exchange = config['exchange']
        output_file = config['output_file']

        # Add output directory if specified
        if output_dir:
            output_file = str(Path(output_dir) / output_file)

        # Default to 10 years if not specified
        if start_date is None:
            start_date = START_DATE_10_YEARS

        logger.info("="*60)
        logger.info(f"Analyzing: {config['name']} ({symbol} from {exchange})")
        logger.info(f"Type: {config['market_type']}")
        logger.info(f"Description: {config['description']}")
        logger.info(f"Date range: {start_date} to {end_date or 'present'}")
        logger.info("="*60)

        try:
            # Step 1: Fetch raw data
            logger.info(f"Step 1: Fetching {symbol} data (up to {DEFAULT_N_BARS} bars)...")
            raw_data = self.fetch_data(symbol=symbol, exchange=exchange)
            if raw_data is None:
                logger.error(f"Failed to fetch raw data for {symbol}")
                return None

            # Step 2: Calculate technical indicators
            logger.info("Step 2: Calculating technical indicators...")
            data_with_indicators = self.calculate_indicators(raw_data)
            if data_with_indicators is None:
                logger.error("Failed to calculate indicators")
                return None

            # Step 3: Filter by date range
            logger.info(f"Step 3: Filtering data from {start_date}...")
            filtered_data = self.filter_data_by_date(data_with_indicators, start_date, end_date)
            if filtered_data is None:
                logger.error("Failed to filter data")
                return None

            logger.info(f"Filtered data size: {len(filtered_data)} rows")

            # Step 4: Save to CSV if requested
            if save_csv:
                logger.info(f"Step 4: Saving data to {output_file}...")
                if not self.save_to_csv(filtered_data, output_file):
                    logger.warning("Failed to save CSV, but continuing analysis")

            logger.info(f"Analysis completed for {symbol}")
            return filtered_data

        except Exception as e:
            logger.error(f"Error in analysis pipeline for {symbol}: {e}")
            return None

    def run_full_analysis(self, symbols: List[str] = None, start_date: str = None,
                          end_date: str = None, save_csv: bool = True,
                          output_dir: str = None) -> Dict[str, pd.DataFrame]:
        """
        Run analysis pipeline for multiple symbols

        Args:
            symbols: List of symbol keys to analyze (default: all symbols)
            start_date: Start date for filtering (YYYY-MM-DD)
            end_date: End date for filtering (YYYY-MM-DD)
            save_csv: Whether to save results to CSV
            output_dir: Directory to save output files

        Returns:
            Dictionary mapping symbol keys to their DataFrames
        """
        if symbols is None:
            symbols = list(SYMBOLS.keys())

        results = {}

        logger.info("="*70)
        logger.info("Multi-Symbol 10-Year Gold Price Analysis")
        logger.info(f"Symbols to analyze: {', '.join(symbols)}")
        logger.info("="*70)

        for symbol_key in symbols:
            data = self.run_analysis_for_symbol(
                symbol_key=symbol_key,
                start_date=start_date,
                end_date=end_date,
                save_csv=save_csv,
                output_dir=output_dir
            )
            if data is not None:
                results[symbol_key] = data
            else:
                logger.warning(f"Failed to analyze {symbol_key}")

        return results


def fetch_h1_data_for_basis(fetcher: TradingView10YearsFetcher, output_dir: str = None) -> Dict[str, pd.DataFrame]:
    """
    Fetch H1 (hourly) data for basis calculation & session analysis
    - Basis: Uses SMA20 on H1 timeframe for more responsive basis
    - Session Analysis: Analyzes Asian/London/NY session patterns

    Args:
        fetcher: TradingView10YearsFetcher instance
        output_dir: Directory to save output files

    Returns:
        Dictionary mapping symbol keys to their DataFrames
    """
    results = {}

    logger.info("="*70)
    logger.info("Fetching H1 Data for Basis Calculation & Session Analysis")
    logger.info("="*70)

    for symbol_key, config in SYMBOLS_H1.items():
        symbol = config['symbol']
        exchange = config['exchange']
        n_bars = config.get('n_bars', 100)
        output_file = config['output_file']

        if output_dir:
            output_file = str(Path(output_dir) / output_file)

        logger.info(f"\nFetching {symbol} H1 data ({n_bars} bars)...")

        try:
            # Fetch H1 data
            data = fetcher.fetch_data(
                symbol=symbol,
                exchange=exchange,
                interval=Interval.in_1_hour,
                n_bars=n_bars
            )

            if data is not None and not data.empty:
                # Reset index and format
                df = data.reset_index()

                # Rename columns if needed
                if 'datetime' not in df.columns and df.index.name == 'datetime':
                    df = df.reset_index()

                # Format datetime
                if 'datetime' in df.columns:
                    df['datetime'] = pd.to_datetime(df['datetime']).dt.strftime('%Y-%m-%d %H:%M:%S')

                # Add symbol column
                df['symbol'] = f"{exchange}:{symbol}"

                # Save to CSV
                filepath = Path(output_file)
                df.to_csv(filepath, index=False, encoding='utf-8')

                logger.info(f"Saved {len(df)} H1 bars to {filepath}")
                results[symbol_key] = df
            else:
                logger.warning(f"No H1 data received for {symbol}")

        except Exception as e:
            logger.error(f"Error fetching H1 data for {symbol}: {e}")

    return results


def print_summary(results: Dict[str, pd.DataFrame]):
    """Print summary statistics for all analyzed symbols"""
    logger.info("\n" + "="*70)
    logger.info("ANALYSIS SUMMARY")
    logger.info("="*70)

    for symbol_key, data in results.items():
        config = SYMBOLS[symbol_key]

        logger.info(f"\n{'-'*50}")
        logger.info(f"{config['name']} ({config['symbol']}) - {config['market_type']}")
        logger.info(f"{'-'*50}")

        logger.info(f"Data shape: {data.shape}")
        logger.info(f"Date range: {data['datetime'].min()} to {data['datetime'].max()}")

        # Calculate years of data
        date_range = pd.to_datetime(data['datetime'].max()) - pd.to_datetime(data['datetime'].min())
        years_of_data = date_range.days / 365.25
        logger.info(f"Total period: {years_of_data:.1f} years ({len(data)} trading days)")

        # Price summary
        latest_price = data['close'].iloc[-1]
        first_price = data['close'].iloc[0]
        total_change = latest_price - first_price
        total_change_pct = (total_change / first_price * 100) if first_price != 0 else 0

        logger.info(f"First Price: ${first_price:.2f}")
        logger.info(f"Latest Price: ${latest_price:.2f}")
        logger.info(f"Total Change: ${total_change:.2f} ({total_change_pct:.2f}%)")
        logger.info(f"Highest Price: ${data['high'].max():.2f}")
        logger.info(f"Lowest Price: ${data['low'].min():.2f}")
        logger.info(f"Output file: {config['output_file']}")

    # Print comparison if both symbols analyzed
    if 'xauusd' in results and 'gc1' in results:
        logger.info(f"\n{'-'*50}")
        logger.info("COMPARISON: XAUUSD vs GC1!")
        logger.info(f"{'-'*50}")

        xauusd = results['xauusd']
        gc1 = results['gc1']

        xauusd_latest = xauusd['close'].iloc[-1]
        gc1_latest = gc1['close'].iloc[-1]
        spread = gc1_latest - xauusd_latest

        logger.info(f"Latest XAUUSD: ${xauusd_latest:.2f}")
        logger.info(f"Latest GC1!: ${gc1_latest:.2f}")
        logger.info(f"Spread (Futures - CFD): ${spread:.2f} ({spread/xauusd_latest*100:.3f}%)")

    logger.info("\n" + "="*70)
    logger.info("OUTPUT FILES:")
    for symbol_key in results.keys():
        logger.info(f"  - {SYMBOLS[symbol_key]['output_file']}")
    logger.info("="*70)


def main():
    """Main execution function - Multi-Symbol 10 Years Historical Data"""
    import argparse

    parser = argparse.ArgumentParser(description='Fetch 10 years of Gold price data from TradingView')
    parser.add_argument('--symbols', nargs='+', choices=['xauusd', 'gc1', 'all'],
                        default=['all'], help='Symbols to fetch (default: all)')
    parser.add_argument('--output-dir', type=str, default=None,
                        help='Output directory for CSV files')
    args = parser.parse_args()

    # Parse symbols
    if 'all' in args.symbols:
        symbols = list(SYMBOLS.keys())
    else:
        symbols = args.symbols

    logger.info("="*70)
    logger.info("Gold Price 10-Year Historical Analysis")
    logger.info("Multi-Symbol: XAUUSD (CFD) + GC1! (Futures)")
    logger.info("="*70)

    try:
        # Create fetcher instance
        fetcher = TradingView10YearsFetcher()

        # Run analysis for selected symbols
        results = fetcher.run_full_analysis(
            symbols=symbols,
            save_csv=True,
            output_dir=args.output_dir
        )

        if results:
            print_summary(results)

            # Also fetch H1 data for basis calculation
            logger.info("\n" + "="*70)
            logger.info("Fetching H1 data for Basis calculation...")
            logger.info("="*70)
            h1_results = fetch_h1_data_for_basis(fetcher, output_dir=args.output_dir)

            if h1_results:
                logger.info(f"\nH1 data fetched for {len(h1_results)} symbols")
                for key, df in h1_results.items():
                    logger.info(f"  - {SYMBOLS_H1[key]['output_file']}: {len(df)} bars")

            logger.info("\nANALYSIS COMPLETE!")
        else:
            logger.error("Failed to fetch and analyze data for any symbol")
            logger.error("Please check:")
            logger.error("1. Internet connection")
            logger.error("2. TradingView credentials in .env file")
            logger.error("3. TRADINGVIEW_USERNAME environment variable")
            sys.exit(1)

    except KeyboardInterrupt:
        logger.info("Analysis interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Unexpected error in main: {e}")
        logger.error("Please check your setup and try again")
        sys.exit(1)


if __name__ == "__main__":
    main()
