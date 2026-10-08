/**
 * react-native-video ka native module test environment me nahi chalta —
 * isliye ek lightweight View mock render karte hain.
 */
const React = require('react');
const { View } = require('react-native');

function VideoMock(props) {
  return React.createElement(View, {
    testID: props.testID,
    accessibilityElementsHidden: props.accessibilityElementsHidden,
    importantForAccessibility: props.importantForAccessibility,
  });
}

module.exports = VideoMock;
module.exports.default = VideoMock;
module.exports.Video = VideoMock;
