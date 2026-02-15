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
  background: '#F6F8FA',
  card: '#ffffff',
  text: '#1B1F23',
  secondaryText: '#6A737D',
  primary: '#2ECC71',
  border: '#E1E4E8',
  error: '#D73A49',
  success: '#28A745',
  buttonText: '#fff',
  inputBackground: '#F0F2F5',
  placeholder: '#8B949E',
};

const darkColors: ThemeColors = {
  background: '#121212',
  card: '#1E1E1E',
  text: '#E8E8E8',
  secondaryText: '#A0A0A0',
  primary: '#2ECC71',
  border: '#333333',
  error: '#F4212E',
  success: '#00BA7C',
  buttonText: '#fff',
  inputBackground: '#252525',
  placeholder: '#808080',
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
