/**
 * FileSaver — native bridge (Android) jo generated PDF ko phone ke public
 * "Downloads/SloveCare" folder me save karta hai.
 *
 * Native module: `android/app/src/main/java/com/slovecare/FileSaverModule.kt`
 * (MediaStore Downloads API, API 29+). Purani build me module na ho to
 * `isAvailable` false rehta hai aur JS side share-sheet fallback kar deta hai.
 */

import { NativeModules, Platform } from 'react-native';

interface FileSaverNative {
  /** File ko Downloads me copy karo — public path (ya MediaStore uri) wapas milta hai. */
  saveToDownloads(filePath: string, fileName: string): Promise<string>;
}

const native = (NativeModules as { FileSaver?: FileSaverNative }).FileSaver;

export const FileSaver = {
  /** Native module available hai? (sirf Android par) */
  isAvailable: Platform.OS === 'android' && typeof native?.saveToDownloads === 'function',

  /**
   * @param filePath `file://…` ya plain absolute path
   * @param fileName Target file name (`.pdf` add kar diya jayega agar missing hai)
   * @returns Save hone ke baad file ka public location (Downloads/SloveCare/…)
   */
  async saveToDownloads(filePath: string, fileName: string): Promise<string> {
    if (!native?.saveToDownloads) {
      throw new Error('Saving to Downloads is not supported on this device yet.');
    }
    return native.saveToDownloads(filePath, fileName);
  },
};

export default FileSaver;
