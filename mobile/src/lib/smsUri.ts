import { Platform } from 'react-native';

/**
 * verify.mn returns `sms:144773?body=…` (the Android form). iOS Messages only
 * pre-fills the body with `&body=`. Built per platform from the server's URI so
 * the shortcode and text stay whatever verify.mn said. Check both on a real
 * phone — simulators cannot send SMS.
 */
export function platformSmsUri(serverUri: string): string {
  const match = /^sms:([^?&]+)[?&]body=(.*)$/.exec(serverUri);
  if (!match) return serverUri;
  const [, number, body] = match;
  return Platform.OS === 'ios' ? `sms:${number}&body=${body}` : `sms:${number}?body=${body}`;
}

/** The 6-digit code inside the URI (shown big in the card). */
export function codeFromSmsUri(serverUri: string): string {
  const match = /body=([^&]*)/.exec(serverUri);
  return match ? decodeURIComponent(match[1]) : '';
}
