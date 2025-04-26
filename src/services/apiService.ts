import axios, { AxiosError } from 'axios';
import { TopStock, FactorModelResult } from '../types/apiTypes';

// Use proxy URL to avoid CORS
const BASE_URL = '/api';

// Custom Events
declare global {
  interface WindowEventMap {
    'api:fetch-progress': CustomEvent<{ timestamp: number }>;
  }
}

// API response type
export interface ApiResponse {
  status: string;
  message?: string;
  data: unknown;
  totalRecord?: number;
}

// Simple cache implementation
interface CacheItem {
  data: ApiResponse;
  timestamp: number;
  expiry: number; // in milliseconds
}

class ApiCache {
  private cache: Record<string, CacheItem> = {};
  readonly DEFAULT_EXPIRY = 5 * 60 * 1000; // 5 minutes
  readonly EXTENDED_EXPIRY = 30 * 60 * 1000; // 30 minutes for less frequently changing data

  get(key: string): ApiResponse | null {
    const item = this.cache[key];
    if (!item) return null;
    
    // Check if the item has expired
    if (Date.now() > item.timestamp + item.expiry) {
      console.log(`[CACHE] Item expired: ${key}`);
      delete this.cache[key];
      return null;
    }
    
    console.log(`[CACHE] Cache hit: ${key}`);
    return item.data;
  }
  
  set(key: string, data: ApiResponse, expiry: number = this.DEFAULT_EXPIRY): void {
    console.log(`[CACHE] Caching item with expiry ${expiry}ms: ${key}`);
    this.cache[key] = {
      data,
      timestamp: Date.now(),
      expiry
    };
  }
  
  invalidate(keyPattern: RegExp): void {
    Object.keys(this.cache).forEach(key => {
      if (keyPattern.test(key)) {
        delete this.cache[key];
      }
    });
  }
  
  clear(): void {
    this.cache = {};
  }
}

// Create a singleton cache instance
const apiCache = new ApiCache();

// Store the access token
let accessToken: string = '';

// Configure axios instance
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 seconds timeout
});

