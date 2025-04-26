import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Alert, FormControl, Select, MenuItem, InputLabel, SelectChangeEvent } from '@mui/material';

// Export the interface so it can be imported elsewhere
export interface ChartDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StockChartProps {
  data: ChartDataPoint[];
}

const StockChart: React.FC<StockChartProps> = ({ data }) => {
  const [error, setError] = useState<string | null>(null);
  const [sortedData, setSortedData] = useState<ChartDataPoint[]>([]);
  const [timeRange, setTimeRange] = useState<string>("150");
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Function to handle time range change
  const handleTimeRangeChange = (event: SelectChangeEvent) => {
    setTimeRange(event.target.value as string);
  };

  // Process data on component mount or when data changes
  useEffect(() => {
    try {
      if (!data || data.length === 0) {
        setError('No chart data available');
        return;
      }

      // Validate data to ensure all required properties exist and have valid values
      const validData = data.filter(item => {
        const hasValidDate = !!item.date;
        const hasValidOpen = !isNaN(item.open) && item.open !== 0;
        const hasValidHigh = !isNaN(item.high) && item.high !== 0;
        const hasValidLow = !isNaN(item.low) && item.low !== 0;
        const hasValidClose = !isNaN(item.close) && item.close !== 0;
        
        // Need at least the date and one price point to be valid
        return hasValidDate && (hasValidOpen || hasValidHigh || hasValidLow || hasValidClose);
      });

      if (validData.length === 0) {
        setError('No valid chart data points found');
        return;
      }

      // Convert dates to proper format if necessary
      const normalizedData = validData.map(item => {
        // Normalize any zero values to use other price points
        // This ensures we don't have gaps in the chart
        const open = item.open || item.close || item.high || item.low;
        const high = item.high || Math.max(item.open, item.close) || open;
        const low = item.low || Math.min(item.open, item.close) || open;
        const close = item.close || item.open || high || low;
        
        return {
          ...item,
          open,
          high,
          low,
          close
        };
      });

      // Sort data from oldest to newest
      const sorted = [...normalizedData].sort((a, b) => {
        try {
          // Try to parse the date in different formats
          let dateA, dateB;
          
          if (a.date.includes('/')) {
            // Format: DD/MM/YYYY
            const parts = a.date.split('/');
            dateA = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          } else {
            dateA = new Date(a.date);
          }
          
          if (b.date.includes('/')) {
            // Format: DD/MM/YYYY
            const parts = b.date.split('/');
            dateB = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          } else {
            dateB = new Date(b.date);
          }
          
          return dateA.getTime() - dateB.getTime();
        } catch {
          // If date parsing fails, try string comparison
          return a.date.localeCompare(b.date);
        }
      });
      
      setSortedData(sorted);
      setError(null);
    } catch (error) {
      console.error('Error processing chart data:', error);
      setError('Error processing chart data. Please check console for details.');
    }
  }, [data]);

  // Initialize the chart when data is ready or when time range changes
  useEffect(() => {
    if (sortedData.length === 0 || !chartContainerRef.current) return;

    // Clean up any previous chart
    const chartContainer = chartContainerRef.current;
    while (chartContainer.firstChild) {
      chartContainer.removeChild(chartContainer.firstChild);
    }

    // Filter data based on selected time range
    const filteredData = timeRange === "all" ? 
      sortedData : 
      sortedData.slice(-parseInt(timeRange));

    // Create the chart
    const createLightweightChart = async () => {
      try {
        // Dynamically import the library
        const { createChart, CandlestickSeries } = await import('lightweight-charts');
        
        // Create the chart instance
        const chart = createChart(chartContainer, {
          width: chartContainer.clientWidth,
          height: 400,
          layout: {
            background: { type: 'solid', color: '#ffffff' },
            textColor: '#333',
          },
          grid: {
            vertLines: { color: '#f0f0f0' },
            horzLines: { color: '#f0f0f0' },
          },
          timeScale: {
            timeVisible: true,
            borderColor: '#d6dcde',
          },
          rightPriceScale: {
            borderColor: '#d6dcde',
          },
          crosshair: {
            vertLine: {
              width: 1,
              color: 'rgba(224, 227, 235, 0.8)',
              style: 1,
            },
            horzLine: {
              width: 1,
              color: 'rgba(224, 227, 235, 0.8)',
              style: 1,
            },
            mode: 1,
          },
        });

        // Create the candlestick series - v5 API
        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#26a69a', 
          downColor: '#ef5350',
          borderVisible: false,
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
        });

        // Format the data for the chart
        const ohlcData = filteredData.map(item => {
          // Parse date to timestamp
          const dateParts = item.date.split('/');
          const dateString = dateParts.length === 3 
            ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`
            : item.date;
          
          // Use ISO string for time in v5
          return {
            time: new Date(dateString).toISOString().split('T')[0],
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
          };
        });

        // Set the data
        candleSeries.setData(ohlcData);

        // Fit the chart to the data
        chart.timeScale().fitContent();

        // Handle window resize
        const handleResize = () => {
          chart.applyOptions({ width: chartContainer.clientWidth });
        };

        window.addEventListener('resize', handleResize);

        // Return a cleanup function
        return () => {
          window.removeEventListener('resize', handleResize);
          chart.remove();
        };
      } catch (err) {
        console.error('Error creating chart:', err);
        setError('Failed to load chart library. Please try again later.');
      }
    };

    createLightweightChart();

    // No cleanup function needed here as the chart is recreated on each render
  }, [sortedData, timeRange, setError]);

  if (error) {
    return (
      <Box sx={{ width: '100%', height: '100%', p: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Typography variant="body2" align="center">
          Could not render the chart. The data may be in an incorrect format or missing required values.
        </Typography>
      </Box>
    );
  }

  if (sortedData.length === 0) {
    return (
      <Box sx={{ width: '100%', height: '100%', p: 2 }}>
        <Typography variant="body1" align="center">
          No data available for the chart
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Price History
        </Typography>
        <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="time-range-label">Time Range</InputLabel>
          <Select
            labelId="time-range-label"
            id="time-range-select"
            value={timeRange}
            onChange={handleTimeRangeChange}
            label="Time Range"
          >
            <MenuItem value="7">7 days</MenuItem>
            <MenuItem value="14">14 days</MenuItem>
            <MenuItem value="30">30 days</MenuItem>
            <MenuItem value="90">90 days</MenuItem>
            <MenuItem value="150">5 months</MenuItem>
            <MenuItem value="180">180 days</MenuItem>
            <MenuItem value="365">1 year</MenuItem>
            <MenuItem value="all">All data</MenuItem>
          </Select>
        </FormControl>
      </Box>
      
      <Box ref={chartContainerRef} sx={{ width: '100%', height: 400 }} />
      
      {sortedData.length > 0 && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            First date: {sortedData[0].date}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last date: {sortedData[sortedData.length - 1].date}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default StockChart; 