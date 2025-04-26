import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  IconButton, 
  Box, 
  Tabs, 
  Tab, 
  Typography, 
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Alert
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import apiService from '../services/apiService';
import StockChart, { ChartDataPoint } from './StockChart';
import { format, subDays } from 'date-fns';
import AIPredictor from './AIPredictor';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`stock-tabpanel-${index}`}
      aria-labelledby={`stock-tab-${index}`}
      {...other}
      style={{ height: '100%', overflow: 'auto' }}
    >
      {value === index && (
        <Box sx={{ p: 3, height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `stock-tab-${index}`,
    'aria-controls': `stock-tabpanel-${index}`,
  };
}

interface CompanyInfo {
  RType: string;
  ReportDate: string;
  TotalNoSym: string;
  RepeatedInfo: Array<{
    Isin: string | null;
    Symbol: string;
    SymbolName: string;
    SymbolEngName: string;
    SecType: string;
    MarketId: string;
    Exchange: string;
    Issuer: string | null;
    LotSize: string;
    IssueDate: string;
    MaturityDate: string;
    FirstTradingDate: string;
    LastTradingDate: string;
    ContractMultiplier: string;
    SettlMethod: string;
    Underlying: string | null;
    PutOrCall: string | null;
    ExercisePrice: string;
    ExerciseStyle: string;
    ExcerciseRatio: string;
    ListedShare: string;
    TickPrice1: string;
    TickIncrement1: string;
    TickPrice2: string;
    TickIncrement2: string;
    TickPrice3: string;
    TickIncrement3: string;
    TickPrice4: string | null;
    TickIncrement4: string | null;
  }>;
}

// Define a more flexible API response item type
interface ApiResponseItem {
  // Lowercase field names
  tradingdate?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
  
  // Uppercase field names
  TradingDate?: string;
  Open?: string;
  High?: string;
  Low?: string;
  Close?: string;
  Volume?: string;
  
  // Allow for other potential fields
  [key: string]: string | number | null | undefined;
}

interface StockDetailModalProps {
  open: boolean;
  onClose: () => void;
  symbol: string;
  market: string;
}

const StockDetailModal: React.FC<StockDetailModalProps> = ({ open, onClose, symbol, market }) => {
  const [tabValue, setTabValue] = useState(0);
  const [companyInfoLoading, setCompanyInfoLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartError, setChartError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Function to handle tab change - load data when tab is selected
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    
    // Load company info when company info tab is selected
    if (newValue === 0) {
      console.log(`[DEBUG] Loading company info on tab selection`);
      fetchCompanyInfo();
    }
    
    // Load chart data when chart tab is selected
    if (newValue === 1) {
      console.log(`[DEBUG] Loading chart data on tab selection`);
      fetchChartData();
    }
  };

  // Function to handle retry logic with exponential backoff
  const handleCompanyInfoRetry = () => {
    setIsRetrying(true);
    
    // Calculate exponential backoff delay - start with 3s and double each time
    // cap at 30 seconds
    const baseDelay = 3000; // 3 seconds
    const maxDelay = 30000; // 30 seconds
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    
    console.log(`[DEBUG] Scheduling company info retry #${retryCount + 1} with ${exponentialDelay}ms delay`);
    
    setTimeout(() => {
      setRetryCount(prevCount => prevCount + 1);
      fetchCompanyInfo();
    }, exponentialDelay);
  };

  // Function to handle chart data retry
  const handleChartDataRetry = () => {
    setIsRetrying(true);
    
    // Calculate exponential backoff delay - start with 3s and double each time
    // cap at 30 seconds
    const baseDelay = 3000; // 3 seconds
    const maxDelay = 30000; // 30 seconds
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    
    console.log(`[DEBUG] Scheduling chart data retry #${retryCount + 1} with ${exponentialDelay}ms delay`);
    
    setTimeout(() => {
      setRetryCount(prevCount => prevCount + 1);
      fetchChartData();
    }, exponentialDelay);
  };

  // Separate function to fetch company info
  const fetchCompanyInfo = async () => {
    if (!open || !symbol) return;
    
    setCompanyInfoLoading(true);
    setError(null);
    setRetryCount(0);
    
    try {
      console.log(`[DEBUG] Calling getSecuritiesDetails for ${symbol} in ${market}`);
      // Always call the API with useCache=false to avoid using cached data
      const response = await apiService.getSecuritiesDetails(market, symbol, 1, 10, false);
      
      console.log(`[DEBUG] getSecuritiesDetails response:`, {
        status: response?.status,
        message: response?.message,
        dataType: response?.data ? typeof response.data : 'undefined',
        isArray: response?.data ? Array.isArray(response.data) : false,
        dataLength: response?.data && Array.isArray(response.data) ? response.data.length : 0,
        responseKeys: response ? Object.keys(response) : [],
        fullResponse: response
      });
      
      if (response?.status === 'SUCCESS' || response?.status === 'Success') {
        // Process the response data - handle various data structures
        if (response.data) {
          let companyData: CompanyInfo | null = null;
          
          // Check if response.data is an array
          if (Array.isArray(response.data) && response.data.length > 0) {
            console.log(`[DEBUG] Data is an array with ${response.data.length} items`);
            companyData = response.data[0] as CompanyInfo;
          } 
          // Check if it's an object with RepeatedInfo field
          else if (typeof response.data === 'object' && response.data !== null) {
            if ('RepeatedInfo' in response.data) {
              console.log(`[DEBUG] Data contains RepeatedInfo directly`);
              companyData = response.data as CompanyInfo;
            } else if ('data' in response.data && Array.isArray((response.data as Record<string, unknown>).data)) {
              console.log(`[DEBUG] Data is nested in data.data`);
              const nestedData = (response.data as Record<string, unknown>).data as unknown[];
              if (nestedData.length > 0) {
                companyData = nestedData[0] as CompanyInfo;
              }
            }
          }
          
          if (companyData) {
            console.log(`[DEBUG] Found company info:`, companyData);
            setCompanyInfo(companyData);
          } else {
            console.log(`[DEBUG] No company info found in the response structure`);
            setError('No company information found');
          }
        } else {
          console.log(`[DEBUG] No data found in response`);
          setError('No company information found');
        }
      } else if (
        (response?.message && 
          (typeof response.message === 'string' && response.message.toLowerCase().includes('rate limit'))) ||
        (response?.status && 
          (response.status === 'TooManyRequests' || 
           (typeof response.status === 'number' && response.status === 429) ||
           (typeof response.status === 'string' && response.status === '429')))
      ) {
        console.log(`[DEBUG] API rate limit detected in company info response:`, {
          status: response?.status,
          message: response?.message
        });
        setError('API rate limit exceeded. Please try again in a few seconds.');
      } else {
        console.log(`[DEBUG] Unknown error in company info response:`, {
          status: response?.status,
          message: response?.message
        });
        setError(response?.message || 'Failed to fetch company information');
      }
    } catch (err) {
      console.error('Error fetching company info:', err);
      // Check if error is related to rate limiting
      if (err instanceof Error && err.message.includes('429')) {
        console.log(`[DEBUG] Rate limit error detected in catch block:`, err.message);
        setError('API rate limit exceeded. Please try again in a few seconds.');
      } else if (err instanceof Error && err.message.includes('rate limit')) {
        console.log(`[DEBUG] Rate limit error detected in catch block:`, err.message);
        setError('API rate limit exceeded. Please try again in a few seconds.');
      } else {
        console.log(`[DEBUG] General error in catch block:`, err instanceof Error ? err.message : 'Unknown error');
        setError(err instanceof Error ? err.message : 'Error loading company information');
      }
    } finally {
      setCompanyInfoLoading(false);
      setIsRetrying(false);
    }
  };
  
  // Separate function to fetch chart data
  const fetchChartData = async () => {
    if (!open || !symbol) return;
    
    setChartLoading(true);
    setChartError(null);
    setRetryCount(0);
    
    try {
      const today = new Date();
      const thirtyDaysAgo = subDays(today, 30);
      
      const fromDate = format(thirtyDaysAgo, 'dd/MM/yyyy');
      const toDate = format(today, 'dd/MM/yyyy');
      
      console.log(`[DEBUG] Fetching chart data for ${symbol} from ${fromDate} to ${toDate}`);
      
      // Always call the API with useCache=false to avoid using cached data
      const response = await apiService.getDailyOhlc(symbol, fromDate, toDate, 1, 100, true, false);
      
      console.log(`[DEBUG] Chart data response:`, {
        status: response?.status,
        message: response?.message,
        dataType: response?.data ? typeof response.data : 'undefined',
        responseKeys: response ? Object.keys(response) : []
      });
      
      if (response?.status === 'SUCCESS' || response?.status === 'Success') {
        // Extract dataList from the response
        let dataList = null;
        if (Array.isArray(response.data)) {
          dataList = response.data;
        } else if (response.data && typeof response.data === 'object' && 'dataList' in response.data) {
          dataList = (response.data as Record<string, unknown>).dataList;
        }
        
        if (dataList && Array.isArray(dataList) && dataList.length > 0) {
          // Format data for the chart - handle both uppercase and lowercase field names from API
          const formattedData = dataList.map((item: ApiResponseItem) => ({
            date: item.tradingdate || item.TradingDate || '',
            open: parseFloat(item.open || item.Open || '0'),
            high: parseFloat(item.high || item.High || '0'),
            low: parseFloat(item.low || item.Low || '0'),
            close: parseFloat(item.close || item.Close || '0'),
            volume: parseInt(String(item.volume || item.Volume || '0'))
          }));
          
          if (formattedData.length > 0) {
            setChartData(formattedData);
          } else {
            setChartError('No chart data available for this symbol');
          }
        } else {
          setChartError('No historical price data found');
        }
      } else if (
        (response?.message && 
          (typeof response.message === 'string' && response.message.toLowerCase().includes('rate limit'))) ||
        (response?.status && 
          (response.status === 'TooManyRequests' || 
           (typeof response.status === 'number' && response.status === 429) ||
           (typeof response.status === 'string' && response.status === '429')))
      ) {
        console.log(`[DEBUG] API rate limit detected in chart data response:`, {
          status: response?.status,
          message: response?.message
        });
        setChartError('API rate limit exceeded. Please try again in a few seconds.');
      } else {
        console.log(`[DEBUG] Unknown error in chart data response:`, {
          status: response?.status,
          message: response?.message
        });
        setChartError(response?.message || 'Failed to fetch chart data');
      }
    } catch (err) {
      console.error('Error fetching chart data:', err);
      // Check if error is related to rate limiting
      if (err instanceof Error && err.message.includes('429')) {
        console.log(`[DEBUG] Rate limit error detected in catch block:`, err.message);
        setChartError('API rate limit exceeded. Please try again in a few seconds.');
      } else {
        console.log(`[DEBUG] General error in catch block:`, err instanceof Error ? err.message : 'Unknown error');
        setChartError(err instanceof Error ? err.message : 'Error loading chart data');
      }
    } finally {
      setChartLoading(false);
      setIsRetrying(false);
    }
  };

  // Load data when modal opens or symbol changes
  useEffect(() => {
    if (open && symbol) {
      // Reset states when symbol changes
      setCompanyInfo(null);
      setChartData([]);
      setError(null);
      setChartError(null);
      
      // Load data for the active tab
      if (tabValue === 0) {
        console.log(`[DEBUG] Loading company info on symbol change`);
        fetchCompanyInfo();
      } else if (tabValue === 1) {
        console.log(`[DEBUG] Loading chart data on symbol change`);
        fetchChartData();
      }
    }
  }, [open, symbol, market]);

  const renderCompanyInfo = () => {
    if (companyInfoLoading && !error) {
      return <Box display="flex" justifyContent="center" padding={4}><CircularProgress /></Box>;
    }

    if (error) {
      return (
        <Box padding={3}>
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
          {error.includes('rate limit') && (
            <Box display="flex" justifyContent="center" mt={2}>
              <button 
                onClick={handleCompanyInfoRetry}
                disabled={isRetrying}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isRetrying ? 'not-allowed' : 'pointer',
                  opacity: isRetrying ? 0.7 : 1
                }}
              >
                {isRetrying ? 'Retrying...' : 'Retry Now'}
              </button>
            </Box>
          )}
        </Box>
      );
    }

    if (!companyInfo || !companyInfo.RepeatedInfo || companyInfo.RepeatedInfo.length === 0) {
      return <Typography padding={3}>No company information available</Typography>;
    }

    const info = companyInfo.RepeatedInfo[0];

    return (
      <TableContainer component={Paper}>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>Symbol</TableCell>
              <TableCell>{info.Symbol}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>Company Name</TableCell>
              <TableCell>{info.SymbolName}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>English Name</TableCell>
              <TableCell>{info.SymbolEngName}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>Market</TableCell>
              <TableCell>{info.MarketId}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>Exchange</TableCell>
              <TableCell>{info.Exchange}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>Issuer</TableCell>
              <TableCell>{info.Issuer}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>Lot Size</TableCell>
              <TableCell>{info.LotSize}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>Listed Shares</TableCell>
              <TableCell>{parseInt(info.ListedShare).toLocaleString()}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderChartTab = () => {
    if (chartLoading && !chartError) {
      return (
        <Box display="flex" justifyContent="center" padding={4}>
          <CircularProgress />
        </Box>
      );
    }

    if (chartError) {
      return (
        <Box p={3}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {chartError}
          </Alert>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
            Could not load chart data. This might be due to API rate limiting or no data available for this symbol.
          </Typography>
          
          {chartError.includes('rate limit') && (
            <Box display="flex" justifyContent="center" mt={2}>
              <button 
                onClick={handleChartDataRetry}
                disabled={isRetrying}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isRetrying ? 'not-allowed' : 'pointer',
                  opacity: isRetrying ? 0.7 : 1
                }}
              >
                {isRetrying ? 'Retrying...' : 'Retry Now'}
              </button>
            </Box>
          )}
        </Box>
      );
    }

    if (chartData.length > 0) {
      return <StockChart data={chartData} />;
    }

    return (
      <Box p={3} display="flex" justifyContent="center">
        <Typography>No chart data available for this symbol</Typography>
      </Box>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {symbol} Details
          </Typography>
          <IconButton edge="end" color="inherit" onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Company Info" {...a11yProps(0)} />
            <Tab label="Price Chart" {...a11yProps(1)} />
            <Tab label="AI Prediction" {...a11yProps(2)} />
          </Tabs>
        </Box>
        
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          <TabPanel value={tabValue} index={0}>
            {renderCompanyInfo()}
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            {renderChartTab()}
          </TabPanel>
          
          <TabPanel value={tabValue} index={2}>
            <AIPredictor symbol={symbol} />
          </TabPanel>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default StockDetailModal; 