// Add request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle specific error codes
    if (error.response) {
      const { status } = error.response;
      
      if (status === 401 || status === 403) {
        // Auth errors - might want to trigger a re-auth
        console.error('Authentication error:', error.response.data);
      } else if (status === 429) {
        // Rate limiting
        console.error('API rate limit exceeded:', error.response.data);
        // Create a standardized rate limit response
        return Promise.reject(new Error('Rate limit exceeded (429). Please try again later.'));
      } else if (status >= 500) {
        // Server errors
        console.error('Server error:', error.response.data);
      }
    } else if (error.code === 'ECONNABORTED') {
      console.error('Request timeout:', error.message);
    } else {
      console.error('API request failed:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Generic API request function with caching
const makeRequest = async (
  method: 'get' | 'post',
  endpoint: string,
  params?: Record<string, unknown>,
  data?: Record<string, unknown>,
  useCache: boolean = true,
  cacheExpiry?: number
): Promise<ApiResponse> => {
  // Generate cache key based on request params
  const cacheKey = `${method}:${endpoint}:${JSON.stringify(params || {})}:${JSON.stringify(data || {})}`;
  
  console.log(`[API] Making request: ${method.toUpperCase()} ${endpoint}`, {
    params,
    useCache,
    cacheExpiry
  });
  
  // Try to get from cache first if caching is enabled
  if (useCache) {
    const cachedData = apiCache.get(cacheKey);
    if (cachedData) {
      console.log(`[API] Returning cached data for: ${endpoint}`);
      return cachedData;
    }
  }
  
  try {
    const response = await api.request({
      method,
      url: endpoint,
      params,
      data
    });
    
    // Validate response structure
    if (!response.data) {
      console.error('Invalid API response - missing data:', response);
      throw new Error('Invalid API response - missing data');
    }
    
    console.log(`[API] Response received for ${endpoint}:`, {
      status: response.status,
      dataStatus: response.data?.status,
      message: response.data?.message
    });
    
    // Cache successful responses if caching is enabled
    if (useCache && response.data) {
      // Use the provided expiry or determine based on endpoint
      const actualCacheExpiry = cacheExpiry || 
        (endpoint.includes('Securities') ? apiCache.EXTENDED_EXPIRY : apiCache.DEFAULT_EXPIRY);
      
      apiCache.set(cacheKey, response.data, actualCacheExpiry);
    }
    
    return response.data;
  } catch (error) {
    console.error(`API error (${method.toUpperCase()} ${endpoint}):`, error);
    // Re-throw for caller to handle
    throw error;
  }
};

// API services
export const apiService = {
  // Cache management
  clearCache: () => {
    console.log('[API] Clearing entire cache');
    apiCache.clear();
  },
  
  invalidateCache: (pattern: RegExp) => {
    console.log(`[API] Invalidating cache with pattern: ${pattern}`);
    apiCache.invalidate(pattern);
  },
  
  // Authentication
  getAccessToken: async (consumerID: string, consumerSecret: string): Promise<ApiResponse> => {
    const response = await api.post('/Market/AccessToken', {
      consumerID,
      consumerSecret
    });
    accessToken = response.data.data.accessToken;
    return response.data;
  },

  // AI Model Predictions
  getStockModelPrediction: async (
    ticker: string,
    marketState: 'BB' | 'UD',
    monthYear: string
  ): Promise<ApiResponse> => {
    try {
      const response = await axios.get('http://47.129.232.235:8080/stock-all-models/', {
        params: {
          ticker,
          market_state: marketState,
          'month-year': monthYear
        }
      });
      return response.data;
    } catch (error: AxiosError | unknown) {
      // Handle 404 errors (ticker not found) gracefully
      if (axios.isAxiosError(error) && error.response && error.response.status === 404) {
        console.log(`Ticker '${ticker}' not found in ${marketState} data. Returning empty data.`);
        // Return a success response with empty data instead of throwing
        return {
          status: 'success',
          message: `No data found for ${ticker}`,
          data: [] // Empty array to indicate no data
        };
      }
      
      // For other errors, log and rethrow
      console.error('Error fetching model predictions:', error);
      throw error;
    }
  },

  getAvailableFilters: async (dataType: 'BB' | 'UD'): Promise<ApiResponse> => {
    try {
      const response = await axios.get('/ai-api/available-filters', {
        params: {
          data_type: dataType
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching available filters:', error);
      throw error;
    }
  },

  getLatestDateAllTickerData: async (marketState: 'BB' | 'UD'): Promise<ApiResponse> => {
    try {
      const response = await axios.get('/ai-api/latest-date-all-ticker-data', {
        params: {
          market_state: marketState
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching latest date ticker data:', error);
      throw error;
    }
  },

  // Securities List
  getSecuritiesList: async (market: string, pageIndex: number = 1, pageSize: number = 10, useCache: boolean = true): Promise<ApiResponse> => {
    return makeRequest('get', '/Market/Securities', { market, pageIndex, pageSize }, undefined, useCache);
  },

  // Securities Details
  getSecuritiesDetails: async (market: string, symbol: string, pageIndex: number = 1, pageSize: number = 10, useCache: boolean = true): Promise<ApiResponse> => {
    console.log(`[API] Getting securities details for ${symbol} in ${market}`);
    return makeRequest('get', '/Market/SecuritiesDetails', { 
      market, 
      symbol, 
      pageIndex, 
      'lookupRequest.pageSize': pageSize 
    }, undefined, useCache, apiCache.EXTENDED_EXPIRY);
  },

  // Index Components
  getIndexComponents: async (indexcode: string, pageIndex: number = 1, pageSize: number = 10, useCache: boolean = true): Promise<ApiResponse> => {
    return makeRequest('get', '/Market/IndexComponents', { 
      Indexcode: indexcode, 
      PageIndex: pageIndex, 
      PageSize: pageSize 
    }, undefined, useCache);
  },

  // Index List
  getIndexList: async (exchange: string, pageIndex: number = 1, pageSize: number = 10, useCache: boolean = true): Promise<ApiResponse> => {
    return makeRequest('get', '/Market/IndexList', { 
      Exchange: exchange, 
      PageIndex: pageIndex, 
      PageSize: pageSize 
    }, undefined, useCache);
  },

  // Daily OHLC
  getDailyOhlc: async (symbol: string, fromDate: string, toDate: string, pageIndex: number = 1, pageSize: number = 10, ascending: boolean = true, useCache: boolean = true): Promise<ApiResponse> => {
    return makeRequest('get', '/Market/DailyOhlc', { 
      Symbol: symbol, 
      FromDate: fromDate, 
      ToDate: toDate, 
      PageIndex: pageIndex, 
      PageSize: pageSize, 
      ascending 
    }, undefined, useCache);
  },

  // Intraday OHLC
  getIntradayOhlc: async (symbol: string, fromDate: string, toDate: string, pageIndex: number = 1, pageSize: number = 10, resolution: number = 1, ascending: boolean = false, useCache: boolean = true): Promise<ApiResponse> => {
    return makeRequest('post', '/Market/IntradayOhlc', undefined, {
      Symbol: symbol,
      FromDate: fromDate,
      ToDate: toDate,
      PageIndex: pageIndex,
      PageSize: pageSize,
      resolution,
      ascending
    }, useCache);
  },

  // Daily Index
  getDailyIndex: async (
    indexcode: string, 
    fromDate: string, 
    toDate: string, 
    pageIndex: number = 1, 
    pageSize: number = 10,
    orderBy: string = 'Tradingdate',
    order: string = 'desc',
    useCache: boolean = true
  ): Promise<ApiResponse> => {
    return makeRequest('get', '/Market/DailyIndex', {
      Indexcode: indexcode,
      FromDate: fromDate,
      ToDate: toDate,
      PageIndex: pageIndex,
      PageSize: pageSize,
      OrderBy: orderBy,
      Order: order
    }, undefined, useCache);
  },

  // Daily Stock Price - optimized for single symbol requests
  getDailyStockPrice: async (
    symbol: string,
    fromDate: string,
    toDate: string,
    useCache: boolean = true
  ): Promise<ApiResponse> => {
    // Validate inputs
    if (!symbol) {
      throw new Error('Symbol is required');
    }
    
    return makeRequest('get', '/Market/DailyStockPrice', {
      Symbol: symbol,
      FromDate: fromDate,
      ToDate: toDate,
    }, undefined, useCache);
  },
  
  // Batch fetch multiple symbols with throttling
  batchGetDailyStockPrices: async (
    symbols: string[],
    fromDate: string,
    toDate: string
  ): Promise<Array<{ symbol: string; response?: ApiResponse; error?: unknown; success: boolean }>> => {
    // Filter out empty symbols
    const validSymbols = symbols.filter(s => !!s);
    
    if (validSymbols.length === 0) {
      return [];
    }
    
    // Implement throttling - process each request with a delay
    const results: Array<{ symbol: string; response?: ApiResponse; error?: unknown; success: boolean }> = [];
    
    // Helper function to add delay
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Helper function to dispatch progress event
    const dispatchProgressEvent = () => {
      const progressEvent = new CustomEvent('api:fetch-progress', { detail: { timestamp: Date.now() } });
      window.dispatchEvent(progressEvent);
    };
    
    // Process each symbol sequentially with delay
    for (const symbol of validSymbols) {
      try {
        console.log(`Fetching data for symbol: ${symbol}`);
        const response = await apiService.getDailyStockPrice(symbol, fromDate, toDate);
        results.push({ symbol, response, success: true });
        // Dispatch progress event after each successful request
        dispatchProgressEvent();
      } catch (error) {
        console.error(`Error fetching data for symbol ${symbol}:`, error);
        results.push({ symbol, error, success: false });
        // Dispatch progress event even for failed requests
        dispatchProgressEvent();
      }
      
      // Wait for 1 second before processing the next request
      if (validSymbols.indexOf(symbol) < validSymbols.length - 1) {
        console.log(`Waiting 1 second before next request...`);
        await delay(1000);
      }
    }
    
    return results;
  },

  // Get top 20 stocks
  getTop20Stocks: async (): Promise<TopStock[]> => {
    try {
      // Read from local CSV file instead of API
      const response = await axios.get('/src/assets/top_20_stock.csv', {
        responseType: 'text'
      });
      
      // Parse CSV
      const rows = response.data.split('\n');
      const stocks: TopStock[] = [];
      
      // Skip header row
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i].trim()) continue;
        
        const values = rows[i].split(',');
        if (values.length < 7) continue; // Skip invalid rows
        
        const stock: TopStock = {
          symbol: values[0],
          final_score: parseFloat(values[1]),
          momentum: parseFloat(values[2]),
          volume_strength: parseFloat(values[3]),
          volatility: parseFloat(values[4]),
          foreign_interest: parseFloat(values[5]),
          recent_change: parseFloat(values[6])
        };
        
        stocks.push(stock);
      }
      
      return stocks;
    } catch (error) {
      console.error('Error loading top 20 stocks:', error);
      throw error;
    }
  },

  // Get portfolio factor model results (1-factor)
  getPortfolioOneFactorModel: async (
    tickers: string[],
    weights?: number[]
  ): Promise<FactorModelResult> => {
    try {
      const response = await axios.post('http://localhost:8000/api/1factor', {
        tickers,
        weights
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching 1-factor model results:', error);
      throw error;
    }
  },

  // Get portfolio factor model results (3-factor)
  getPortfolioThreeFactorModel: async (
    tickers: string[],
    weights?: number[]
  ): Promise<FactorModelResult> => {
    try {
      const response = await axios.post('http://localhost:8000/api/3factors', {
        tickers,
        weights
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching 3-factor model results:', error);
      throw error;
    }
  },

  // Get portfolio factor model results (4-factor)
  getPortfolioFourFactorModel: async (
    tickers: string[],
    weights?: number[]
  ): Promise<FactorModelResult> => {
    try {
      const response = await axios.post('http://localhost:8000/api/4factors', {
        tickers,
        weights
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching 4-factor model results:', error);
      throw error;
    }
  },

  // Get portfolio factor model results (5-factor)
  getPortfolioFiveFactorModel: async (
    tickers: string[],
    weights?: number[]
  ): Promise<FactorModelResult> => {
    try {
      const response = await axios.post('http://localhost:8000/api/5factors', {
        tickers,
        weights
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching 5-factor model results:', error);
      throw error;
    }
  },

  // Get portfolio AI prediction
  getPortfolioAIPrediction: async (
    tickers: string[],
    weights: number[],
    investment: number,
    factors: string[],
    model_choice: string = "linear"
  ): Promise<unknown> => {
    try {
      const response = await axios.post('http://localhost:8000/api/ai_predict', {
        tickers,
        weights,
        investment,
        factors,
        model_choice
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching AI prediction:', error);
      throw error;
    }
  },
};

export default apiService; 