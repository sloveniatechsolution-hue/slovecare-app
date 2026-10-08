/**
 * react-native-webview ka native module (RNCWebViewModule) test environment
 * me nahi milta — isliye lightweight View mock render karte hain
 * (react-native-video mock jaisa hi).
 */
const React = require('react');
const { View } = require('react-native');

function WebViewMock(props) {
  return React.createElement(View, { testID: props.testID || 'mock-webview' });
}

module.exports = WebViewMock;
module.exports.default = WebViewMock;
module.exports.WebView = WebViewMock;
