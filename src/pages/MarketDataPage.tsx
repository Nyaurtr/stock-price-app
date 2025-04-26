import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, subDays, parseISO } from 'date-fns';
import apiService from '../services/apiService';
import ApiButton from '../components/ApiButton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import ApiFormField from '../components/ApiFormField';
import SecuritiesTable from '../components/SecuritiesTable';

interface PriceDataItem {
  date: string;
  formattedDate?: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: PriceDataItem;
    value: number;
    name: string;
  }>;
}

const MarketDataPage: React.FC = () => {
  const [symbol, setSymbol] = useState('SSI');
  const [market, setMarket] = useState('HOSE');
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 30), 'MM/dd/yyyy'));
  const [toDate, setToDate] = useState(format(new Date(), 'MM/dd/yyyy'));
  const [priceData, setPriceData] = useState<PriceDataItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'price-chart' | 'securities-list'>('securities-list');
  const [chartType, setChartType] = useState<'line' | 'area' | 'candle' | 'volume'>('area');
  const [zoomLevel, setZoomLevel] = useState('30');
  const [indicators, setIndicators] = useState<Record<string, boolean>>({
    volume: true,
    sma: false,
    ema: false
  });

  const marketOptions = [
    { value: 'HOSE', label: 'HOSE' },
    { value: 'HNX', label: 'HNX' },
    { value: 'UPCOM', label: 'UPCOM' },
    { value: 'DER', label: 'DER' }
  ];

  const timeframeOptions = [
    { value: '7', label: '1 Week' },
    { value: '30', label: '1 Month' },
    { value: '90', label: '3 Months' },
    { value: '180', label: '6 Months' },
    { value: '365', label: '1 Year' },
  ];

  // Calculate from date based on zoom level when it changes
  useEffect(() => {
    const days = parseInt(zoomLevel, 10);
    if (!isNaN(days)) {
      setFromDate(format(subDays(new Date(), days), 'MM/dd/yyyy'));
      setToDate(format(new Date(), 'MM/dd/yyyy'));
    }
  }, [zoomLevel]);

  const fetchPriceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getDailyStockPrice(symbol, fromDate, toDate);
      
      if (response && response.status === 'Success' && response.data && Array.isArray(response.data)) {
        // Transform the data for the chart
        const chartData = response.data.map((item: {
          tradingDate?: string;
          closePrice: number;
          openPrice: number;
          highestPrice: number;
          lowestPrice: number;
          totalQuantity: number;
        }) => {
          const date = item.tradingDate?.split('T')[0] || '';
          return {
            date,
            formattedDate: date ? format(parseISO(date), 'MMM dd') : '',
            close: item.closePrice,
            open: item.openPrice,
            high: item.highestPrice,
            low: item.lowestPrice,
            volume: item.totalQuantity
          };
        }).reverse();
        
        setPriceData(chartData);
      } else {
        setError('Invalid response data structure');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'price-chart') {
      fetchPriceData();
    }
  }, [activeTab]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPriceData();
  };

  // Calculate statistics for the price data
  const statistics = useMemo(() => {
    if (priceData.length === 0) return null;

    const prices = priceData.map(item => item.close);
    const volumes = priceData.map(item => item.volume);
    const highPrices = priceData.map(item => item.high);
    const lowPrices = priceData.map(item => item.low);
    
    const maxPrice = Math.max(...highPrices);
    const minPrice = Math.min(...lowPrices);
    const lastPrice = prices[prices.length - 1];
    const firstPrice = prices[0];
    const priceChange = lastPrice - firstPrice;
    const percentChange = (priceChange / firstPrice) * 100;
    const averageVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;

    return {
      maxPrice,
      minPrice,
      lastPrice,
      priceChange,
      percentChange,
      averageVolume,
      totalPeriod: priceData.length
    };
  }, [priceData]);

  // Toggle chart indicator
  const toggleIndicator = (indicator: string) => {
    setIndicators(prev => ({
      ...prev,
      [indicator]: !prev[indicator]
    }));
  };

  // Format number helper
  const formatNumber = (value: number, decimals = 2) => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  // Format large number (like volume) into K, M, B
  const formatLargeNumber = (num: number) => {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(1) + 'B';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload }: TooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-md">
          <p className="font-bold">{data.formattedDate || data.date}</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Open:</div>
            <div className="text-right">{formatNumber(data.open)}</div>
            <div>High:</div>
            <div className="text-right">{formatNumber(data.high)}</div>
            <div>Low:</div>
            <div className="text-right">{formatNumber(data.low)}</div>
            <div>Close:</div>
            <div className="text-right font-medium">{formatNumber(data.close)}</div>
            <div>Volume:</div>
            <div className="text-right">{formatLargeNumber(data.volume)}</div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="container mx-auto px-4 py-6 animate-fade-in">
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 sm:mb-0">Market Data</h1>
          <Link to="/dashboard" className="btn btn-outline text-sm">Back to Dashboard</Link>
        </div>
        
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-blue-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-sm font-medium">
              View market data for securities on Vietnam's exchanges. Switch between the list view and chart view using the tabs below.
            </p>
          </div>
        </div>
      </header>

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex flex-wrap -mb-px">
            <button
              className={`py-3 px-4 text-sm font-medium border-b-2 ${
                activeTab === 'securities-list'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('securities-list')}
            >
              Securities List
            </button>
            <button
              className={`py-3 px-4 text-sm font-medium border-b-2 ${
                activeTab === 'price-chart'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('price-chart')}
            >
              Price Chart
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'securities-list' ? (
        <SecuritiesTable />
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="md:col-span-2">
                  <ApiFormField
                    label="Symbol"
                    value={symbol}
                    onChange={setSymbol}
                    required
                  />
                </div>
                
                <div className="md:col-span-1">
                  <ApiFormField
                    label="Market"
                    value={market}
                    onChange={setMarket}
                    options={marketOptions}
                    required
                  />
                </div>
                
                <div className="md:col-span-1">
                  <ApiFormField
                    label="Timeframe"
                    value={zoomLevel}
                    onChange={setZoomLevel}
                    options={timeframeOptions}
                  />
                </div>
                
                <div className="md:col-span-2 flex items-end">
                  <ApiButton
                    onClick={() => handleSubmit(new Event('click') as unknown as React.FormEvent)}
                    isLoading={loading}
                  >
                    Fetch Data
                  </ApiButton>
                </div>
              </form>
            </div>
            
            {error ? (
              <div className="p-8 text-center">
                <div className="bg-red-50 text-red-700 p-4 rounded-md inline-block">
                  <p className="font-medium">Error</p>
                  <p>{error}</p>
                </div>
              </div>
            ) : loading ? (
              <div className="p-16 flex justify-center">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin mb-3"></div>
                  <p>Loading chart data...</p>
                </div>
              </div>
            ) : priceData.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No price data available. Please select a symbol and fetch data.</p>
              </div>
            ) : (
              <div className="p-4">
                {/* Chart Header with Stats */}
                {statistics && (
                  <div className="mb-4">
                    <div className="flex items-baseline space-x-2">
                      <h2 className="text-xl font-bold">{symbol}</h2>
                      <span className="text-gray-500 text-sm">{market}</span>
                      <span 
                        className={`ml-auto font-bold ${
                          statistics.priceChange >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {statistics.priceChange >= 0 ? '+' : ''}
                        {formatNumber(statistics.priceChange)} ({formatNumber(statistics.percentChange)}%)
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm text-gray-500">Last Price</div>
                        <div className="font-bold">{formatNumber(statistics.lastPrice)}</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm text-gray-500">Highest Price</div>
                        <div className="font-bold">{formatNumber(statistics.maxPrice)}</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm text-gray-500">Lowest Price</div>
                        <div className="font-bold">{formatNumber(statistics.minPrice)}</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm text-gray-500">Avg. Volume</div>
                        <div className="font-bold">{formatLargeNumber(statistics.averageVolume)}</div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Chart Type Selector */}
                <div className="flex flex-wrap mb-4 gap-2">
                  <div className="bg-gray-100 rounded-lg p-1 flex mr-4">
                    {['area', 'line', 'candle'].map(type => (
                      <button
                        key={type}
                        className={`px-3 py-1 text-sm rounded-md ${
                          chartType === type 
                            ? 'bg-white shadow-sm text-blue-600' 
                            : 'text-gray-700 hover:bg-gray-200'
                        }`}
                        onClick={() => setChartType(type as 'line' | 'area' | 'candle')}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      className={`px-3 py-1 text-sm rounded-md border ${
                        indicators.volume 
                          ? 'border-blue-500 bg-blue-50 text-blue-700' 
                          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => toggleIndicator('volume')}
                    >
                      Volume
                    </button>
                    <button
                      className={`px-3 py-1 text-sm rounded-md border ${
                        indicators.sma 
                          ? 'border-blue-500 bg-blue-50 text-blue-700' 
                          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => toggleIndicator('sma')}
                    >
                      SMA
                    </button>
                    <button
                      className={`px-3 py-1 text-sm rounded-md border ${
                        indicators.ema 
                          ? 'border-blue-500 bg-blue-50 text-blue-700' 
                          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => toggleIndicator('ema')}
                    >
                      EMA
                    </button>
                  </div>
                </div>
                
                {/* Price Chart */}
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'area' ? (
                      <AreaChart
                        data={priceData}
                        margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis 
                          dataKey="formattedDate"
                          tick={{ fill: '#6B7280', fontSize: 12 }}
                          tickLine={false}
                          axisLine={{ stroke: '#E5E7EB' }}
                        />
                        <YAxis 
                          tick={{ fill: '#6B7280', fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                          domain={['dataMin', 'dataMax']}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area 
                          type="monotone" 
                          dataKey="close" 
                          stroke="#8884d8" 
                          fillOpacity={1} 
                          fill="url(#colorClose)" 
                          name="Close"
                        />
                      </AreaChart>
                    ) : (
                      <LineChart
                        data={priceData}
                        margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis 
                          dataKey="formattedDate"
                          tick={{ fill: '#6B7280', fontSize: 12 }}
                          tickLine={false}
                          axisLine={{ stroke: '#E5E7EB' }}
                        />
                        <YAxis 
                          tick={{ fill: '#6B7280', fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                          domain={['dataMin', 'dataMax']}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Line 
                          type="monotone" 
                          dataKey="close" 
                          stroke="#8884d8" 
                          dot={false} 
                          name="Close" 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="open" 
                          stroke="#82ca9d" 
                          dot={false} 
                          name="Open" 
                        />
                        {indicators.sma && (
                          <Line
                            type="monotone"
                            dataKey="close" // This should be SMA data
                            stroke="#ff7300"
                            dot={false}
                            name="SMA"
                            strokeDasharray="5 5"
                          />
                        )}
                        {indicators.ema && (
                          <Line
                            type="monotone"
                            dataKey="close" // This should be EMA data
                            stroke="#387908"
                            dot={false}
                            name="EMA"
                            strokeDasharray="3 3"
                          />
                        )}
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
                
                {/* Volume Chart */}
                {indicators.volume && (
                  <div className="h-40 mt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={priceData}
                        margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis 
                          dataKey="formattedDate"
                          tick={{ fill: '#6B7280', fontSize: 12 }}
                          tickLine={false}
                          axisLine={{ stroke: '#E5E7EB' }}
                        />
                        <YAxis 
                          tickFormatter={formatLargeNumber}
                          tick={{ fill: '#6B7280', fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="volume" fill="#82ca9d" name="Volume" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketDataPage; 