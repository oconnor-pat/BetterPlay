import React, {createContext, useContext, useState, ReactNode} from 'react';

export interface ThemeColors {
  background: string;
  card: string;
  text: string;
  primary: string;
  border: string;
  error: string;
  buttonText: string;
  inputBackground: string;
  placeholder: string; // <-- Added placeholder property
}

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  colors: ThemeColors;
}

const lightColors: ThemeColors = {
  background: '#bcbcbc',
  card: '#fff',
  text: '#222',
  primary: '#007bff',
  border: '#ccc',
  error: '#b11313',
  buttonText: '#fff',
  inputBackground: '#f0f0f0',
  placeholder: '#888', // <-- Added placeholder color for light mode
};

const darkColors: ThemeColors = {
  background: '#181818',
  card: '#222',
  text: '#fff',
  primary: '#1e90ff',
  border: '#333',
  error: '#ff4d4f',
  buttonText: '#fff',
  inputBackground: '#333',
  placeholder: '#aaa', // <-- Added placeholder color for dark mode
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({children}: {children: ReactNode}) => {
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  const colors = darkMode ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{darkMode, toggleDarkMode, colors}}>
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
