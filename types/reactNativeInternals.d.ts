/**
 * Ambient types for React Native internals used by
 * `__tests__/rnStyleDiff.test.ts`.
 *
 * RN ka style diff (`diff`) aur `ReactNativeStyleAttributes` public API me
 * export nahi hote, lekin wohi woh exact machinery hain jahan theme-switch
 * ka stale-style bug tha — isliye regression test seedha inhe drive karta hai.
 */
declare module 'react-native/Libraries/ReactNative/ReactFabricPublicInstance/ReactNativeAttributePayload' {
  export function diff(
    prevProps: Record<string, unknown>,
    nextProps: Record<string, unknown>,
    validAttributes: Record<string, unknown>,
  ): Record<string, unknown> | null | undefined;
}

declare module 'react-native/Libraries/Components/View/ReactNativeStyleAttributes' {
  const ReactNativeStyleAttributes: Record<string, unknown>;
  export default ReactNativeStyleAttributes;
}
