import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, Alert } from 'react-native';
import { authenticate } from '../utils/airwallexApi';

/**
 * AirwallexProvider component to initialize Airwallex on app startup
 * This ensures the Airwallex API is authenticated when needed
 */
const AirwallexProvider = ({ children }) => {
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;

  // Initialize Airwallex auth on component mount
  useEffect(() => {
    const initAirwallex = async () => {
      try {
        console.log('Initializing Airwallex...');
        // Pre-authenticate with Airwallex to ensure token is ready
        await authenticate();
        console.log('Airwallex initialized successfully');
        setError(null);
      } catch (err) {
        console.error('Failed to initialize Airwallex:', err);
        setError(err.message || 'Failed to initialize payment provider');
        
        // Only retry a limited number of times
        if (retryCount < MAX_RETRIES) {
          console.log(`Retry attempt ${retryCount + 1} of ${MAX_RETRIES}`);
          setRetryCount(prev => prev + 1);
          // Try again in 2 seconds
          setTimeout(() => initAirwallex(), 2000);
          return;
        }
      } finally {
        // Only set initializing to false if we're done retrying
        if (retryCount >= MAX_RETRIES || !error) {
          setInitializing(false);
        }
      }
    };

    initAirwallex();
  }, [retryCount]);

  // Show loading state while initializing
  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2274F0" />
        <Text style={{ marginTop: 10, color: '#666', textAlign: 'center' }}>
          {retryCount > 0 
            ? `Initializing payment system... (Retrying ${retryCount}/${MAX_RETRIES})`
            : 'Initializing payment system...'}
        </Text>
      </View>
    );
  }

  // Show error state if initialization failed after all retries
  if (error) {
    console.warn('Continuing despite Airwallex initialization error:', error);
    
    // We could show an alert here, but it might be better to just log it
    // and let the app continue - the payment screen will handle errors gracefully
    // Alert.alert(
    //   'Payment System Notice',
    //   'The payment system is currently in offline mode. Some payment features may be limited.',
    //   [{ text: 'OK' }]
    // );
  }

  // Render children once initialized or if error (to avoid blocking the app)
  return children;
};

export default AirwallexProvider; 