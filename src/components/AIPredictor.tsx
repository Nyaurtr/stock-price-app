import React, { useState, useEffect } from 'react';
import apiService from '../services/apiService';
import { format } from 'date-fns';

interface AIPredictorProps {
  symbol: string;
}

interface PredictionResult {
  type: 'bubble' | 'trend';
  prediction: number;
  probability: number;
  text: string;
  date: string;
}

interface ModelData {
  Ticker: string;
  Model: string;
  'Month-Year': string;
  Index: number;
  Actual: number;
  Prediction: number;
  Prob_Class_0: number;
  Prob_Class_1: number;
  Correct: number;
}

interface ModelResponse {
  status: string;
  data: ModelData[];
  timestamp: string;
  market_state: string;
  query_params: {
    ticker: string;
    month_year: string;
  };
  available_models: string[];
  total_models: number;
  overall_statistics: {
    total_predictions: number;
    correct_predictions: number;
    accuracy: number;
  };
  model_statistics: Record<string, {
    total_predictions: number;
    correct_predictions: number;
    accuracy: number;
    dates: string[];
    total_dates: number;
  }>;
}

const AIPredictor: React.FC<AIPredictorProps> = ({ symbol }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bubblePrediction, setBubblePrediction] = useState<PredictionResult | null>(null);
  const [trendPrediction, setTrendPrediction] = useState<PredictionResult | null>(null);

  useEffect(() => {
    const fetchPredictions = async () => {
      if (!symbol) {
        setError('No symbol selected');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch bubble prediction (BB)
        const bubbleDate = format(new Date('2025-03-01'), 'yyyy-MM-dd');
        const bubbleResponse = await apiService.getStockModelPrediction(
          symbol,
          'BB',
          bubbleDate
        ) as ModelResponse;

        // Fetch trend prediction (UD)
        const trendDate = format(new Date('2025-04-13'), 'yyyy-MM-dd');
        const trendResponse = await apiService.getStockModelPrediction(
          symbol,
          'UD',
          trendDate
        ) as ModelResponse;

        // Process bubble prediction data
        if (bubbleResponse.status === 'success' && Array.isArray(bubbleResponse.data) && bubbleResponse.data.length > 0) {
          const bubbleData = bubbleResponse.data[0];
          const bubbleText = bubbleData.Prediction === 1 
            ? `${symbol} may have bubble in next month`
            : `${symbol} won't have bubble in the next month`;
          
          setBubblePrediction({
            type: 'bubble',
            prediction: bubbleData.Prediction,
            probability: bubbleData.Prob_Class_1,
            text: bubbleText,
            date: '2025-05-01'
          });
        }

        // Process trend prediction data
        if (trendResponse.status === 'success' && Array.isArray(trendResponse.data) && trendResponse.data.length > 0) {
          const trendData = trendResponse.data[0];
          const trendText = trendData.Prediction === 1 
            ? `${symbol} may rise in the next week`
            : `${symbol} may drop in the next week`;
          
          setTrendPrediction({
            type: 'trend',
            prediction: trendData.Prediction,
            probability: trendData.Prob_Class_1,
            text: trendText,
            date: '2025-05-05'
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch prediction data');
        console.error('Error fetching AI predictions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPredictions();
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3">Loading predictions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-md">
        <p className="font-medium">Error</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Bubble Prediction Column */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium mb-2 text-center">Bubble Prediction</h3>
        {bubblePrediction ? (
          <div className="space-y-4">
            <div className={`text-center p-3 rounded-lg font-medium ${
              bubblePrediction.prediction === 1 
                ? 'bg-red-50 text-red-600' 
                : 'bg-green-50 text-green-600'
            }`}>
              {bubblePrediction.text}
            </div>
            
            <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
              <span className="text-gray-500">Prediction Date:</span>
              <span className="font-medium">{bubblePrediction.date}</span>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 p-4">No bubble prediction available</div>
        )}
      </div>
      
      {/* Trend Prediction Column */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium mb-2 text-center">Trend Prediction</h3>
        {trendPrediction ? (
          <div className="space-y-4">
            <div className={`text-center p-3 rounded-lg font-medium ${
              trendPrediction.prediction === 1 
                ? 'bg-green-50 text-green-600' 
                : 'bg-red-50 text-red-600'
            }`}>
              {trendPrediction.text}
            </div>
            
            <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
              <span className="text-gray-500">Prediction Date:</span>
              <span className="font-medium">{trendPrediction.date}</span>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 p-4">No trend prediction available</div>
        )}
      </div>
    </div>
  );
};

export default AIPredictor; 