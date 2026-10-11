/**
 * Lightweight vector icon set (feather-style) built on react-native-svg.
 * Is project me koi extra icon package nahi — sab isi file se aata hai.
 */

import React from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { colors } from '../theme/theme';

export type IconName =
  | 'home'
  | 'user'
  | 'users'
  | 'user-plus'
  | 'search'
  | 'star'
  | 'phone'
  | 'phone-call'
  | 'mail'
  | 'map-pin'
  | 'clock'
  | 'calendar'
  | 'chevron-right'
  | 'chevron-left'
  | 'chevron-down'
  | 'arrow-left'
  | 'arrow-right'
  | 'plus'
  | 'check'
  | 'check-circle'
  | 'x'
  | 'alert-triangle'
  | 'heart'
  | 'activity'
  | 'shield'
  | 'shield-check'
  | 'bell'
  | 'file-text'
  | 'filter'
  | 'eye'
  | 'eye-off'
  | 'pill'
  | 'flask'
  | 'stethoscope'
  | 'ambulance'
  | 'briefcase'
  | 'clipboard'
  | 'award'
  | 'log-out'
  | 'edit'
  | 'refresh'
  | 'info'
  | 'lock'
  | 'grid'
  | 'layers'
  | 'globe'
  | 'trending-up'
  | 'camera'
  | 'navigation'
  | 'heart-pulse'
  | 'building'
  | 'bed'
  | 'video'
  | 'message-circle'
  | 'zap'
  | 'rupee'
  | 'graduation-cap'
  | 'id'
  | 'tablet'
  | 'upload'
  /* 2026 additions — AI tab, chat aur map ke liye */
  | 'sparkles'
  | 'send'
  | 'map'
  | 'trash'
  | 'hand-heart';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const ICONS: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <Path d="M3 9.5 12 2.5l9 7V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Path d="M9 22v-9h6v9" />
    </>
  ),
  user: (
    <>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </>
  ),
  users: (
    <>
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx={9} cy={7} r={4} />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  'user-plus': (
    <>
      <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <Circle cx={9} cy={7} r={4} />
      <Line x1={19} y1={8} x2={19} y2={14} />
      <Line x1={22} y1={11} x2={16} y2={11} />
    </>
  ),
  search: (
    <>
      <Circle cx={11} cy={11} r={7} />
      <Line x1={21} y1={21} x2={16.2} y2={16.2} />
    </>
  ),
  star: <Polygon points="12 2.5 15.1 8.8 22 9.8 17 14.7 18.2 21.7 12 18.4 5.8 21.7 7 14.7 2 9.8 8.9 8.8 12 2.5" />,
  phone: (
    <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  ),
  'phone-call': (
    <>
      <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
      <Path d="M15 3a6 6 0 0 1 6 6" />
    </>
  ),
  mail: (
    <>
      <Path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <Polyline points="22,6 12,13 2,6" />
    </>
  ),
  'map-pin': (
    <>
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx={12} cy={10} r={3} />
    </>
  ),
  clock: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Polyline points="12 7 12 12 15.5 14" />
    </>
  ),
  calendar: (
    <>
      <Rect x={3} y={4.5} width={18} height={17} rx={2} />
      <Line x1={16} y1={2.5} x2={16} y2={6.5} />
      <Line x1={8} y1={2.5} x2={8} y2={6.5} />
      <Line x1={3} y1={10} x2={21} y2={10} />
    </>
  ),
  'chevron-right': <Polyline points="9 5 16 12 9 19" />,
  'chevron-left': <Polyline points="15 5 8 12 15 19" />,
  'chevron-down': <Polyline points="5 9 12 16 19 9" />,
  'arrow-left': (
    <>
      <Line x1={20} y1={12} x2={4} y2={12} />
      <Polyline points="10 6 4 12 10 18" />
    </>
  ),
  'arrow-right': (
    <>
      <Line x1={4} y1={12} x2={20} y2={12} />
      <Polyline points="14 6 20 12 14 18" />
    </>
  ),
  plus: (
    <>
      <Line x1={12} y1={5} x2={12} y2={19} />
      <Line x1={5} y1={12} x2={19} y2={12} />
    </>
  ),
  check: <Polyline points="20 6 9 17 4 12" />,
  'check-circle': (
    <>
      <Path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" />
      <Polyline points="22 4 12 14.01 9 11.01" />
    </>
  ),
  x: (
    <>
      <Line x1={18} y1={6} x2={6} y2={18} />
      <Line x1={6} y1={6} x2={18} y2={18} />
    </>
  ),
  'alert-triangle': (
    <>
      <Path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <Line x1={12} y1={9} x2={12} y2={13.5} />
      <Line x1={12} y1={17} x2={12.01} y2={17} />
    </>
  ),
  heart: (
    <Path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.7 1.1-1.1a5.5 5.5 0 0 0 0-7.8z" />
  ),
  activity: <Polyline points="22 4 13 12.5 8.5 8 2 15" />,
  shield: <Path d="M12 22s8-4 8-10V5.2L12 2 4 5.2V12c0 6 8 10 8 10z" />,
  'shield-check': (
    <>
      <Path d="M12 22s8-4 8-10V5.2L12 2 4 5.2V12c0 6 8 10 8 10z" />
      <Polyline points="8.5 12 11 14.5 15.5 9.5" />
    </>
  ),
  bell: (
    <>
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>
  ),
  'file-text': (
    <>
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Polyline points="14 2 14 8 20 8" />
      <Line x1={8.5} y1={13} x2={15.5} y2={13} />
      <Line x1={8.5} y1={17} x2={15.5} y2={17} />
      <Line x1={8.5} y1={9.5} x2={11} y2={9.5} />
    </>
  ),
  filter: <Path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z" />,
  eye: (
    <>
      <Path d="M1.5 12S5 5.5 12 5.5 22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12z" />
      <Circle cx={12} cy={12} r={3} />
    </>
  ),
  'eye-off': (
    <>
      <Path d="M17.9 17.9A10.4 10.4 0 0 1 12 19.5C5 19.5 1.5 13.5 1.5 13.5a19 19 0 0 1 5.1-5.9" />
      <Path d="M9.9 5.7A9.9 9.9 0 0 1 12 5.5c7 0 10.5 6 10.5 6a19.3 19.3 0 0 1-2.8 3.6" />
      <Line x1={9.9} y1={9.9} x2={14.2} y2={14.2} />
      <Line x1={2} y1={2} x2={22} y2={22} />
    </>
  ),
  pill: (
    <>
      <Path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7z" />
      <Line x1={8.5} y1={8.5} x2={15.5} y2={15.5} />
    </>
  ),
  flask: (
    <>
      <Path d="M9 2.5h6" />
      <Path d="M10 2.5v6.2L4.8 18a2.2 2.2 0 0 0 1.9 3.3h10.6a2.2 2.2 0 0 0 1.9-3.3L14 8.7V2.5" />
      <Path d="M7.2 14.5h9.6" />
    </>
  ),
  stethoscope: (
    <>
      <Path d="M4.8 3v5a4.8 4.8 0 0 0 9.6 0V3" />
      <Path d="M3.5 3h2.6M13.1 3h2.6" />
      <Path d="M9.6 12.8v2.4a5.2 5.2 0 0 0 10.4 0v-1.6" />
      <Circle cx={20} cy={11.4} r={2} />
    </>
  ),
  ambulance: (
    <>
      <Path d="M2 16V7a1 1 0 0 1 1-1h11v10" />
      <Path d="M14 9h3.6l3.4 3.6V16" />
      <Path d="M2 16h2.2M9.5 16h5" />
      <Circle cx={7} cy={17.5} r={2.2} />
      <Circle cx={17.5} cy={17.5} r={2.2} />
      <Line x1={7.5} y1={8.5} x2={7.5} y2={12.5} />
      <Line x1={5.5} y1={10.5} x2={9.5} y2={10.5} />
    </>
  ),
  briefcase: (
    <>
      <Rect x={2.5} y={7} width={19} height={13.5} rx={2} />
      <Path d="M16 20.5V5.5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v15" />
    </>
  ),
  clipboard: (
    <>
      <Path d="M16 4.5H18a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h2" />
      <Rect x={8} y={2.5} width={8} height={4} rx={1.2} />
      <Line x1={8.5} y1={12} x2={15.5} y2={12} />
      <Line x1={8.5} y1={16} x2={13} y2={16} />
    </>
  ),
  award: (
    <>
      <Circle cx={12} cy={9} r={6} />
      <Polyline points="8.2 14 7 22 12 19.5 17 22 15.8 14" />
    </>
  ),
  'log-out': (
    <>
      <Path d="M9.5 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4.5" />
      <Polyline points="16 17 21 12 16 7" />
      <Line x1={21} y1={12} x2={9} y2={12} />
    </>
  ),
  edit: (
    <>
      <Path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6" />
      <Path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L12 14.6l-3.6.9.9-3.6z" />
    </>
  ),
  refresh: (
    <>
      <Path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <Polyline points="21 3.5 21 9 15.5 9" />
    </>
  ),
  info: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Line x1={12} y1={11} x2={12} y2={16.5} />
      <Line x1={12} y1={7.8} x2={12.01} y2={7.8} />
    </>
  ),
  lock: (
    <>
      <Rect x={4} y={10.5} width={16} height={11} rx={2} />
      <Path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </>
  ),
  grid: (
    <>
      <Rect x={3} y={3} width={7.5} height={7.5} rx={1.5} />
      <Rect x={13.5} y={3} width={7.5} height={7.5} rx={1.5} />
      <Rect x={3} y={13.5} width={7.5} height={7.5} rx={1.5} />
      <Rect x={13.5} y={13.5} width={7.5} height={7.5} rx={1.5} />
    </>
  ),
  layers: (
    <>
      <Polygon points="12 2.5 22 8 12 13.5 2 8 12 2.5" />
      <Polyline points="2 13.5 12 19 22 13.5" />
    </>
  ),
  globe: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M3 12h18" />
      <Path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
    </>
  ),
  'trending-up': (
    <>
      <Polyline points="22 6.5 14.5 14 9.5 9 2 16.5" />
      <Polyline points="16 6.5 22 6.5 22 12.5" />
    </>
  ),
  camera: (
    <>
      <Path d="M22 18.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.6-2.5h6.8L17 7h3a2 2 0 0 1 2 2z" />
      <Circle cx={12} cy={13.2} r={3.6} />
    </>
  ),
  navigation: <Polygon points="3 11 22 2 13 21 11 13 3 11" />,
  'heart-pulse': (
    <>
      <Path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.7 1.1-1.1a5.5 5.5 0 0 0 0-7.8z" />
      <Path d="M3.5 12.5h3.2l1.6-2.6 2.4 4.6 1.7-3 1.2 1.9h4.4" />
    </>
  ),
  building: (
    <>
      <Rect x={4} y={2.5} width={16} height={19} rx={2} />
      <Path d="M9.5 21v-4.2h5V21" />
      <Line x1={8} y1={7} x2={8.01} y2={7} />
      <Line x1={12} y1={7} x2={12.01} y2={7} />
      <Line x1={16} y1={7} x2={16.01} y2={7} />
      <Line x1={8} y1={11} x2={8.01} y2={11} />
      <Line x1={12} y1={11} x2={12.01} y2={11} />
      <Line x1={16} y1={11} x2={16.01} y2={11} />
    </>
  ),
  bed: (
    <>
      <Path d="M2.5 18V7" />
      <Path d="M2.5 12.5h19V18" />
      <Path d="M21.5 15.5H22a0 0 0 0 0 0 0" />
      <Path d="M2.5 12.5a3.5 3.5 0 0 1 3.5-3.5h4a3.5 3.5 0 0 1 3.5 3.5" />
      <Circle cx={7} cy={9} r={0.4} />
      <Path d="M13.5 9h5a3 3 0 0 1 3 3v.5" />
    </>
  ),
  video: (
    <>
      <Rect x={2} y={6} width={14} height={12} rx={2.5} />
      <Polygon points="22 8.5 16 12 22 15.5 22 8.5" />
    </>
  ),
  'message-circle': (
    <Path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.9-.9L3 20.5l1.6-4.6A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />
  ),
  zap: <Polygon points="13 2.5 3.5 14 11 14 9.8 21.5 20.5 9.5 13 9.5 13 2.5" />,
  rupee: (
    <>
      <Path d="M5 4h13M5 8h13M6 4c5 0 8 1.2 8 4s-3 4-8 4h-1l9 8" />
    </>
  ),
  'graduation-cap': (
    <>
      <Path d="M22 9.5 12 4 2 9.5l10 5.5 10-5.5z" />
      <Path d="M6 11.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5" />
      <Path d="M22 9.5V15" />
    </>
  ),
  id: (
    <>
      <Rect x={2} y={5} width={20} height={14} rx={2} />
      <Circle cx={8.5} cy={11} r={2} />
      <Path d="M5 16.5c.6-1.6 2-2.5 3.5-2.5s2.9.9 3.5 2.5" />
      <Line x1={14.5} y1={9.5} x2={19} y2={9.5} />
      <Line x1={14.5} y1={13} x2={19} y2={13} />
    </>
  ),
  tablet: (
    <>
      <Rect x={4} y={2} width={16} height={20} rx={2.5} />
      <Line x1={11} y1={19} x2={11.01} y2={19} />
    </>
  ),
  upload: (
    <>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Polyline points="17 8 12 3 7 8" />
      <Line x1={12} y1={3} x2={12} y2={15} />
    </>
  ),
  sparkles: (
    <>
      <Path d="M12 3l1.9 4.7 4.7 1.8-4.7 1.8L12 16l-1.9-4.7L5.4 9.5l4.7-1.8L12 3z" />
      <Path d="M19 14.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3z" />
      <Path d="M5.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
    </>
  ),
  send: (
    <>
      <Line x1={22} y1={2} x2={11} y2={13} />
      <Polygon points="22 2 15 22 11 13 2 9 22 2" />
    </>
  ),
  map: (
    <>
      <Polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <Line x1={8} y1={2} x2={8} y2={18} />
      <Line x1={16} y1={6} x2={16} y2={22} />
    </>
  ),
  trash: (
    <>
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <Line x1={10} y1={11} x2={10} y2={17} />
      <Line x1={14} y1={11} x2={14} y2={17} />
    </>
  ),
  'hand-heart': (
    <>
      <Path d="M11.5 8.4a2.6 2.6 0 0 1 4.4-1.9 2.6 2.6 0 0 1 4.4 1.9c0 2.4-3.3 4.6-4.4 5.5-1.1-.9-4.4-3.1-4.4-5.5z" />
      <Path d="M3 13.5l3.5-2 4 1.5" />
      <Path d="M6.5 13l4.2 1.6a5 5 0 0 1 2.4 3.2l.3 1.2" />
      <Path d="M3 13.5V19a2 2 0 0 0 2 2h6.5" />
      <Path d="M16.5 16.5h4.5" />
    </>
  ),
};

export function Icon({ name, size = 20, color = colors.text, strokeWidth = 2 }: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </Svg>
  );
}

export default Icon;
