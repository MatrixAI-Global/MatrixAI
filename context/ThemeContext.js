import React, { createContext, useState, useEffect, useContext } from 'react';
import { getPreferredTheme, setPreferredTheme, DEFAULT_THEME, THEMES } from '../utils/themeUtils';

// Create theme context
export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);

  // Load saved theme preference on app start
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await getPreferredTheme();
        setCurrentTheme(savedTheme);
      } catch (error) {
        console.error('Error loading theme preference:', error);
      } finally {
        setLoading(false);
      }
    };

    loadThemePreference();
  }, []);

  // Function to change theme
  const changeTheme = async (theme) => {
    try {
      await setPreferredTheme(theme);
      setCurrentTheme(theme);
      return true;
    } catch (error) {
      console.error('Error changing theme:', error);
      return false;
    }
  };

  // Get current theme colors
  const getThemeColors = () => {
    return THEMES[currentTheme].colors;
  };

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        changeTheme,
        getThemeColors,
        loading,
        themes: THEMES
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 