import { useState, useEffect, useMemo } from 'react';
import { TopStock, PortfolioStock, PortfolioAIPrediction, FactorModelResult, StockPredictions } from '../types/apiTypes';
import apiService from '../services/apiService';

// Available factors for selection
// const ALL_FACTORS = ["mkt", "size", "value", "mom", "inv", "profit"];
// Factor model types
const FACTOR_MODELS = [
  { id: '1factor', label: '1-Factor Model', endpoint: '1factor', description: 'Market factor only (CAPM)' },
  { id: '3factors', label: '3-Factor Model', endpoint: '3factors', description: 'Market, Size, Value factors (Fama-French 3-Factor)' },
  { id: '4factors', label: '4-Factor Model', endpoint: '4factors', description: 'Market, Size, Value, Momentum (Carhart 4-Factor)' },
  { id: '5factors', label: '5-Factor Model', endpoint: '5factors', description: 'Market, Size, Value, Investment, Profitability (Fama-French 5-Factor)' },
];

// Format currency
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

// Format percentage
const formatPercentage = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
};

const PortfolioBuilderPage: React.FC = () => {
  const [topStocks, setTopStocks] = useState<TopStock[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioStock[]>([]);
  const [prediction, setPrediction] = useState<PortfolioAIPrediction | null>(null);
  const [factorResult, setFactorResult] = useState<FactorModelResult | null>(null);
  const [predictLoading, setPredictLoading] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('1factor');
  const [stockPredictions, setStockPredictions] = useState<StockPredictions>({});
  const [predictionsLoading, setPredictionsLoading] = useState<boolean>(false);
  
  // Calculate total investment
  const totalInvestment = useMemo(() => {
    return portfolio.reduce((sum, stock) => sum + stock.investment, 0);
  }, [portfolio]);
  
  // Load top 20 stocks on component mount
  useEffect(() => {
    const loadTopStocks = async () => {
      try {
        setLoading(true);
        const stocks = await apiService.getTop20Stocks();
        setTopStocks(stocks);
        setError(null);
        
        // After loading stocks, fetch predictions for them
        fetchPredictionsForStocks(stocks.map(stock => stock.symbol));
      } catch (err) {
        console.error('Failed to load top stocks:', err);
        setError('Failed to load top stocks. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    loadTopStocks();
  }, []);
  
  // Fetch predictions for all top stocks
  const fetchPredictionsForStocks = async (symbols: string[]) => {
    if (!symbols.length) return;
    
    setPredictionsLoading(true);
    const predictions: StockPredictions = {};
    
    try {
      // Process 5 stocks at a time to avoid overloading the API
      const batchSize = 5;
      
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        
        // Fetch predictions for each symbol in the batch
        const batchPromises = batch.map(async (symbol) => {
          try {
            // Use fixed dates for predictions
            const bubbleDate = '2025-03-01'; // Fixed date for BB predictions
            const trendDate = '2025-04-13';  // Fixed date for UD predictions
            
            predictions[symbol] = {};
            
            // Fetch bubble prediction (BB)
            try {
              const bubbleResponse = await apiService.getStockModelPrediction(
                symbol,
                'BB',
                bubbleDate
              );
              
              // Process bubble prediction only if successful and has data
              if (bubbleResponse.status === 'success' && 
                  Array.isArray(bubbleResponse.data) && 
                  bubbleResponse.data.length > 0) {
                const bubbleData = bubbleResponse.data[0];
                predictions[symbol].bubble = {
                  prediction: bubbleData.Prediction,
                  probability: bubbleData.Prob_Class_1
                };
              } else {
                // No valid data, set to null
                predictions[symbol].bubble = null;
              }
            } catch (error) {
              console.error(`Error fetching bubble prediction for ${symbol}:`, error);
              predictions[symbol].bubble = null;
            }
            
            // Fetch trend prediction (UD)
            try {
              const trendResponse = await apiService.getStockModelPrediction(
                symbol,
                'UD',
                trendDate
              );
              
              // Process trend prediction only if successful and has data
              if (trendResponse.status === 'success' && 
                  Array.isArray(trendResponse.data) && 
                  trendResponse.data.length > 0) {
                const trendData = trendResponse.data[0];
                predictions[symbol].trend = {
                  prediction: trendData.Prediction,
                  probability: trendData.Prob_Class_1
                };
              } else {
                // No valid data, set to null
                predictions[symbol].trend = null;
              }
            } catch (error) {
              console.error(`Error fetching trend prediction for ${symbol}:`, error);
              predictions[symbol].trend = null;
            }
          } catch (error) {
            console.error(`Error in prediction process for ${symbol}:`, error);
            predictions[symbol] = { bubble: null, trend: null };
          }
        });
        
        // Wait for all predictions in this batch
        await Promise.all(batchPromises);
        
        // Short delay between batches to avoid overloading the API
        if (i + batchSize < symbols.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      setStockPredictions(predictions);
    } catch (error) {
      console.error('Error fetching predictions for stocks:', error);
    } finally {
      setPredictionsLoading(false);
    }
  };
  
  // Add stock to portfolio
  const addStockToPortfolio = (stock: TopStock) => {
    // Check if stock is already in portfolio
    if (portfolio.some(item => item.symbol === stock.symbol)) {
      return;
    }
    
    setPortfolio([
      ...portfolio,
      {
        symbol: stock.symbol,
        investment: 0,
        weight: 0,
        stockInfo: stock
      }
    ]);
  };
  
  // Remove stock from portfolio
  const removeStockFromPortfolio = (symbol: string) => {
    setPortfolio(portfolio.filter(stock => stock.symbol !== symbol));
  };
  
  // Update investment amount for a stock
  const updateInvestment = (symbol: string, amount: number) => {
    const newPortfolio = portfolio.map(stock => {
      if (stock.symbol === symbol) {
        return { ...stock, investment: amount };
      }
      return stock;
    });
    
    setPortfolio(newPortfolio);
  };
  
  // Update weights based on investments
  useEffect(() => {
    if (totalInvestment === 0) return;
    
    // Check if any weights need updating to avoid infinite loop
    const needsUpdate = portfolio.some(stock => 
      Math.abs((stock.investment / totalInvestment) - stock.weight) > 0.0001
    );
    
    if (needsUpdate) {
      const newPortfolio = portfolio.map(stock => ({
        ...stock,
        weight: stock.investment / totalInvestment
      }));
      
      setPortfolio(newPortfolio);
    }
  }, [totalInvestment]);
  
  // Get prediction for portfolio
  const getPrediction = async () => {
    if (portfolio.length === 0) {
      setError('Please add at least one stock to your portfolio');
      return;
    }
    
    if (totalInvestment === 0) {
      setError('Please invest some money in your portfolio');
      return;
    }
    
    try {
      setPredictLoading(true);
      setError(null);
      
      const tickers = portfolio.map(stock => stock.symbol);
      const weights = portfolio.map(stock => stock.weight);
      
      // Find the selected model configuration
      const model = FACTOR_MODELS.find(m => m.id === selectedModel);
      if (!model) {
        throw new Error('Invalid model selected');
      }
      
      // Determine which factors to use based on the selected model
      let factorsToUse: string[] = [];
      
      if (model.id === '1factor') {
        factorsToUse = ['mkt'];
      } else if (model.id === '3factors') {
        factorsToUse = ['mkt', 'size', 'value'];
      } else if (model.id === '4factors') {
        factorsToUse = ['mkt', 'size', 'value', 'mom'];
      } else if (model.id === '5factors') {
        factorsToUse = ['mkt', 'size', 'value', 'inv', 'profit'];
      }
      
      // 1. Always get one factor model result for market beta
      const oneFactorResult = await apiService.getPortfolioOneFactorModel(tickers, weights);
      
      // 2. Get factor model results based on selected model
      let factorModelResult: FactorModelResult;
      
      if (model.id === '1factor') {
        factorModelResult = oneFactorResult;
      } else if (model.id === '3factors') {
        factorModelResult = await apiService.getPortfolioThreeFactorModel(tickers, weights);
      } else if (model.id === '4factors') {
        factorModelResult = await apiService.getPortfolioFourFactorModel(tickers, weights);
      } else {
        factorModelResult = await apiService.getPortfolioFiveFactorModel(tickers, weights);
      }
      
      // Add market beta from one factor model to other factor models
      if (model.id !== '1factor' && oneFactorResult.beta && factorModelResult.beta) {
        factorModelResult.marketBeta = oneFactorResult.beta['mkt'];
        factorModelResult.marketBetaPValue = oneFactorResult.beta_p_values?.['mkt'];
      }
      
      // Save factor model result
      setFactorResult(factorModelResult);
      
      // 3. Get AI prediction for portfolio
      const result = await apiService.getPortfolioAIPrediction(
        tickers,
        weights,
        totalInvestment,
        factorsToUse,
        "linear"
      );
      
      // Process prediction result
      interface RawPrediction {
        model: string;
        factors_used: string[];
        mse: number;
        'next_month_prediction (%)': number;
        'next_year_estimate (%)': number;
        investment: number;
        'expected_gain_next_month (VND)': number;
        'expected_gain_next_year (VND)': number;
        alpha_p_value?: number;
        factor_p_values?: Record<string, number>;
      }
      
      const rawPrediction = result as unknown as RawPrediction;
      
      // Determine buy/sell recommendation
      let recommendation = "HOLD";
      if (rawPrediction['expected_gain_next_month (VND)'] > 0 && rawPrediction['expected_gain_next_year (VND)'] > 0) {
        recommendation = "BUY - Positive expected returns in both short and long term";
      } else if (rawPrediction['expected_gain_next_month (VND)'] < 0 && rawPrediction['expected_gain_next_year (VND)'] < 0) {
        recommendation = "SELL - Negative expected returns in both short and long term";
      } else if (rawPrediction['expected_gain_next_year (VND)'] > 0) {
        recommendation = "HOLD/BUY - Positive expected returns in long term";
      } else if (rawPrediction['expected_gain_next_month (VND)'] > 0) {
        recommendation = "SHORT-TERM TRADE - Consider short-term gains only";
      }
      
      setPrediction({
        model: rawPrediction.model,
        factors_used: rawPrediction.factors_used,
        mse: rawPrediction.mse,
        next_month_prediction: rawPrediction['next_month_prediction (%)'],
        next_year_estimate: rawPrediction['next_year_estimate (%)'],
        investment: rawPrediction.investment,
        expected_gain_next_month: rawPrediction['expected_gain_next_month (VND)'],
        expected_gain_next_year: rawPrediction['expected_gain_next_year (VND)'],
        recommendation: recommendation,
        alpha_p_value: rawPrediction.alpha_p_value,
        factor_p_values: rawPrediction.factor_p_values
      });
      
    } catch (err) {
      console.error('Failed to get prediction:', err);
      setError('Failed to get prediction. Please try again later.');
    } finally {
      setPredictLoading(false);
    }
  };
  
  // In the return part of the component where the "Factor Model Selection" part is rendered:
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Portfolio Builder</h1>
        
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Top 20 Stocks */}
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Top 20 Stocks</h2>
            <p className="text-sm text-gray-500 mb-4">Click on a stock to add it to your portfolio. Hover to see details.</p>
            
            {loading ? (
              <div className="flex justify-center items-center h-[300px]">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[600px] pr-2">
                <div className="grid grid-cols-2 gap-2">
                  {topStocks.map(stock => (
                    <div 
                      key={stock.symbol}
                      className={`border rounded-lg p-3 cursor-pointer transition duration-200
                        ${portfolio.some(p => p.symbol === stock.symbol) 
                          ? 'border-blue-500 bg-blue-50 text-blue-700' 
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'}
                      `}
                      onClick={() => addStockToPortfolio(stock)}
                      title={`
                        Final Score: ${stock.final_score.toFixed(3)}
                        Momentum: ${stock.momentum.toFixed(3)}
                        Volume Strength: ${stock.volume_strength.toFixed(3)}
                        Volatility: ${stock.volatility.toFixed(3)}
                        Foreign Interest: ${stock.foreign_interest.toFixed(3)}
                        Recent Change: ${stock.recent_change.toFixed(3)}
                      `}
                    >
                      <div className="flex justify-between items-center">
                        <div className="font-bold">{stock.symbol}</div>
                        <div className="flex space-x-1">
                          {/* Bubble indicator */}
                          {stockPredictions[stock.symbol]?.bubble && (
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center 
                              ${stockPredictions[stock.symbol]?.bubble?.prediction === 1 
                                ? 'bg-red-100 text-red-600' 
                                : 'bg-green-100 text-green-600'}`}
                              title={`Bubble prediction: ${stockPredictions[stock.symbol]?.bubble?.prediction === 1 ? 'Bubble risk' : 'No bubble risk'} (${((stockPredictions[stock.symbol]?.bubble?.probability ?? 0) * 100).toFixed(1)}% confidence)`}
                            >
                              {stockPredictions[stock.symbol]?.bubble?.prediction === 1 
                                ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                                  </svg>
                                : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                  </svg>
                              }
                            </div>
                          )}
                          
                          {/* Trend indicator */}
                          {stockPredictions[stock.symbol]?.trend && (
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center 
                              ${stockPredictions[stock.symbol]?.trend?.prediction === 1 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-red-100 text-red-600'}`}
                              title={`Trend prediction: ${stockPredictions[stock.symbol]?.trend?.prediction === 1 ? 'Rising' : 'Dropping'} (${((stockPredictions[stock.symbol]?.trend?.probability ?? 0) * 100).toFixed(1)}% confidence)`}
                            >
                              {stockPredictions[stock.symbol]?.trend?.prediction === 1 
                                ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                    <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
                                  </svg>
                                : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                    <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
                                  </svg>
                              }
                            </div>
                          )}
                          
                          {/* Loading indicator when predictions are being fetched */}
                          {predictionsLoading && !stockPredictions[stock.symbol] && (
                            <div className="w-5 h-5 rounded-full bg-gray-100 animate-pulse"></div>
                          )}
                        </div>
                      </div>
                      <div className="text-xs mt-1">Score: {stock.final_score.toFixed(3)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Middle Column: Portfolio Management */}
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Your Portfolio</h2>
            <p className="text-sm text-gray-500 mb-4">Enter investment amount for each stock in your portfolio.</p>
            
            {portfolio.length === 0 ? (
              <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-400">
                <p>Your portfolio is empty</p>
                <p className="text-sm mt-2">Add stocks from the list on the left</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="flex justify-between font-semibold text-gray-700 mb-2">
                    <span>Total Investment:</span>
                    <span>{formatCurrency(totalInvestment)}</span>
                  </div>
                </div>
                
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {portfolio.map(stock => (
                    <div key={stock.symbol} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-gray-800">{stock.symbol}</span>
                        <button 
                          onClick={() => removeStockFromPortfolio(stock.symbol)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="mb-3">
                        <label className="block text-sm text-gray-600 mb-1">Investment Amount (VND)</label>
                        <input
                          type="number"
                          min="0"
                          step="1000000"
                          value={stock.investment}
                          onChange={(e) => updateInvestment(stock.symbol, Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Weight:</span>
                        <span className="font-medium">
                          {totalInvestment > 0 ? formatPercentage(stock.weight * 100) : '0.00%'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6">
                  <div className="mb-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Factor Model Selection
                      </label>
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        {FACTOR_MODELS.map(model => (
                          <option key={model.id} value={model.id}>{model.label}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        {FACTOR_MODELS.find(m => m.id === selectedModel)?.description || 'Select a model'}
                      </p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={getPrediction}
                    disabled={predictLoading || portfolio.length === 0 || totalInvestment === 0}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {predictLoading ? 'Calculating...' : 'Get Prediction'}
                  </button>
                </div>
              </>
            )}
          </div>
          
          {/* Right Column: Prediction Results */}
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Portfolio Analysis</h2>
            
            {predictLoading ? (
              <div className="flex justify-center items-center h-[300px]">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : !prediction ? (
              <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-400 h-[500px] flex items-center justify-center">
                <div>
                  <p>No analysis available</p>
                  <p className="text-sm mt-2">Create your portfolio and click "Get Prediction"</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <h3 className="font-bold text-lg text-blue-800 mb-2">Recommendation</h3>
                  <p className="text-blue-700">{prediction.recommendation}</p>
                </div>
                
                {/* Factor Model Information */}
                {factorResult && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-3">Factor Analysis</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="mb-3">
                        <span className="text-gray-500 text-sm">Alpha (Efficiency):</span>
                        <div className="flex items-center">
                          <span className={`font-bold ${factorResult.alpha >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercentage(factorResult.alpha)}
                          </span>
                          {factorResult.alpha_p_value !== undefined && (
                            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                              factorResult.alpha_p_value < 0.01 ? 'bg-green-100 text-green-800 font-bold' : 
                              factorResult.alpha_p_value < 0.05 ? 'bg-green-50 text-green-700' : 
                              factorResult.alpha_p_value < 0.1 ? 'bg-yellow-50 text-yellow-700' : 
                              'bg-gray-50 text-gray-500'
                            }`}>
                              p: {factorResult.alpha_p_value < 0.001 ? '<0.001' : factorResult.alpha_p_value.toFixed(3)}
                              {factorResult.alpha_p_value < 0.01 ? ' ***' : 
                                factorResult.alpha_p_value < 0.05 ? ' **' : 
                                factorResult.alpha_p_value < 0.1 ? ' *' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          Alpha represents the portfolio's performance above what was expected based on its risk (Beta). Positive alpha indicates outperformance.
                        </p>
                      </div>
                      
                      <div className="mb-3">
                        <span className="text-gray-500 text-sm">R-Squared:</span>
                        <div className="font-bold">
                          {(factorResult.r_squared * 100).toFixed(2)}%
                        </div>
                        <p className="text-xs text-gray-500">
                          How much of the portfolio's performance is explained by the factor model.
                        </p>
                      </div>
                      
                      <div className="mb-3">
                        <span className="text-gray-500 text-sm">Beta Values (Risk):</span>
                        <div className="grid grid-cols-1 gap-2 mt-1">
                          {/* Always show Market Beta from 1-factor model at the top */}
                          {factorResult.marketBeta !== undefined && (
                            <div key="market-beta" className="flex justify-between items-center border-b border-gray-100 pb-2 mb-1">
                              <span className="text-sm font-medium">Market Beta:</span>
                              <div className="flex items-center">
                                <span className={`font-semibold ${factorResult.marketBeta > 1 ? 'text-red-600' : factorResult.marketBeta < 0 ? 'text-blue-600' : 'text-green-600'}`}>
                                  {factorResult.marketBeta.toFixed(3)}
                                </span>
                                {factorResult.marketBetaPValue !== undefined && (
                                  <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                                    factorResult.marketBetaPValue < 0.01 ? 'bg-blue-100 text-blue-800 font-bold' : 
                                    factorResult.marketBetaPValue < 0.05 ? 'bg-blue-50 text-blue-700' : 
                                    factorResult.marketBetaPValue < 0.1 ? 'bg-yellow-50 text-yellow-700' : 
                                    'bg-gray-50 text-gray-500'
                                  }`}>
                                    p: {factorResult.marketBetaPValue < 0.001 ? '<0.001' : factorResult.marketBetaPValue.toFixed(3)}
                                    {factorResult.marketBetaPValue < 0.01 ? ' ***' : 
                                      factorResult.marketBetaPValue < 0.05 ? ' **' : 
                                      factorResult.marketBetaPValue < 0.1 ? ' *' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Show other beta values */}
                          {Object.entries(factorResult.beta).map(([factor, value]) => {
                            if (factor === 'mkt' && factorResult.marketBeta !== undefined) {
                              return null; // Skip mkt if we're already showing marketBeta
                            }
                            
                            const pValue = factorResult.beta_p_values?.[factor];
                            
                            return (
                              <div key={factor} className="flex justify-between items-center py-1 border-b border-gray-50">
                                <span className="text-sm">{factor}:</span>
                                <div className="flex items-center">
                                  <span className={`font-semibold ${value > 1 ? 'text-red-600' : value < 0 ? 'text-blue-600' : 'text-green-600'}`}>
                                    {value.toFixed(3)}
                                  </span>
                                  {pValue !== undefined && (
                                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                                      pValue < 0.01 ? 'bg-blue-100 text-blue-800 font-bold' : 
                                      pValue < 0.05 ? 'bg-blue-50 text-blue-700' : 
                                      pValue < 0.1 ? 'bg-yellow-50 text-yellow-700' : 
                                      'bg-gray-50 text-gray-500'
                                    }`}>
                                      p: {pValue < 0.001 ? '<0.001' : pValue.toFixed(3)}
                                      {pValue < 0.01 ? ' ***' : 
                                        pValue < 0.05 ? ' **' : 
                                        pValue < 0.1 ? ' *' : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 text-xs text-gray-500 space-y-1">
                          <p>Beta &gt; 1: Higher risk than factor, Beta &lt; 0: Inverse relationship, 0 &lt; Beta &lt; 1: Lower risk</p>
                          <p>Significance levels: *** p&lt;0.01, ** p&lt;0.05, * p&lt;0.1</p>
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-gray-500 text-sm">Specific Risk (Residual Std):</span>
                        <div className="font-bold">
                          {factorResult.residual_std.toFixed(3)}
                        </div>
                        <p className="text-xs text-gray-500">
                          The portfolio's volatility that cannot be explained by the selected factors.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Expected Returns</h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500 mb-1">Next Month</div>
                      <div className={`font-bold text-lg ${prediction.next_month_prediction >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentage(prediction.next_month_prediction)}
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500 mb-1">Next Year</div>
                      <div className={`font-bold text-lg ${prediction.next_year_estimate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentage(prediction.next_year_estimate)}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Expected Gain/Loss</h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500 mb-1">Next Month</div>
                      <div className={`font-bold text-lg ${prediction.expected_gain_next_month >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(prediction.expected_gain_next_month)}
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500 mb-1">Next Year</div>
                      <div className={`font-bold text-lg ${prediction.expected_gain_next_year >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(prediction.expected_gain_next_year)}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Model Information</h3>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div className="text-gray-500">Model Type:</div>
                        <div>{prediction.model}</div>
                        
                        <div className="text-gray-500">Mean Squared Error:</div>
                        <div>{prediction.mse !== undefined ? prediction.mse.toFixed(4) : 'N/A'}</div>
                        
                        <div className="text-gray-500">Sample Size:</div>
                        <div>{factorResult ? factorResult.n_samples : 'N/A'}</div>
                      </div>
                      
                      {/* Alpha p-value from prediction */}
                      {prediction.alpha_p_value !== undefined && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <div className="mb-2 text-sm font-medium text-gray-700">Alpha Significance:</div>
                          <div className="flex items-center">
                            <span className={`px-2 py-1 text-xs rounded-md ${
                              prediction.alpha_p_value < 0.01 ? 'bg-green-100 text-green-800 font-bold' : 
                              prediction.alpha_p_value < 0.05 ? 'bg-green-50 text-green-700' : 
                              prediction.alpha_p_value < 0.1 ? 'bg-yellow-50 text-yellow-700' : 
                              'bg-gray-50 text-gray-500'
                            }`}>
                              p: {prediction.alpha_p_value < 0.001 ? '<0.001' : prediction.alpha_p_value.toFixed(3)}
                              {prediction.alpha_p_value < 0.01 ? ' ***' : 
                                prediction.alpha_p_value < 0.05 ? ' **' : 
                                prediction.alpha_p_value < 0.1 ? ' *' : ''}
                            </span>
                            <span className="ml-2 text-xs text-gray-500">
                              {prediction.alpha_p_value < 0.05 ? 'Statistically significant' : 'Not statistically significant'}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Factors and their p-values */}
                      {prediction.factor_p_values && Object.keys(prediction.factor_p_values).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <div className="mb-2 text-sm font-medium text-gray-700">Factors Significance:</div>
                          <div className="space-y-2">
                            {Object.entries(prediction.factor_p_values).map(([factor, pValue]) => (
                              <div key={factor} className="flex items-center justify-between bg-white p-2 rounded-md">
                                <span className="text-xs font-medium">{factor}:</span>
                                <div className="flex items-center">
                                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                                    pValue < 0.01 ? 'bg-blue-100 text-blue-800 font-bold' : 
                                    pValue < 0.05 ? 'bg-blue-50 text-blue-700' : 
                                    pValue < 0.1 ? 'bg-yellow-50 text-yellow-700' : 
                                    'bg-gray-50 text-gray-500'
                                  }`}>
                                    p: {pValue < 0.001 ? '<0.001' : pValue.toFixed(3)}
                                    {pValue < 0.01 ? ' ***' : 
                                      pValue < 0.05 ? ' **' : 
                                      pValue < 0.1 ? ' *' : ''}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            Significance levels: *** p&lt;0.01, ** p&lt;0.05, * p&lt;0.1
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="mb-2 text-sm font-medium text-gray-700">Factors Used:</div>
                        <div className="flex flex-wrap gap-1">
                          {prediction.factors_used && prediction.factors_used.length > 0 ? 
                            prediction.factors_used.map(factor => (
                              <span key={factor} className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs">
                                {factor}
                              </span>
                            )) : 
                            <span className="text-gray-500">N/A</span>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioBuilderPage;