import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import {useColorScheme} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeColors {
  background: string;
  card: string;
  text: string;
  secondaryText: string;
  primary: string;
  border: string;
  error: string;
  success: string;
  buttonText: string;
  inputBackground: string;
  placeholder: string;
}

interface ThemeContextType {
  darkMode: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  colors: ThemeColors;
}

const lightColors: ThemeColors = {
  background: '#f5f5f7',
  card: '#ffffff',
  text: '#1d1d1f',
  secondaryText: '#86868b',
  primary: '#2ECC71',
  border: '#d2d2d7',
  error: '#b11313',
  success: '#4CAF50',
  buttonText: '#fff',
  inputBackground: '#e8e8ed',
  placeholder: '#8e8e93',
};

const darkColors: ThemeColors = {
  background: '#181818',
  card: '#222',
  text: '#fff',
  secondaryText: '#aaa',
  primary: '#2ECC71',
  border: '#333',
  error: '#ff4d4f',
  success: '#4CAF50',
  buttonText: '#fff',
  inputBackground: '#333',
  placeholder: '#aaa',
};

const THEME_STORAGE_KEY = '@app_theme_mode';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({children}: {children: ReactNode}) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  // Load saved theme preference on mount (non-blocking)
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (
          savedTheme &&
          (savedTheme === 'system' ||
            savedTheme === 'light' ||
            savedTheme === 'dark')
        ) {
          setThemeModeState(savedTheme as ThemeMode);
        }
      } catch (error) {
        console.error('Error loading theme preference:', error);
      }
    };
    loadThemePreference();
  }, []);

  // Save theme preference and update state
  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  // Determine if dark mode is active
  const darkMode =
    themeMode === 'dark' ||
    (themeMode === 'system' && systemColorScheme === 'dark');

  const colors = darkMode ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{darkMode, themeMode, setThemeMode, colors}}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
