import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SecuritiesTable from '../components/SecuritiesTable';

const MarketDataPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'securities-list' | 'price-chart'>('securities-list');

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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-gray-500 text-center">Price chart feature coming soon...</p>
        </div>
      )}
    </div>
  );
};

export default MarketDataPage; 