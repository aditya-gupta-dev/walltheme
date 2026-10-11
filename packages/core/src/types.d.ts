/** Untyped image decoder packages. */
declare module 'bmp-js' {
  export function decode(buffer: Buffer): {
    width: number;
    height: number;
    data: Buffer;
  };
}

declare module 'utif' {
  export interface IFD {
    width: number;
    height: number;
    [key: string]: unknown;
  }
  export function decode(buffer: Buffer): IFD[];
  export function decodeImage(buffer: Buffer, ifd: IFD, ifds?: IFD[]): void;
  export function encodeImage(rgba: Uint8Array, width: number, height: number): ArrayBuffer;
  export function toRGBA8(ifd: IFD): Uint8Array;
}
