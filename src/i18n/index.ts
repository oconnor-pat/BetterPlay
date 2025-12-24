import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import translations
import en from './translations/en.json';
import es from './translations/es.json';
import fr from './translations/fr.json';
import de from './translations/de.json';
import it from './translations/it.json';
import pt from './translations/pt.json';
import zh from './translations/zh.json';
import ja from './translations/ja.json';
import ko from './translations/ko.json';
import ar from './translations/ar.json';
import hi from './translations/hi.json';
import ru from './translations/ru.json';

const LANGUAGE_STORAGE_KEY = '@app_language';

const resources = {
  en: {translation: en},
  es: {translation: es},
  fr: {translation: fr},
  de: {translation: de},
  it: {translation: it},
  pt: {translation: pt},
  zh: {translation: zh},
  ja: {translation: ja},
  ko: {translation: ko},
  ar: {translation: ar},
  hi: {translation: hi},
  ru: {translation: ru},
};

// Language detector that loads from AsyncStorage
const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lang: string) => void) => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage) {
        callback(savedLanguage);
        return;
      }
    } catch (error) {
      console.error('Error detecting language:', error);
    }
    callback('en');
  },
  init: () => {},
  cacheUserLanguage: async (language: string) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch (error) {
      console.error('Error caching language:', error);
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
