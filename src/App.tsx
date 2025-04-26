import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardPage from './pages/DashboardPage';
import MarketDataPage from './pages/MarketDataPage';
import PortfolioBuilderPage from './pages/PortfolioBuilderPage';
import './index.css';

// Navigation component
function Navigation() {
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/market-data', label: 'Market Data' },
    { path: '/portfolio-builder', label: 'Portfolio Builder' }
  ];

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-blue-600 font-bold text-xl">StockApp</span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`${
                    location.pathname === item.path
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile navigation */}
      <div className="sm:hidden border-t border-gray-200">
        <div className="flex justify-around pt-2 pb-3">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`${
                location.pathname === item.path
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
              } block px-3 py-2 text-xs font-medium border-l-4 text-center`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

// App routes component that handles authentication state
function AppRoutes() {
  const { isAuthenticated, isLoading, error } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg animate-fade-in text-center">
          <div className="w-16 h-16 mx-auto mb-6 border-4 border-t-blue-500 border-blue-200 rounded-full animate-spin"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Connecting to API</h2>
          <p className="text-gray-600">Please wait while we establish a secure connection...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center bg-red-100 text-red-500 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Authentication Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-gray-800 mb-2">Please check your environment variables:</p>
            <div className="font-mono text-xs bg-gray-100 p-3 rounded overflow-x-auto">
              VITE_CONSUMER_ID=your_consumer_id<br/>
              VITE_CONSUMER_SECRET=your_consumer_secret
            </div>
          </div>
          
          <div className="flex justify-center">
            <a 
              href="https://developer.ssi.com.vn/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700 text-sm font-medium flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Visit SSI Developer Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {isAuthenticated && <Navigation />}
      <div className="pt-4">
        <Routes>
          <Route 
            path="/dashboard" 
            element={isAuthenticated ? <DashboardPage /> : <Navigate to="/" replace />}
          />
          <Route 
            path="/market-data" 
            element={isAuthenticated ? <MarketDataPage /> : <Navigate to="/" replace />}
          />
          <Route 
            path="/portfolio-builder" 
            element={isAuthenticated ? <PortfolioBuilderPage /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/market-data" replace />} />
        </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-gray-50 animate-fade-in">
      {/* Background elements */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-r from-blue-50 to-indigo-50 opacity-50 -translate-y-1/2 rounded-full blur-3xl transform"></div>
        <div className="absolute bottom-0 right-0 w-full h-96 bg-gradient-to-r from-purple-50 to-pink-50 opacity-50 translate-y-1/2 rounded-full blur-3xl transform"></div>
      </div>
      
      {/* Content container */}
      <div className="relative z-10">
        <AuthProvider>
          <Router>
            <AppRoutes />
          </Router>
        </AuthProvider>
      </div>
    </div>
  );
}

export default App;
