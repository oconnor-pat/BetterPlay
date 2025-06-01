const ENV = __DEV__ ? 'development' : 'production';

const API_URLS = {
  development: 'http://localhost:8001',
  production: 'https://omhl-be-9801a7de15ab.herokuapp.com',
};

export const API_BASE_URL = API_URLS[ENV];
