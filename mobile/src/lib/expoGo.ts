import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * True only inside the Expo Go client. Expo Go lacks native modules like Hot
 * Updater, Google Sign-In and remote push, so callers skip them here.
 *
 * Not `Constants.appOwnership === 'expo'`: since SDK 57 that is `null` in Expo
 * Go too, which flipped every guard and crashed Expo Go on launch.
 */
export const IN_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
