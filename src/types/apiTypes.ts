export interface ApiResponse {
  status: string;
  message: string;
  data?: unknown;
  dataList?: unknown[];
  totalrecord?: number;
  totalRecord?: number;
}

export type ApiFunction = () => Promise<ApiResponse>; 

export interface StockPriceData {
  tradingDate: string;
  priceChange?: number;
  perPriceChange?: number;
  ceilingPrice?: number;
  floorPrice?: number;
  refPrice?: number;
  openPrice: number;
  highestPrice: number;
  lowestPrice: number;
  closePrice: number;
  averagePrice?: number;
  closePriceAdjusted?: number;
  totalMatchVol?: number;
  totalMatchVal?: number;
  totalDealVal?: number;
  totalDealVol?: number;
  foreignBuyVolTotal?: number;
  foreignCurrentRoom?: number;
  foreignSellVolTotal?: number;
  foreignBuyValTotal?: number;
  foreignSellValTotal?: number;
  totalBuyTrade?: number;
  totalBuyTradeVol?: number;
  totalSellTrade?: number;
  totalSellTradeVol?: number;
  netBuySellVol?: number;
  netBuySellVal?: number;
  totalTradedVol?: number;
  totalTradedValue?: number;
  symbol: string;
  time?: string;
  totalQuantity?: number;
}

export interface TopStock {
  symbol: string;
  final_score: number;
  momentum: number;
  volume_strength: number;
  volatility: number;
  foreign_interest: number;
  recent_change: number;
}

export interface PortfolioStock {
  symbol: string;
  investment: number;
  weight: number;
  stockInfo: TopStock;
}

export interface PortfolioAIPrediction {
  model: string;
  factors_used: string[];
  mse: number;
  next_month_prediction: number;
  next_year_estimate: number;
  investment: number;
  expected_gain_next_month: number;
  expected_gain_next_year: number;
  recommendation?: string;
  alpha_p_value?: number;
  factor_p_values?: Record<string, number>;
}

export interface FactorModelResult {
  alpha: number;           // Hiệu quả đầu tư (trên mức kỳ vọng)
  alpha_p_value?: number;  // P-value for alpha
  r_squared: number;       // Mức độ giải thích của mô hình
  beta: Record<string, number>; // Độ rủi ro so với các yếu tố thị trường
  beta_p_values?: Record<string, number>; // P-values for beta coefficients
  residual_std: number;    // Độ biến động riêng của danh mục
  n_samples: number;       // Số mẫu dữ liệu
  marketBeta?: number;     // Market beta from 1-factor model
  marketBetaPValue?: number; // P-value for market beta
}

export interface StockPrediction {
  prediction: number; // 0 or 1
  probability: number; // confidence value
}

export interface StockPredictions {
  [symbol: string]: {
    bubble?: StockPrediction | null;
    trend?: StockPrediction | null;
  };
} 