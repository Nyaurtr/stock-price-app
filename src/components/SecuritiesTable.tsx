import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import apiService from '../services/apiService';
import ApiButton from './ApiButton';
import ApiFormField from './ApiFormField';
import StockDetailModal from './StockDetailModal';

// Data types
interface SecurityData {
  symbol: string;
  ceilingPrice?: number;
  floorPrice?: number;
  refPrice?: number;
  closePrice?: number;
  totalMatchVol?: number;
  priceChange?: number;
  perPriceChange?: number;
  totalTradedVol?: number;
  highestPrice?: number;
  lowestPrice?: number;
  foreignBuyVolTotal?: number;
  foreignSellVolTotal?: number;
  foreignCurrentRoom?: number;
}

interface SecurityListItem {
  symbol?: string;
  Symbol?: string;
  [key: string]: unknown;
}

interface ResponseDataWithList {
  dataList: SecurityListItem[];
  [key: string]: unknown;
}

// Constants
const MARKET_OPTIONS = [
  { value: 'HOSE', label: 'HOSE' },
  { value: 'HNX', label: 'HNX' },
  { value: 'UPCOM', label: 'UPCOM' },
  { value: 'DER', label: 'DER' }
];

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10 symbols' },
  { value: '20', label: '20 symbols' },
  { value: '30', label: '30 symbols' },
  { value: '50', label: '50 symbols' }
];

