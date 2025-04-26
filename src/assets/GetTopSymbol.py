import requests
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os
import csv
import time  # For rate limiting
from tqdm import tqdm  # For progress bar (pip install tqdm)


# Load environment variables
load_dotenv()
CONSUMER_ID = os.getenv("CONSUMER_ID")
CONSUMER_SECRET = os.getenv("CONSUMER_SECRET")


BASE_SSI_API_URL = "https://fc-data.ssi.com.vn/api/v2/Market"

def get_access_token():
    """Retrieves the access token using consumer ID and secret from .env."""


    url = f"{BASE_SSI_API_URL}/AccessToken"
    payload = {
        "consumerID": CONSUMER_ID,
        "consumerSecret": CONSUMER_SECRET
    }
    response = requests.post(url, json=payload)
    response.raise_for_status()
    return response.json()["data"]["accessToken"]


def fetch_stock_list(market, token):      
    """Fetches the list of stocks for a given market."""


    url = f"{BASE_SSI_API_URL}/Securities"
    params = {"market": market, "pageIndex": 1, "pageSize": 1000}
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, params=params, headers=headers)
    response.raise_for_status()
    data = response.json()
    return data.get("data", [])


def fetch_daily_ohlc(symbol, from_date, to_date, token):
    """Fetches daily OHLC data for a given symbol and date range."""


    url = f"{BASE_SSI_API_URL}/DailyOhlc"
    params = {
        "Symbol": symbol,
        "FromDate": from_date,
        "ToDate": to_date,
        "PageIndex": 1,
        "PageSize": 1000,
        "ascending": True,
    }
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, params=params, headers=headers)
    response.raise_for_status()
    data = response.json()
    return data.get("data", [])


def fetch_daily_stock_price(symbol, from_date, to_date, market, token):
    """Fetches daily stock price data."""


    url = f"{BASE_SSI_API_URL}/DailyStockPrice"
    params = {
        "Symbol": symbol,
        "FromDate": from_date,
        "ToDate": to_date,
        "PageIndex": 1,
        "PageSize": 1000,
        "Market": market,
    }
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, params=params, headers=headers)
    response.raise_for_status()
    data = response.json()
    return data.get("data", [])


def calculate_momentum(ohlc_data):
    """Calculates momentum based on closing prices."""
    closes = np.array([float(day["Close"]) for day in ohlc_data])
    if len(closes) < 2:
        return 0
    momentum = (closes[-1] - closes[0]) / closes[0]
    return momentum


def calculate_volume_strength(daily_price_data):
    """Calculates volume strength."""


    volumes = np.array([float(day["TotalTradedVol"]) for day in daily_price_data])
    if not volumes.size:
        return 0
    avg_volume = np.mean(volumes)
    recent_volume = volumes[-1] if volumes.size > 0 else 0
    return recent_volume / avg_volume if avg_volume else 0


def calculate_volatility(ohlc_data):
    """Calculates volatility."""


    closes = np.array([float(day["Close"]) for day in ohlc_data])
    if len(closes) < 2:
        return 0
    daily_changes = np.diff(closes)
    volatility = np.std(daily_changes)
    return volatility


def calculate_foreign_interest(daily_price_data):
    """Calculates foreign interest."""


    total_volume = np.array([float(day["TotalTradedVol"]) for day in daily_price_data])
    foreign_buy_volume = np.array([float(day["ForeignBuyVolTotal"]) for day in daily_price_data])


    if not total_volume.size or np.sum(total_volume) == 0:
        return 0


    foreign_interest = np.sum(foreign_buy_volume) / np.sum(total_volume) if np.sum(total_volume) else 0
    return foreign_interest


def calculate_recent_price_change(daily_price_data):
    """Calculates recent price change."""
    if not daily_price_data:
        return 0
    start_price = float(daily_price_data[0]["OpenPrice"]) if daily_price_data else 0
    end_price = float(daily_price_data[-1]["ClosePrice"]) if daily_price_data else 0
    if start_price == 0:
        return 0
    return (end_price - start_price) / start_price


def normalize_array(arr):
    """Normalizes a numpy array to the range 0-1."""
    arr_np = np.array(arr)
    min_val = np.min(arr_np)
    max_val = np.max(arr_np)
    if max_val == min_val:
        return [0.5] * len(arr)
    return ((arr_np - min_val) / (max_val - min_val)).tolist()


