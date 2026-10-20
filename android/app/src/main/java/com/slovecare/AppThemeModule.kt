package com.slovecare

import android.app.Activity
import android.os.Build
import android.view.View
import android.view.WindowInsetsController
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * App ka IN-APP theme Android system bars tak sync karta hai.
 *
 * Kyun zaroori hai:
 * `AppTheme` XML theme `Theme.AppCompat.DayNight` hai — matlab native system
 * bars PHONE ke dark-mode setting follow karte hain, app ke in-app theme ko
 * nahi. Edge-to-edge ke saath nav/status bar transparent hote hain aur unke
 * icons app ke content ke upar aate hain — to phone dark + app light hone par
 * icons invisible ho jaate hain (ya phone light + app dark par vice-versa).
 *
 * Ye module un flags ko app ke ACTUAL theme ke hisaab se set karta hai, aur
 * API 29+ ka navigation-bar contrast scrim hata deta hai (wahi translucent
 * "black strip" jo Light Mode me bhi dikhta tha).
 */
class AppThemeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  /**
   * @param isDark true = dark theme (light icons), false = light theme (dark icons)
   */
  @ReactMethod
  fun setAppTheme(isDark: Boolean, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      // RN 0.80+ `ReactContextBaseJavaModule.getCurrentActivity()` deprecated
      // ho chuka hai — `reactApplicationContext.currentActivity` use karo.
      val activity: Activity? = reactApplicationContext.currentActivity
      if (activity == null) {
        promise.reject("E_NO_ACTIVITY", "Current activity is not attached.")
        return@runOnUiThread
      }
      applyTo(activity, isDark)
      promise.resolve(true)
    }
  }

  companion object {
    const val NAME = "AppTheme"

    /** Activity window ke system-bar appearance ko app theme ke hisaab se set karta hai. */
    @Suppress("DEPRECATION")
    fun applyTo(activity: Activity, isDark: Boolean) {
      val window = activity.window
      val decor = window.decorView

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val controller = window.insetsController
        if (controller != null) {
          val mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
            WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
          // Light theme -> dark icons; dark theme -> light icons.
          controller.setSystemBarsAppearance(if (isDark) 0 else mask, mask)
        }
      } else {
        var flags = decor.systemUiVisibility
        flags = if (isDark) {
          flags and View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
        } else {
          flags or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          flags = if (isDark) {
            flags and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv()
          } else {
            flags or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
          }
        }
        decor.systemUiVisibility = flags
      }

      // API 29+: transparent nav bar ka default translucent scrim hatao.
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        window.isNavigationBarContrastEnforced = false
      }
    }
  }
}
