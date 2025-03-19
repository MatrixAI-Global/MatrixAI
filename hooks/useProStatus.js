import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const ProStatusContext = createContext();

export const ProStatusProvider = ({ children }) => {
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // This function can be called to check subscription status
  const checkProStatus = async (uid) => {
    if (!uid) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('subscription_active')
        .eq('uid', uid)
        .single();

      if (error) {
        console.error('Error fetching subscription status:', error);
        setIsPro(false);
      } else {
        setIsPro(data?.subscription_active || false);
        setUserId(uid);
      }
    } catch (error) {
      console.error('Exception checking pro status:', error);
      setIsPro(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProStatusContext.Provider value={{ isPro, isLoading, checkProStatus, userId }}>
      {children}
    </ProStatusContext.Provider>
  );
};

export const useProStatus = () => {
  const context = useContext(ProStatusContext);
  if (context === undefined) {
    throw new Error('useProStatus must be used within a ProStatusProvider');
  }
  return context;
}; 