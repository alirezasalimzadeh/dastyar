import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ir.dastyar.crm',
  appName: 'دستیار مشاور',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#f8fafc',
    allowMixedContent: false,
  },
};

export default config;
