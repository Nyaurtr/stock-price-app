import React from 'react';
import { ApiResponse } from '../types/apiTypes';

interface ApiResponseDisplayProps {
  response: ApiResponse | null;
  error: string | null;
}

const ApiResponseDisplay: React.FC<ApiResponseDisplayProps> = ({ response, error }) => {
  return (
    <div className="w-full animate-fade-in">
      {error && (
        <div className="bg-error-light border border-error text-error px-4 py-3 rounded mb-4" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      {response && (
        <div className="card">
          <div className="border-b pb-2 mb-3">
            <h3 className="text-lg font-medium">API Response</h3>
          </div>
          <div className="max-h-96 overflow-auto">
            <pre className="api-response-box text-sm whitespace-pre-wrap">{JSON.stringify(response, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiResponseDisplay; 