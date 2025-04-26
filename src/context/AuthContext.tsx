import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import apiService from '../services/apiService';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Automatically authenticate using environment variables
  useEffect(() => {
    const authenticate = async () => {
      setIsLoading(true);
      setError(null);
      
      const consumerID = import.meta.env.VITE_CONSUMER_ID;
      const consumerSecret = import.meta.env.VITE_CONSUMER_SECRET;
      
      console.log("Authentication: Checking credentials", { 
        hasConsumerID: !!consumerID, 
        hasConsumerSecret: !!consumerSecret 
      });
      
      if (!consumerID || !consumerSecret) {
        console.error("Authentication failed: Missing credentials in environment variables");
        setError('Consumer credentials not found in environment variables');
        setIsLoading(false);
        return;
      }
      
      try {
        console.log("Authentication: Calling getAccessToken...");
        const response = await apiService.getAccessToken(consumerID, consumerSecret);
        console.log("Authentication: Response received", { 
          status: response?.status, 
          hasData: !!response?.data,
          hasToken: response?.data?.data?.accessToken ? 'yes' : 'no'
        });
        
        setIsAuthenticated(true);
      } catch (err) {
        console.error('Authentication failed:', err);
        setError('Authentication failed. Please check your environment variables.');
      } finally {
        setIsLoading(false);
      }
    };
    
    authenticate();
  }, []);

  const logout = () => {
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, error, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext; 