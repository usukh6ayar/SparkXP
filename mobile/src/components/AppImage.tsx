import type { ImageSourcePropType } from 'react-native';
import { Image, type ImageProps, type ImageContentFit } from 'expo-image';
import { cldUrl } from '../lib/image';

type Source = ImageSourcePropType | string | null | undefined;

type ResizeMode = 'cover' | 'contain' | 'stretch' | 'center';

/** RN resizeMode → expo-image contentFit. */
const FIT: Record<ResizeMode, ImageContentFit> = {
  cover: 'cover',
  contain: 'contain',
  stretch: 'fill',
  center: 'none',
};

interface Props extends Omit<ImageProps, 'source' | 'contentFit'> {
  source: Source;
  /** Rendered width (px). Used to fetch a right-sized Cloudinary image. */
  width?: number;
  /** expo-image contentFit; also accepts RN's resizeMode for drop-in swaps. */
  contentFit?: ImageContentFit;
  resizeMode?: ResizeMode;
}

/**
 * App-wide image component built on expo-image (memory+disk cache, fast native
 * decode, WebP). For remote Cloudinary URLs it auto-applies f_auto/q_auto/width
 * optimization via cldUrl — so screens download small, right-sized images
 * instead of full-resolution masters. Local require() images pass through.
 *
 * Drop-in for RN <Image>: pass `source`, `style`, and `contentFit` (or
 * `resizeMode`). Add `width` on remote images to cap download size.
 */
export function AppImage({ source, width, contentFit, resizeMode, ...rest }: Props) {
  const resolved = normalize(source, width);
  return (
    <Image
      source={resolved}
      contentFit={contentFit ?? (resizeMode ? FIT[resizeMode] : 'cover')}
      cachePolicy="memory-disk"
      transition={150}
      {...rest}
    />
  );
}

/** Local numbers pass through; remote URLs get Cloudinary optimization. */
function normalize(source: Source, width?: number): ImageProps['source'] {
  if (source == null) return undefined;
  if (typeof source === 'number') return source; // local require()
  if (typeof source === 'string') return { uri: cldUrl(source, width) };
  // Single {uri} object → optimize; anything else (arrays, etc.) → pass through.
  if (!Array.isArray(source) && typeof source.uri === 'string') {
    return { uri: cldUrl(source.uri, width) };
  }
  return source as ImageProps['source'];
}