def analyze_stocks(stocks, from_date, to_date, market, token, weights):
    """Analyzes stocks with progress tracking and returns the top N."""


    stock_scores = []
    all_momentums = []
    all_volume_strengths = []
    all_volatilities = []
    all_foreign_interests = []
    all_recent_changes = []


    # Initialize tqdm progress bar
    with tqdm(total=len(stocks), desc="Analyzing Stocks") as pbar:
        for stock in stocks:
            symbol = stock["Symbol"]
            ohlc_data = fetch_daily_ohlc(symbol, from_date, to_date, token)
            daily_price_data = fetch_daily_stock_price(symbol, from_date, to_date, market, token)

            momentum = calculate_momentum(ohlc_data)
            volume_strength = calculate_volume_strength(daily_price_data)
            volatility = calculate_volatility(ohlc_data)
            foreign_interest = calculate_foreign_interest(daily_price_data)
            recent_change = calculate_recent_price_change(daily_price_data)

            print(f"Analyzing {symbol}:")
            print(f"  Momentum: {momentum:.2f}")
            print(f"  Volume Strength: {volume_strength:.2f}")
            print(f"  Volatility: {volatility:.2f}")
            print(f"  Foreign Interest: {foreign_interest:.2f}")
            print(f"  Recent Change: {recent_change:.2f}")
            print("-" * 40)


            all_momentums.append(momentum)
            all_volume_strengths.append(volume_strength)
            all_volatilities.append(volatility)
            all_foreign_interests.append(foreign_interest)
            all_recent_changes.append(recent_change)

            stock_scores.append(
                {
                    "symbol": symbol,
                    "momentum": momentum,
                    "volume_strength": volume_strength,
                    "volatility": volatility,
                    "foreign_interest": foreign_interest,
                    "recent_change": recent_change,
                }
            )
            pbar.update(1)  # Update progress bar
            time.sleep(0.1)  # Rate limiting (adjust as needed)


    # Normalize and calculate final scores
    normalized_scores = []
    if stock_scores:
        norm_momentum = normalize_array(all_momentums)
        norm_volume = normalize_array(all_volume_strengths)
        norm_volatility = normalize_array(all_volatilities)
        norm_foreign = normalize_array(all_foreign_interests)
        norm_recent = normalize_array(all_recent_changes)


    for i, stock_score in enumerate(stock_scores):
        final_score = (
            norm_momentum[i] * weights["momentum"]
            + norm_volume[i] * weights["volume_strength"]
            + norm_volatility[i] * weights["volatility"]
            + norm_foreign[i] * weights["foreign_interest"]
            + norm_recent[i] * weights["recent_change"]
        )
        normalized_scores.append({**stock_score, "final_score": final_score})

    sorted_stocks = sorted(normalized_scores, key=lambda x: x["final_score"], reverse=True)
    return sorted_stocks


def get_top_potential_stocks(market, weights, top_n, past_days):
    """
    Main function to get the top N potential stocks for a given market.


    Args:
    market (str): The market to analyze (e.g., "HOSE", "HNX").
    weights (dict): Weights for the factors.
    top_n (int): Number of top stocks to return.
    past_days (int): Lookback period.


    Returns:
    list: A list of dictionaries, each containing stock information
    and its final potential score.
    """
    token = get_access_token()
    today = datetime.now()
    from_date = (today - timedelta(days=past_days)).strftime("%d/%m/%Y")
    to_date = today.strftime("%d/%m/%Y")


    stocks = fetch_stock_list(market, token)
    if stocks:
        top_stocks = analyze_stocks(stocks, from_date, to_date, market, token, weights)
        return top_stocks, top_stocks[:top_n]
    else:
        print(f"Could not retrieve stock list for {market}")
        return []


if __name__ == "__main__":
    MARKET = "HOSE"
    WEIGHTS = {
        "momentum": 0.3,
        "volume_strength": 0.2,
        "volatility": 0.15,
        "foreign_interest": 0.25,
        "recent_change": 0.1,
    }
    TOP_N = 20
    PAST_DAYS = 30


    all_stocks, top_stocks = get_top_potential_stocks(MARKET, WEIGHTS, TOP_N, PAST_DAYS)

if top_stocks:
    print(f"--- Top {TOP_N} Stocks in {MARKET} ---")
    for stock in top_stocks:
        print(
            f"{stock['symbol']}: Score={stock['final_score']:.2f}, "
            f"Momentum={stock['momentum']:.2f}, Volume={stock['volume_strength']:.2f}, "
            f"Volatility={stock['volatility']:.2f}, Foreign={stock['foreign_interest']:.2f}, "
            f"Recent Change={stock['recent_change']:.2f}"
        )
    # Export top stocks to a CSV file
    output_file = "top_stocks.csv"
    with open(output_file, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=["symbol", "final_score", "momentum", "volume_strength", "volatility", "foreign_interest", "recent_change"])
        writer.writeheader()
        writer.writerows(top_stocks)

    output_file_1 = "all_stocks.csv"
    with open(output_file_1, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=["symbol", "final_score", "momentum", "volume_strength", "volatility", "foreign_interest", "recent_change"])
        writer.writeheader()
        writer.writerows(all_stocks)

    print(f"Top stocks have been exported to {output_file} and {output_file_1}.")
else:
    print("Could not retrieve top stocks.")

# Read the all_stocks.csv file
all_stocks_df = pd.read_csv("all_stocks.csv")

# Drop rows where any column has a value of 0 or 1
filtered_stocks_df = all_stocks_df[(all_stocks_df != 0).all(axis=1) & (all_stocks_df != 1).all(axis=1)]

# Export the filtered data to all_stock_drop.csv
filtered_stocks_df.to_csv("all_stock_drop.csv", index=False)

# Sort by final_score in descending order and take the top 20
top_20_stocks_df = filtered_stocks_df.sort_values(by="final_score", ascending=False).head(20)

# Export the top 20 stocks to top_20_stock.csv
top_20_stocks_df.to_csv("top_20_stock.csv", index=False)