/// <reference types="node" />
import { existsSync } from 'node:fs'
import type { ExpoConfig } from 'expo/config'

/**
 * Native identity, permissions and plugins.
 *
 * Push credentials are files you add, not secrets in this repo:
 *   ./google-services.json      Firebase Android app (FCM token + delivery)
 *   ./GoogleService-Info.plist  only if you also use Firebase on iOS (not required —
 *                               iOS uses APNs directly, see agent-api src/push/apns.ts)
 * They're referenced only when present, so the app still builds without them
 * (it just can't receive pushes).
 *
 * EXPO_PUBLIC_API_URL points the app at agent-api. On a physical device use
 * your machine's LAN address, not localhost.
 */
const BUNDLE_ID = process.env.APP_BUNDLE_ID ?? 'com.chatflow.agent'
const hasGoogleServices = existsSync('./google-services.json')

const config: ExpoConfig = {
  name: 'ChatFlow Agent',
  slug: 'chatflow-agent',
  scheme: 'chatflow',
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: true,
    infoPlist: {
      NSMicrophoneUsageDescription: 'ChatFlow needs the microphone for voice and video calls with customers.',
      NSCameraUsageDescription: 'ChatFlow needs the camera for video calls and to take photos you send to customers.',
      NSPhotoLibraryUsageDescription: 'ChatFlow needs your photos to send pictures and videos to customers.',
      // remote-notification: silent pushes; audio: keep a call alive when the screen locks.
      // (`voip` is added by the callkeep plugin.)
      UIBackgroundModes: ['remote-notification', 'audio'],
    },
    entitlements: {
      'aps-environment': process.env.APS_ENVIRONMENT ?? 'development',
    },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    ...(hasGoogleServices && { googleServicesFile: './google-services.json' }),
    permissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.CAMERA',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.POST_NOTIFICATIONS',
      // ConnectionService (system incoming-call UI) via react-native-callkeep
      'android.permission.BIND_TELECOM_CONNECTION_SERVICE',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.FOREGROUND_SERVICE_CAMERA',
      'android.permission.READ_PHONE_NUMBERS',
      'android.permission.MANAGE_OWN_CALLS',
      'android.permission.USE_FULL_SCREEN_INTENT',
      'android.permission.WAKE_LOCK',
    ],
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: './assets/favicon.png', bundler: 'metro' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-notifications', { color: '#0066ff', enableBackgroundRemoteNotifications: true }],
    ['expo-image-picker', {
      photosPermission: 'ChatFlow needs your photos to send pictures and videos to customers.',
      cameraPermission: 'ChatFlow needs the camera for video calls and to take photos you send to customers.',
    }],
    ['@config-plugins/react-native-webrtc', {
      cameraPermission: 'ChatFlow needs the camera for video calls and to take photos you send to customers.',
      microphonePermission: 'ChatFlow needs the microphone for voice and video calls with customers.',
    }],
    '@config-plugins/react-native-callkeep',
    './plugins/withVoipPush',
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8090',
  },
}

export default config
