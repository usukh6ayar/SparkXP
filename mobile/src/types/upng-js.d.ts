declare module 'upng-js' {
  interface UPNGImage {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    data: Uint8Array;
  }
  const UPNG: {
    /** Decode a PNG ArrayBuffer into an image descriptor. */
    decode(buffer: ArrayBuffer): UPNGImage;
    /** Convert a decoded image to one RGBA8 ArrayBuffer per frame. */
    toRGBA8(img: UPNGImage): ArrayBuffer[];
  };
  export default UPNG;
}
