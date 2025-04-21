import React, { useState, createContext, useContext } from 'react';
import { authenticate } from '../utils/airwallexApi';

// Create a context to expose authentication methods
export const AirwallexContext = createContext({
  initialized: false,
  initializing: false,
  error: null,
  initializeAirwallex: async () => {},
});

/**
 * AirwallexProvider component that provides lazy authentication
 * Authentication will only happen when explicitly called, not on app mount
 */
const AirwallexProvider = ({ children }) => {
  const [initialized, setInitialized] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;

  // Function to initialize Airwallex auth only when explicitly called
  const initializeAirwallex = async () => {
    // If already initialized or initializing, don't start again
    if (initialized || initializing) return { success: initialized, error };
    
    setInitializing(true);
    setError(null);
    
    try {
      console.log('Initializing Airwallex...');
      // Authenticate with Airwallex
      await authenticate();
      console.log('Airwallex initialized successfully');
      setInitialized(true);
      setError(null);
      return { success: true, error: null };
    } catch (err) {
      console.error('Failed to initialize Airwallex:', err);
      const errorMessage = err.message || 'Failed to initialize payment provider';
      setError(errorMessage);
      
      // Only retry a limited number of times
      if (retryCount < MAX_RETRIES) {
        console.log(`Retry attempt ${retryCount + 1} of ${MAX_RETRIES}`);
        setRetryCount(prev => prev + 1);
        // Try again in 2 seconds
        setTimeout(() => initializeAirwallex(), 2000);
      }
      
      return { success: false, error: errorMessage };
    } finally {
      // Only set initializing to false if we're done retrying or succeeded
      if (retryCount >= MAX_RETRIES || initialized) {
        setInitializing(false);
      }
    }
  };

  // Provide context values to children
  return (
    <AirwallexContext.Provider 
      value={{
        initialized,
        initializing,
        error,
        initializeAirwallex,
      }}
    >
      {children}
    </AirwallexContext.Provider>
  );
};

// Custom hook to use the Airwallex context
export const useAirwallex = () => useContext(AirwallexContext);

export default AirwallexProvider; 