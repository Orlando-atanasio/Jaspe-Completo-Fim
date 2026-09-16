import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'app.jaspe.mobile',
  appName: 'JASPE',
  webDir: 'dist',
  backgroundColor: '#0E0A09',
  android: {
    allowMixedContent: false
  },
  // CapacitorHttp: roteia fetch()/XHR pela ponte nativa do Android em vez da
  // WebView, contornando de verdade a restrição de CORS que bloqueia o Yahoo
  // direto no navegador (motivo original de existirem os proxies em
  // utils/finance.ts). Só vale para a build Android — a versão web/PWA
  // continua dependendo dos proxies CORS, que ficam mantidos como estão.
  plugins: {
    CapacitorHttp: {
      enabled: true
    },
    Keyboard: {
      resize: KeyboardResize.Body,
      resizeOnFullScreen: true
    },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#0E0A09',
      showSpinner: false
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0E0A09'
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#EA580C'
    }
  }
};

export default config;
