import React, { useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import { ApiResponse, ApiFunction } from '../types/apiTypes';
import ApiTabs from '../components/ApiTabs';
import TabPanel from '../components/TabPanel';
import ApiFormField from '../components/ApiFormField';
import ApiButton from '../components/ApiButton';
import ApiResponseDisplay from '../components/ApiResponseDisplay';
import SecuritiesListSection from '../components/SecuritiesListSection';
import { Link } from 'react-router-dom';

const DashboardPage: React.FC = () => {
  const { logout } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ApiResponse | null>(null);

  // Form states for different API calls
  const [securitiesMarket, setSecuritiesMarket] = useState('HOSE');
  const [securitiesSymbol, setSecuritiesSymbol] = useState('SSI');
  const [indexCode, setIndexCode] = useState('VN30');
  const [exchange, setExchange] = useState('HOSE');
  const [fromDate, setFromDate] = useState(format(new Date(), 'MM/dd/yyyy'));
  const [toDate, setToDate] = useState(format(new Date(), 'MM/dd/yyyy'));
  
  const handleTabChange = (newValue: number) => {
    setTabValue(newValue);
    setResponse(null);
    setError(null);
  };

  const handleLogout = () => {
    logout();
  };

  const handleApiCall = async (apiFunction: ApiFunction) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFunction();
      setResponse(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
    } finally {
      setLoading(false);
    }
  };

  const marketOptions = [
    { value: 'HOSE', label: 'HOSE' },
    { value: 'HNX', label: 'HNX' },
    { value: 'UPCOM', label: 'UPCOM' },
    { value: 'DER', label: 'DER' }
  ];

  const tabs = [
    'Securities List',
    'Securities Details',
    'Index Components',
    'Index List',
    'Daily OHLC',
    'Intraday OHLC',
    'Daily Index',
    'Daily Stock Price'
  ];

  return (
    <div className="container mx-auto px-4 py-8 animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">SSI API Testing Tool</h1>
        <div className="flex items-center space-x-4">
          <Link to="/market-data" className="btn btn-primary">
            Market Data
          </Link>
          <ApiButton 
            onClick={handleLogout}
            variant="outline"
          >
            Logout
          </ApiButton>
        </div>
      </div>

      <div className="card">
        <ApiTabs
          tabs={tabs}
          currentTab={tabValue}
          onChange={handleTabChange}
        />

        {/* Securities List */}
        <TabPanel value={tabValue} index={0}>
          <SecuritiesListSection />
        </TabPanel>

        {/* Securities Details */}
        <TabPanel value={tabValue} index={1}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-medium mb-4">Securities Details API</h3>
              
              <ApiFormField
                label="Market"
                value={securitiesMarket}
                onChange={setSecuritiesMarket}
                options={marketOptions}
                required
              />
              
              <ApiFormField
                label="Symbol"
                value={securitiesSymbol}
                onChange={setSecuritiesSymbol}
                required
              />
              
              <div className="mt-6">
                <ApiButton
                  onClick={() => handleApiCall(() => apiService.getSecuritiesDetails(securitiesMarket, securitiesSymbol))}
                  isLoading={loading}
                >
                  Test API
                </ApiButton>
              </div>
            </div>
            
            <ApiResponseDisplay response={response} error={error} />
          </div>
        </TabPanel>

        {/* Index Components */}
        <TabPanel value={tabValue} index={2}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-medium mb-4">Index Components API</h3>
              
              <ApiFormField
                label="Index Code"
                value={indexCode}
                onChange={setIndexCode}
                required
              />
              
              <div className="mt-6">
                <ApiButton
                  onClick={() => handleApiCall(() => apiService.getIndexComponents(indexCode))}
                  isLoading={loading}
                >
                  Test API
                </ApiButton>
              </div>
            </div>
            
            <ApiResponseDisplay response={response} error={error} />
          </div>
        </TabPanel>

        {/* Index List */}
        <TabPanel value={tabValue} index={3}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-medium mb-4">Index List API</h3>
              
              <ApiFormField
                label="Exchange"
                value={exchange}
                onChange={setExchange}
                options={marketOptions}
                required
              />
              
              <div className="mt-6">
                <ApiButton
                  onClick={() => handleApiCall(() => apiService.getIndexList(exchange))}
                  isLoading={loading}
                >
                  Test API
                </ApiButton>
              </div>
            </div>
            
            <ApiResponseDisplay response={response} error={error} />
          </div>
        </TabPanel>

        {/* Daily OHLC */}
        <TabPanel value={tabValue} index={4}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-medium mb-4">Daily OHLC API</h3>
              
              <ApiFormField
                label="Symbol"
                value={securitiesSymbol}
                onChange={setSecuritiesSymbol}
                required
              />
              
              <ApiFormField
                label="From Date (MM/DD/YYYY)"
                value={fromDate}
                onChange={setFromDate}
                required
              />
              
              <ApiFormField
                label="To Date (MM/DD/YYYY)"
                value={toDate}
                onChange={setToDate}
                required
              />
              
              <div className="mt-6">
                <ApiButton
                  onClick={() => handleApiCall(() => apiService.getDailyOhlc(securitiesSymbol, fromDate, toDate))}
                  isLoading={loading}
                >
                  Test API
                </ApiButton>
              </div>
            </div>
            
            <ApiResponseDisplay response={response} error={error} />
          </div>
        </TabPanel>

        {/* Intraday OHLC */}
        <TabPanel value={tabValue} index={5}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-medium mb-4">Intraday OHLC API</h3>
              
              <ApiFormField
                label="Symbol"
                value={securitiesSymbol}
                onChange={setSecuritiesSymbol}
                required
              />
              
              <ApiFormField
                label="From Date (MM/DD/YYYY)"
                value={fromDate}
                onChange={setFromDate}
                required
              />
              
              <ApiFormField
                label="To Date (MM/DD/YYYY)"
                value={toDate}
                onChange={setToDate}
                required
              />
              
              <div className="mt-6">
                <ApiButton
                  onClick={() => handleApiCall(() => apiService.getIntradayOhlc(securitiesSymbol, fromDate, toDate))}
                  isLoading={loading}
                >
                  Test API
                </ApiButton>
              </div>
            </div>
            
            <ApiResponseDisplay response={response} error={error} />
          </div>
        </TabPanel>

        {/* Daily Index */}
        <TabPanel value={tabValue} index={6}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-medium mb-4">Daily Index API</h3>
              
              <ApiFormField
                label="Index Code"
                value={indexCode}
                onChange={setIndexCode}
                required
              />
              
              <ApiFormField
                label="From Date (MM/DD/YYYY)"
                value={fromDate}
                onChange={setFromDate}
                required
              />
              
              <ApiFormField
                label="To Date (MM/DD/YYYY)"
                value={toDate}
                onChange={setToDate}
                required
              />
              
              <div className="mt-6">
                <ApiButton
                  onClick={() => handleApiCall(() => apiService.getDailyIndex(indexCode, fromDate, toDate))}
                  isLoading={loading}
                >
                  Test API
                </ApiButton>
              </div>
            </div>
            
            <ApiResponseDisplay response={response} error={error} />
          </div>
        </TabPanel>

        {/* Daily Stock Price */}
        <TabPanel value={tabValue} index={7}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-medium mb-4">Daily Stock Price API</h3>
              
              <ApiFormField
                label="Symbol"
                value={securitiesSymbol}
                onChange={setSecuritiesSymbol}
                required
              />
              
              <ApiFormField
                label="Market"
                value={securitiesMarket}
                onChange={setSecuritiesMarket}
                options={marketOptions}
                required
              />
              
              <ApiFormField
                label="From Date (MM/DD/YYYY)"
                value={fromDate}
                onChange={setFromDate}
                required
              />
              
              <ApiFormField
                label="To Date (MM/DD/YYYY)"
                value={toDate}
                onChange={setToDate}
                required
              />
              
              <div className="mt-6">
                <ApiButton
                  onClick={() => handleApiCall(() => apiService.getDailyStockPrice(securitiesSymbol, fromDate, toDate))}
                  isLoading={loading}
                >
                  Test API
                </ApiButton>
              </div>
            </div>
            
            <ApiResponseDisplay response={response} error={error} />
          </div>
        </TabPanel>
      </div>
    </div>
  );
};

export default DashboardPage; 