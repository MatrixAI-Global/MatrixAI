import React, { createContext, useState, useEffect, useContext } from 'react';
import { getPreferredLanguage, setPreferredLanguage, DEFAULT_LANGUAGE } from '../utils/languageUtils';
import { getTranslation } from '../utils/translations';

// Create language context
export const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(DEFAULT_LANGUAGE);
  const [loading, setLoading] = useState(true);

  // Load saved language preference on app start
  useEffect(() => {
    const loadLanguagePreference = async () => {
      try {
        const savedLanguage = await getPreferredLanguage();
        setCurrentLanguage(savedLanguage);
      } catch (error) {
        console.error('Error loading language preference:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLanguagePreference();
  }, []);

  // Function to change language
  const changeLanguage = async (language) => {
    try {
      await setPreferredLanguage(language);
      setCurrentLanguage(language);
      return true;
    } catch (error) {
      console.error('Error changing language:', error);
      return false;
    }
  };

  // Translate function
  const t = (key) => {
    return getTranslation(key, currentLanguage);
  };

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        changeLanguage,
        t,
        loading
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

// Custom hook to use language context
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}; 