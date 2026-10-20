package com.slovecare

import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

/**
 * FileSaver — app ke andar banayi hui file (jaise prescription PDF) ko phone ke
 * public "Downloads" folder me save karta hai.
 *
 * Kyun zaroori hai:
 * `react-native-html-to-pdf` sirf app ke apne folder (cache / app external files)
 * me file likhta hai — user ko wo "Downloaded files" me nahi milti. Is module ke
 * baad PDF asli Downloads/SloveCare folder me aa jaati hai, jahan se user use
 * khol, print ya kisi ko bhej sakta hai.
 *
 * Storage:
 *  - API 29+ (Android 10) — MediaStore.Downloads (scoped storage, koi runtime
 *    permission nahi chahiye).
 *  - API 28 se neeche — classic public Downloads folder (WRITE_EXTERNAL_STORAGE
 *    permission chahiye; na ho to error reject hota hai aur JS share-sheet par
 *    fallback kar deta hai).
 */
class FileSaverModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    /**
     * @param filePath source file (absolute path ya `file://` URI)
     * @param fileName target name — `.pdf` missing hoga to add kar diya jayega
     * @return save hone ke baad file ka public location (promise resolve)
     */
    @ReactMethod
    fun saveToDownloads(filePath: String, fileName: String, promise: Promise) {
        try {
            val source = File(filePath.removePrefix("file://"))
            if (!source.exists()) {
                promise.reject("E_NO_FILE", "The file could not be found on this device.")
                return
            }

            val safeName = if (fileName.endsWith(".pdf", ignoreCase = true)) fileName else "$fileName.pdf"

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                saveViaMediaStore(source, safeName, promise)
            } else {
                saveLegacy(source, safeName, promise)
            }
        } catch (error: Exception) {
            promise.reject("E_SAVE_FAILED", error.message ?: "The file could not be saved.")
        }
    }

    /** API 29+ — MediaStore Downloads collection. */
    private fun saveViaMediaStore(source: File, displayName: String, promise: Promise) {
        val resolver = reactApplicationContext.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, displayName)
            put(MediaStore.Downloads.MIME_TYPE, "application/pdf")
            put(
                MediaStore.Downloads.RELATIVE_PATH,
                Environment.DIRECTORY_DOWNLOADS + "/" + FOLDER_NAME,
            )
            put(MediaStore.Downloads.IS_PENDING, 1)
        }

        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
        if (uri == null) {
            promise.reject("E_INSERT_FAILED", "The file could not be added to the Downloads folder.")
            return
        }

        try {
            resolver.openOutputStream(uri)?.use { output ->
                source.inputStream().use { input -> input.copyTo(output) }
            } ?: throw IllegalStateException("Could not open the destination file.")

            // Pending se actual collection me publish karo.
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, values, null, null)

            promise.resolve("Downloads/$FOLDER_NAME/$displayName")
        } catch (error: Exception) {
            // Adhoora file na rahe — record delete karo.
            resolver.delete(uri, null, null)
            promise.reject("E_WRITE_FAILED", error.message ?: "The file could not be written.")
        }
    }

    /** API 28 se neeche — classic public Downloads folder. */
    @Suppress("DEPRECATION")
    private fun saveLegacy(source: File, displayName: String, promise: Promise) {
        val hasPermission =
            reactApplicationContext.checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
        if (!hasPermission) {
            promise.reject(
                "E_PERMISSION",
                "Storage permission is required to save the file on this Android version.",
            )
            return
        }

        val folder = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
            FOLDER_NAME,
        )
        if (!folder.exists() && !folder.mkdirs()) {
            promise.reject("E_MKDIR_FAILED", "The Downloads folder could not be created.")
            return
        }

        val destination = File(folder, displayName)
        source.copyTo(destination, overwrite = true)
        promise.resolve(destination.absolutePath)
    }

    companion object {
        const val NAME = "FileSaver"

        /** Downloads ke andar SloveCare ka folder. */
        private const val FOLDER_NAME = "SloveCare"
    }
}
