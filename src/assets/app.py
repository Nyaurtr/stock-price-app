from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
from sklearn.linear_model import LinearRegression
import numpy as np
from fastapi.middleware.cors import CORSMiddleware
import statsmodels.api as sm

try:
    from xgboost import XGBRegressor
    USE_XGBOOST = True
except ImportError:
    USE_XGBOOST = False

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load monthly return and factor data
returns_path = "D:/Personal Project/Code/Website/stock-price-app/src/assets/monthly_prices_complete_2020_to_2025.csv"
factors_path = "D:/Personal Project/Code/Website/stock-price-app/src/assets/final_five_factors.csv"

price_df = pd.read_csv(returns_path, parse_dates=['Date']).set_index('Date')
factors_df = pd.read_csv(factors_path, parse_dates=['Date']).set_index('Date')

# Tính lợi suất hàng tháng
df_returns = price_df.pct_change(fill_method=None).dropna() * 100

# Cắt về khoảng thời gian chung
df_returns = df_returns[(df_returns.index >= factors_df.index.min()) & (df_returns.index <= factors_df.index.max())]
df_factors = factors_df.copy()

# Input request schema
class PortfolioInput(BaseModel):
    tickers: List[str]
    weights: Optional[List[float]] = None
    investment: Optional[float] = 1_000_000_000
    factors: Optional[List[str]] = ["mkt", "size", "value", "mom", "inv", "profit"]
    model_choice: Optional[str] = "linear"  # or "xgboost"

    class Config:
        protected_namespaces = ()

def get_portfolio_returns(tickers, weights=None):
    returns = df_returns[tickers]
    if weights is None:
        weights = [1 / len(tickers)] * len(tickers)
    weighted_returns = returns.multiply(weights, axis=1)
    portfolio_return = weighted_returns.sum(axis=1)
    return portfolio_return.dropna()

def run_factor_model(portfolio_ret, factor_cols):
    data = pd.concat([portfolio_ret.rename("portfolio_return"), df_factors[factor_cols]], axis=1, join='inner')
    data = data.replace([np.inf, -np.inf], np.nan).dropna()

    X = data[factor_cols]
    y = data["portfolio_return"]

    # Sklearn model for basic calculations
    model = LinearRegression().fit(X, y)
    beta = model.coef_
    alpha = model.intercept_
    r_squared = model.score(X, y)
    residual_std = np.std(y - model.predict(X))
    
    # Use statsmodels to calculate p-values
    X_with_const = sm.add_constant(X)
    sm_model = sm.OLS(y, X_with_const).fit()
    p_values = sm_model.pvalues.to_dict()
    
    # Extract alpha p-value
    alpha_p_value = p_values.get('const', None)
    
    # Extract factor p-values
    factor_p_values = {factor: p_values.get(factor, None) for factor in factor_cols}

    return {
        "alpha": alpha,
        "alpha_p_value": alpha_p_value,
        "r_squared": r_squared,
        "beta": dict(zip(factor_cols, beta)),
        "beta_p_values": factor_p_values,
        "residual_std": residual_std,
        "n_samples": len(data)
    }

@app.post("/api/1factor")
def one_factor(input: PortfolioInput):
    port_ret = get_portfolio_returns(input.tickers, input.weights)
    return run_factor_model(port_ret, ['mkt'])

@app.post("/api/3factors")
def three_factors(input: PortfolioInput):
    port_ret = get_portfolio_returns(input.tickers, input.weights)
    return run_factor_model(port_ret, ['mkt', 'size', 'value'])

@app.post("/api/4factors")
def four_factors(input: PortfolioInput):
    port_ret = get_portfolio_returns(input.tickers, input.weights)
    return run_factor_model(port_ret, ['mkt', 'size', 'value', 'mom'])

@app.post("/api/5factors")
def five_factors(input: PortfolioInput):
    port_ret = get_portfolio_returns(input.tickers, input.weights)
    return run_factor_model(port_ret, ['mkt', 'size', 'value', 'inv', 'profit'])

@app.post("/api/ai_predict")
def ai_predict(input: PortfolioInput):
    port_ret = get_portfolio_returns(input.tickers, input.weights)
    df = pd.concat([port_ret.rename("portfolio_return"), df_factors], axis=1).dropna()

    selected_factors = input.factors
    X = df[selected_factors]
    y = df["portfolio_return"]

    if input.model_choice == "xgboost" and USE_XGBOOST:
        model = XGBRegressor()
        model_name = "XGBoost"
    else:
        model = LinearRegression()
        model_name = "LinearRegression"

    model.fit(X, y)
    y_pred = model.predict(X)
    mse = np.mean((y - y_pred) ** 2)
    pred_next_month = y_pred[-1].item()
    pred_next_year = ((1 + pred_next_month / 100) ** 12 - 1) * 100

    invested = input.investment
    gain_month = invested * pred_next_month / 100
    gain_year = invested * pred_next_year / 100
    
    # Calculate p-values using statsmodels
    X_with_const = sm.add_constant(X)
    sm_model = sm.OLS(y, X_with_const).fit()
    p_values = sm_model.pvalues.to_dict()
    
    # Extract alpha p-value
    alpha_p_value = p_values.get('const', None)
    
    # Extract factor p-values
    factor_p_values = {factor: p_values.get(factor, None) for factor in selected_factors}

    return {
        "model": model_name,
        "factors_used": selected_factors,
        "mse": mse,
        "alpha_p_value": alpha_p_value,
        "factor_p_values": factor_p_values,
        "next_month_prediction (%)": pred_next_month,
        "next_year_estimate (%)": pred_next_year,
        "investment": invested,
        "expected_gain_next_month (VND)": gain_month,
        "expected_gain_next_year (VND)": gain_year
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)