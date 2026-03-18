import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sleepassured.app',
  appName: 'Sleep Assured',
  webDir: 'dist',
  server: {
    // In dev, point to Vite dev server
    url: process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : undefined,
    cleartext: true,
  },
};

export default config;
