import React, { useEffect } from 'react';
import { StripeProvider as StripeProviderNative } from '@stripe/stripe-react-native';


const StripeProvider = ({ children }) => {
  const STRIPE_PUBLISHABLE_KEY = 'pk_test_51R6NmQQZ3G0HsF6qpDfd4OOrTKoA5tcU150eF1rZ3uOx0E5d37cZCNCRv25Zlz9yxXpYcj6k7FyS0abWnSnyfYRY00c56aUMk3';
  return (
    <StripeProviderNative
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier="merchant.com.matrixai" // Replace with your merchant identifier
    >
      {children}
    </StripeProviderNative>
  );
};

export default StripeProvider; 