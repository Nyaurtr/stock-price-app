import React, { useState } from 'react';
import ApiFormField from './ApiFormField';
import ApiButton from './ApiButton';
import ApiResponseDisplay from './ApiResponseDisplay';
import apiService from '../services/apiService';
import { ApiResponse } from '../types/apiTypes';

const SecuritiesListSection: React.FC = () => {
  const [market, setMarket] = useState('HOSE');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ApiResponse | null>(null);

  const marketOptions = [
    { value: 'HOSE', label: 'HOSE' },
    { value: 'HNX', label: 'HNX' },
    { value: 'UPCOM', label: 'UPCOM' },
    { value: 'DER', label: 'DER' }
  ];

  const handleTestApi = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiService.getSecuritiesList(market);
      setResponse(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
      <div className="card">
        <h3 className="text-lg font-medium mb-4">Securities List API</h3>
        
        <ApiFormField
          label="Market"
          value={market}
          onChange={setMarket}
          options={marketOptions}
          required
        />
        
        <div className="mt-6">
          <ApiButton
            onClick={handleTestApi}
            isLoading={isLoading}
          >
            Test API
          </ApiButton>
        </div>
      </div>
      
      <ApiResponseDisplay response={response} error={error} />
    </div>
  );
};

export default SecuritiesListSection; 