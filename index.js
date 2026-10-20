/**
 * @format
 */

/**
 * 🚨 THEME PATCH — SABSE PEHLE.
 *
 * `src/theme/theme.ts` ka `StyleSheet.create` monkey-patch sirf tab kaam karta
 * hai jab theme.ts kisi bhi screen module se PEHLE evaluate ho. Screens
 * module-scope par `StyleSheet.create` karte hain aur colours CAPTURE kar
 * lete hain — patch baad me lagne par woh styles static reh jaati hain.
 *
 * Metro ka `inlineRequires: true` (RN default) import order badal deta hai —
 * screens ka module body app ke start me render se PEHLE chal sakta hai,
 * jabki `theme.ts` baad me load hota hai. Is liye yahan BARE import — ye
 * line hamesha sabse pehle chalti hai, chahe Metro imports ko kahan bhi
 * shift kar de. Isi wajah se dark mode me splash ke cards white reh jaate
 * the (themeIsDark false capture + static styles).
 *
 * Import order ka ho jaane par koi aur module ise tod nahi — ise hamesha
 * sabse upar rakhein.
 */
import './src/theme/theme';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