const SecuritiesTable: React.FC = () => {
  // State
  const [market, setMarket] = useState('HOSE');
  const [securities, setSecurities] = useState<SecurityData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [filterText, setFilterText] = useState('');
  const [sortColumn, setSortColumn] = useState<keyof SecurityData>('symbol');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [totalSymbols, setTotalSymbols] = useState(0);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  
  // Refs for tracking changes and debouncing
  const debouncedFetchRef = useRef<number | null>(null);
  const isPendingFetchRef = useRef(false);
  const latestParamsRef = useRef({ market, currentPage, pageSize });
  
  // Update latest params ref when dependencies change
  useEffect(() => {
    latestParamsRef.current = { market, currentPage, pageSize };
  }, [market, currentPage, pageSize]);
  
  // Function to handle fetching securities list
  const fetchSecuritiesList = async (refresh = false) => {
    if (!refresh) {
      setLoading(true);
    }
    setError(null);
    
    // Mark that a fetch is in progress to avoid duplicate calls
    isPendingFetchRef.current = true;
    
    try {
      // Get securities list from the API
      const response = await apiService.getSecuritiesList(market, 1, 1000, !refresh);
      
      console.log('API Response:', response); // Debug log
      
      if (response?.status === 'Success') {
        // Extract securities data
        let symbolsList: SecurityListItem[] = [];
        
        if (response.data && Array.isArray(response.data)) {
          symbolsList = response.data as SecurityListItem[];
        } else if (
          response.data && 
          typeof response.data === 'object' && 
          'dataList' in response.data && 
          Array.isArray((response.data as ResponseDataWithList).dataList)
        ) {
          symbolsList = (response.data as ResponseDataWithList).dataList;
        } else if (
          response.data && 
          typeof response.data === 'object' &&
          Object.keys(response.data).some(key => {
            const value = (response.data as Record<string, unknown>)[key];
            return Array.isArray(value) && value.length > 0;
          })
        ) {
          // Look for any array property that might contain the securities list
          const arrayKey = Object.keys(response.data).find(key => {
            const value = (response.data as Record<string, unknown>)[key];
            return Array.isArray(value) && value.length > 0;
          });
          
          if (arrayKey) {
            symbolsList = ((response.data as Record<string, unknown>)[arrayKey] as SecurityListItem[]);
          } else {
            throw new Error('Unable to locate securities data in API response');
          }
        } else {
          console.error('Unexpected API response structure:', response.data);
          throw new Error('Unable to locate securities data in API response');
        }
        
        if (symbolsList.length === 0) {
          throw new Error('No securities found for the selected market');
        }
        
        // Extract symbols - filter undefined values
        const symbolsExtracted = symbolsList
          .map(item => {
            // Just use the direct properties and skip the complex lookup
            return item.symbol || item.Symbol;
          })
          .filter((symbol): symbol is string => !!symbol); // Type guard to filter out undefined values

        console.log('Extracted symbols:', symbolsExtracted.slice(0, 5)); // Debug log (show first 5)
        
        setTotalSymbols(symbolsExtracted.length);
        
        // Calculate total pages
        const calculatedTotalPages = Math.ceil(symbolsExtracted.length / pageSize);
        setTotalPages(calculatedTotalPages);
        
        // Make sure current page is valid
        const validatedCurrentPage = Math.min(currentPage, calculatedTotalPages || 1);
        if (validatedCurrentPage !== currentPage) {
          setCurrentPage(validatedCurrentPage);
        }
        
        // Get paginated symbols
        const startIndex = (validatedCurrentPage - 1) * pageSize;
        const paginatedSymbols = symbolsExtracted.slice(startIndex, startIndex + pageSize);
        
        // Fetch price data for all symbols in parallel
        const todayFormatted = format(new Date(), 'dd/MM/yyyy');
        
        if (paginatedSymbols.length === 0) {
          setSecurities([]);
          setLastUpdated(new Date());
          return;
        }
        
        // Reset loading progress
        setLoadingProgress({ current: 0, total: paginatedSymbols.length });
        
        // Add event listener for custom events from API service
        const handleFetchProgress = () => {
          setLoadingProgress(prev => ({ 
            ...prev, 
            current: Math.min(prev.current + 1, prev.total) 
          }));
        };
        
        // Register event listener
        window.addEventListener('api:fetch-progress', handleFetchProgress as EventListener);
        
        const results = await apiService.batchGetDailyStockPrices(paginatedSymbols, todayFormatted, todayFormatted);
        
        // Remove event listener
        window.removeEventListener('api:fetch-progress', handleFetchProgress as EventListener);
        
        // Process the results
        const securitiesData: SecurityData[] = results.map(result => {
          if (result.success && result.response && result.response.status === 'Success') {
            const responseData = result.response.data;
            
            // Handle different response structures
            const stockData = Array.isArray(responseData) && responseData.length > 0 
              ? responseData[0] 
              : responseData && typeof responseData === 'object'
                ? responseData
                : null;
              
            if (stockData) {
              return {
                symbol: stockData.Symbol || result.symbol,
                ceilingPrice: stockData.CeilingPrice || stockData.ceilingPrice,
                floorPrice: stockData.FloorPrice || stockData.floorPrice,
                refPrice: stockData.RefPrice || stockData.refPrice,
                closePrice: stockData.ClosePrice || stockData.closePrice,
                totalMatchVol: stockData.TotalMatchVol || stockData.totalMatchVol,
                priceChange: stockData.PriceChange || stockData.priceChange,
                perPriceChange: stockData.PerPriceChange || stockData.perPriceChange, 
                totalTradedVol: stockData.TotalTradedVol || stockData.totalTradedVol,
                highestPrice: stockData.HighestPrice || stockData.highestPrice,
                lowestPrice: stockData.LowestPrice || stockData.lowestPrice,
                foreignBuyVolTotal: stockData.ForeignBuyVolTotal || stockData.foreignBuyVolTotal,
                foreignSellVolTotal: stockData.ForeignSellVolTotal || stockData.foreignSellVolTotal,
                foreignCurrentRoom: stockData.ForeignCurrentRoom || stockData.foreignCurrentRoom
              };
            }
          } else if (result.error) {
            console.warn(`Error fetching data for ${result.symbol}:`, result.error);
          }
          
          // Return minimal data if we don't have complete data
          return { symbol: result.symbol };
        });
        
        // Update state
        setSecurities(securitiesData);
        setLastUpdated(new Date());
        
      } else {
        throw new Error(response?.message || 'Failed to fetch securities list');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
      console.error('Error in fetchSecuritiesList:', err);
    } finally {
      if (!refresh) {
        setLoading(false);
      }
      // Reset loading progress
      setLoadingProgress({ current: 0, total: 0 });
      
      // Mark that fetch is completed
      isPendingFetchRef.current = false;
    }
  };
  
  // Debounced fetch function to prevent rapid API calls
  const debouncedFetch = useCallback(() => {
    // Clear any existing timeout
    if (debouncedFetchRef.current) {
      clearTimeout(debouncedFetchRef.current);
    }
    
    // Set a new timeout to delay the fetch
    debouncedFetchRef.current = setTimeout(() => {
      // Only fetch if another fetch isn't already in progress
      if (!isPendingFetchRef.current) {
        fetchSecuritiesList();
      }
    }, 300); // 300ms debounce time
  }, []);
  
  // Setup interval for auto-refresh if enabled
  useEffect(() => {
    if (refreshInterval) {
      const intervalId = setInterval(() => {
        if (!isPendingFetchRef.current) {
          fetchSecuritiesList(true);
        }
      }, refreshInterval * 1000);
      
      return () => clearInterval(intervalId);
    }
  }, [refreshInterval]);
  
  // Initial data fetch and handling parameter changes
  useEffect(() => {
    debouncedFetch();
    
    // Cleanup function
    return () => {
      if (debouncedFetchRef.current) {
        clearTimeout(debouncedFetchRef.current);
      }
    };
  }, [market, currentPage, pageSize, debouncedFetch]);
  
  // Handle sort
  const handleSort = (column: keyof SecurityData) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };
  
  // Filter and sort the securities
  const filteredAndSortedSecurities = useMemo(() => {
    // First filter
    let result = filterText 
      ? securities.filter(sec => 
          sec.symbol.toLowerCase().includes(filterText.toLowerCase())
        )
      : securities;
      
    // Then sort
    result = [...result].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];
      
      // Handle undefined values
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;
      
      // For non-numeric types
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      // For numeric types
      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
    
    return result;
  }, [securities, filterText, sortColumn, sortDirection]);
  
  // Format number function
  const formatNumber = (value: number | undefined, decimals: number = 2): string => {
    if (value === undefined) return '-';
    return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };
  
  // Render price change function
  const renderPriceChange = (value: number | undefined): React.ReactNode => {
    if (value === undefined) return '-';
    
    const className = value > 0 
      ? 'text-green-500' 
      : value < 0 
        ? 'text-red-500' 
        : 'text-gray-500';
        
    return (
      <span className={className}>
        {value > 0 ? '+' : ''}{formatNumber(value, 2)}
      </span>
    );
  };
  
  // Helper to get percentage change rendering
  const renderPercentChange = (value: number | undefined): React.ReactNode => {
    if (value === undefined) return '-';
    
    const className = value > 0 
      ? 'text-green-500' 
      : value < 0 
        ? 'text-red-500' 
        : 'text-gray-500';
        
    return (
      <span className={className}>
        {value > 0 ? '+' : ''}{formatNumber(value, 2)}%
      </span>
    );
  };
  
  // Modified handlers to prevent immediate fetches
  const handleMarketChange = (newMarket: string) => {
    if (newMarket !== market) {
      setMarket(newMarket);
      setCurrentPage(1); // Reset to first page when market changes
    }
  };
  
  const handlePageSizeChange = (value: string) => {
    const newPageSize = parseInt(value, 10);
    if (newPageSize !== pageSize) {
      setPageSize(newPageSize);
      setCurrentPage(1); // Reset to first page when page size changes
    }
  };
  
  // Pagination handlers
  const handleNextPage = () => {
    if (currentPage < totalPages && !isPendingFetchRef.current) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const handlePrevPage = () => {
    if (currentPage > 1 && !isPendingFetchRef.current) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  const handleFirstPage = () => {
    if (currentPage !== 1 && !isPendingFetchRef.current) {
      setCurrentPage(1);
    }
  };
  
  const handleLastPage = () => {
    if (currentPage !== totalPages && !isPendingFetchRef.current) {
      setCurrentPage(totalPages);
    }
  };
  
  const handleRefresh = () => {
    if (!isPendingFetchRef.current) {
      fetchSecuritiesList();
    }
  };
  
  const handleAutoRefreshChange = (interval: string) => {
    const value = parseInt(interval, 10);
    setRefreshInterval(value || null);
  };
  
  // Function to handle row click to open detail modal
  const handleRowClick = (symbol: string) => {
    setSelectedSymbol(symbol);
    setModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setModalOpen(false);
  };
  
  // Header UI
  const HeaderCell = ({ column, label }: { column: keyof SecurityData, label: string }) => {
    const isActive = sortColumn === column;
    
    return (
      <th 
        className={`px-4 py-2 text-left cursor-pointer hover:bg-gray-100 ${isActive ? 'bg-gray-100' : ''}`}
        onClick={() => handleSort(column)}
      >
        <div className="flex items-center">
          <span>{label}</span>
          {isActive && (
            <span className="ml-1">
              {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>
      </th>
    );
  };
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-grow">
          <h2 className="text-xl font-bold">Securities Data</h2>
          <div className="text-sm text-gray-500 flex items-center">
            {lastUpdated ? (
              <>
                <span>Last updated: {format(lastUpdated, 'HH:mm:ss')}</span>
                {loading && <span className="ml-2 text-blue-600 animate-pulse">(Refreshing...)</span>}
              </>
            ) : loading ? (
              <span className="text-blue-600 animate-pulse">Loading data...</span>
            ) : null}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-shrink-0">
            <ApiFormField
              label="Market"
              value={market}
              onChange={handleMarketChange}
              options={MARKET_OPTIONS}
              required
            />
          </div>
          
          <div className="flex-shrink-0">
            <ApiFormField
              label="Filter"
              value={filterText}
              onChange={setFilterText}
              placeholder="Search symbols..."
            />
          </div>
          
          <div className="flex-shrink-0">
            <ApiFormField
              label="Symbols per page"
              value={pageSize.toString()}
              onChange={handlePageSizeChange}
              options={PAGE_SIZE_OPTIONS}
            />
          </div>
          
          <div className="flex-shrink-0">
            <ApiFormField
              label="Auto refresh (secs)"
              value={refreshInterval?.toString() || ''}
              onChange={handleAutoRefreshChange}
              placeholder="Disabled"
            />
          </div>
          
          <div className="flex-shrink-0 flex items-end">
            <ApiButton
              onClick={handleRefresh}
              isLoading={loading}
              variant="outline"
            >
              Refresh
            </ApiButton>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md" role="alert">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      )}
      
      <div className="bg-white overflow-x-auto shadow rounded-lg relative">
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-70 z-10 flex items-center justify-center">
            <div className="flex flex-col items-center p-4 rounded-lg bg-white shadow-md">
              <div className="w-12 h-12 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin mb-3"></div>
              {loadingProgress.total > 0 ? (
                <>
                  <p className="font-medium text-gray-700">Loading data... ({loadingProgress.current}/{loadingProgress.total})</p>
                  <div className="w-64 bg-gray-200 rounded-full h-2.5 mt-2">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                      style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Throttling requests (1 second delay between each)
                  </p>
                </>
              ) : (
                <p className="font-medium text-gray-700">Updating securities data...</p>
              )}
            </div>
          </div>
        )}
        <div className="min-w-full divide-y divide-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <HeaderCell column="symbol" label="Symbol" />
                <HeaderCell column="closePrice" label="Price" />
                <HeaderCell column="priceChange" label="Change" />
                <HeaderCell column="perPriceChange" label="Change %" />
                <HeaderCell column="totalTradedVol" label="Volume" />
                <HeaderCell column="refPrice" label="Ref" />
                <HeaderCell column="ceilingPrice" label="Ceiling" />
                <HeaderCell column="floorPrice" label="Floor" />
                <HeaderCell column="highestPrice" label="High" />
                <HeaderCell column="lowestPrice" label="Low" />
                <HeaderCell column="foreignBuyVolTotal" label="Foreign Buy" />
                <HeaderCell column="foreignSellVolTotal" label="Foreign Sell" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && securities.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin mb-3"></div>
                      {loadingProgress.total > 0 ? (
                        <>
                          <p>Loading securities data... ({loadingProgress.current}/{loadingProgress.total})</p>
                          <div className="w-64 bg-gray-200 rounded-full h-2.5 mt-2">
                            <div 
                              className="bg-blue-600 h-2.5 rounded-full" 
                              style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                            ></div>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            Throttling requests (1 second delay between each)
                          </p>
                        </>
                      ) : (
                        <p>Loading securities data...</p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : filteredAndSortedSecurities.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-gray-500">
                    No securities data found for the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredAndSortedSecurities.map((security, index) => (
                  <tr 
                    key={security.symbol || index}
                    onClick={() => handleRowClick(security.symbol)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="px-4 py-3 text-sm font-medium">
                      {security.symbol}
                    </td>
                    <td className="px-4 py-3 text-sm">{formatNumber(security.closePrice)}</td>
                    <td className="px-4 py-3 text-sm">{renderPriceChange(security.priceChange)}</td>
                    <td className="px-4 py-3 text-sm">{renderPercentChange(security.perPriceChange)}</td>
                    <td className="px-4 py-3 text-sm">{formatNumber(security.totalTradedVol, 0)}</td>
                    <td className="px-4 py-3 text-sm">{formatNumber(security.refPrice)}</td>
                    <td className="px-4 py-3 text-sm">{formatNumber(security.ceilingPrice)}</td>
                    <td className="px-4 py-3 text-sm">{formatNumber(security.floorPrice)}</td>
                    <td className="px-4 py-3 text-sm">{formatNumber(security.highestPrice)}</td>
                    <td className="px-4 py-3 text-sm">{formatNumber(security.lowestPrice)}</td>
                    <td className="px-4 py-3 text-sm">{formatNumber(security.foreignBuyVolTotal, 0)}</td>
                    <td className="px-4 py-3 text-sm">{formatNumber(security.foreignSellVolTotal, 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">
          {filterText ? (
            `Showing ${filteredAndSortedSecurities.length} filtered symbols`
          ) : (
            `Showing page ${currentPage} of ${totalPages} (${pageSize} symbols per page, ${totalSymbols} total)`
          )}
        </div>
        
        <div className="flex space-x-2">
          <ApiButton
            onClick={handleFirstPage}
            isDisabled={currentPage === 1 || loading}
            variant="outline"
          >
            First
          </ApiButton>
          <ApiButton
            onClick={handlePrevPage}
            isDisabled={currentPage === 1 || loading}
            variant="outline"
          >
            Prev
          </ApiButton>
          <ApiButton
            onClick={handleNextPage}
            isDisabled={currentPage === totalPages || loading}
            variant="outline"
          >
            Next
          </ApiButton>
          <ApiButton
            onClick={handleLastPage}
            isDisabled={currentPage === totalPages || loading}
            variant="outline"
          >
            Last
          </ApiButton>
        </div>
      </div>
      
      {selectedSymbol && (
        <StockDetailModal
          open={modalOpen}
          onClose={handleCloseModal}
          symbol={selectedSymbol}
          market={market}
        />
      )}
    </div>
  );
};

export default SecuritiesTable; 