/**
 * NearbyMap — homepage ka "care nearby" map.
 *
 * - Filter chips: Doctors (default) / Compounders / Labs / Care Takers
 * - Data: GET /api/v1/doctors?type=&lat=&lng=&radiusKm= (verified staff + labs)
 * - Location: @react-native-community/geolocation (permission se), warna Jaipur default
 * - Map: **MapLibre + OpenStreetMap tiles** — wahi stack jo web app me hai.
 *   Koi API key / billing nahi chahiye (Google Maps key ki zaroorat nahi).
 *   Native module build na ho to yeh component gracefully list-mode me chala
 *   jaata hai (crash nahi hota).
 *
 * Marker tap → neeche provider card → "View profile" → onSelect(vendor).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  CameraRef,
  InitialViewState,
  LngLatBounds,
  StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { staffLabel, visitFee, VerificationBadge, photoUrl, initialsOf } from './DoctorCard';
import Icon, { IconName } from './Icon';
import { AppButton, Chip, Loader, Rating } from './UI';
import api, { Doctor, VendorType } from '../api/api';
import { locationHelpAlert, requestLocation } from '../utils/location';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';
import { useThemePreference } from '../theme/ThemeContext';

type MapLibreModule = typeof import('@maplibre/maplibre-react-native');

/**
 * Native module ka import runtime par ho, try/catch ke andar — purane builds
 * (jisme yeh module abhi linked nahi hai) crash na karein, list fallback chale.
 */
const MAPLIBRE: MapLibreModule | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@maplibre/maplibre-react-native') as MapLibreModule;
  } catch {
    return null;
  }
})();

const MapLibreMap = MAPLIBRE?.Map ?? null;
const MapLibreCamera = MAPLIBRE?.Camera ?? null;
const MapLibreMarker = MAPLIBRE?.Marker ?? null;
const hasNativeMap = Boolean(MapLibreMap && MapLibreCamera && MapLibreMarker);

/** OSM raster style — web app wale `tile.openstreetmap.org` tiles, key-less. */
const OSM_STYLE: StyleSpecification = {
  version: 8,
  name: 'SloveCare OSM',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

type FilterKey = VendorType;

interface FilterDef {
  key: FilterKey;
  label: string;
  icon: IconName;
}

const FILTERS: FilterDef[] = [
  { key: 'doctor', label: 'Doctors', icon: 'stethoscope' },
  { key: 'compounder', label: 'Compounders', icon: 'heart-pulse' },
  { key: 'lab', label: 'Labs', icon: 'flask' },
  { key: 'caretaker', label: 'Care Takers', icon: 'users' },
];

/** Jaipur fallback — permission na mile tab bhi map khaali na dikhe. */
const FALLBACK_REGION = { latitude: 26.9124, longitude: 75.7873 };

const RADIUS_KM = 25;

export interface NearbyMapProps {
  /** Marker / card par tap → doctor detail screen kholega. */
  onSelect: (provider: Doctor) => void;
  /** Filter chip change — parent (HomeScreen) ko taaki "Available for Booking" sync ho. */
  onFilterChange?: (type: FilterKey) => void;
}

export default function NearbyMap({ onSelect, onFilterChange }: NearbyMapProps): React.JSX.Element {
  useThemePreference();
  const [filter, setFilter] = useState<FilterKey>('doctor');
  const [providers, setProviders] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cameraRef = useRef<CameraRef | null>(null);
  /** Marker tap ke baad map ka onPress fire na ho (selection turant clear na ho). */
  const markerPressedAt = useRef(0);

  const load = useCallback(
    async (type: FilterKey, location: { lat: number; lng: number } | null) => {
      setLoading(true);
      try {
        const list = await api.doctors.list({
          type,
          lat: location?.lat,
          lng: location?.lng,
          radiusKm: RADIUS_KM,
        });
        setProviders(list.slice(0, 30));
        setSelectedId(null);
      } catch {
        setProviders([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /* Location sirf ek baar (mount par) — permission round-trip ke baad
     `locResolved` set hota hai. */
  const [locResolved, setLocResolved] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loc = await requestLocation();
      if (cancelled) {
        return;
      }
      setCoords(loc);
      setLocResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Data load: filter ya location (detect / "Near me") badle to refresh. */
  useEffect(() => {
    if (!locResolved) {
      return;
    }
    let cancelled = false;
    (async () => {
      if (cancelled) {
        return;
      }
      await load(filter, coords);
    })();
    return () => {
      cancelled = true;
    };
  }, [locResolved, filter, coords, load]);

  const locateMe = async () => {
    setDetecting(true);
    const loc = await requestLocation();
    setDetecting(false);
    if (loc) {
      setCoords(loc);
      cameraRef.current?.flyTo({
        center: [loc.lng, loc.lat],
        zoom: 13.5,
        duration: 450,
      });
    } else {
      locationHelpAlert();
    }
  };

  /** Saare markers fit ho jaayein — bade area par zoom out, chhote par zoom in. */
  const bounds = useMemo<LngLatBounds | null>(() => {
    const points = providers
      .map(p => ({ lat: Number(p.latitude), lng: Number(p.longitude) }))
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    const center = coords ?? { lat: FALLBACK_REGION.latitude, lng: FALLBACK_REGION.longitude };

    if (points.length === 0) {
      return null;
    }
    const lats = [...points.map(p => p.lat), center.lat];
    const lngs = [...points.map(p => p.lng), center.lng];
    const pad = 0.004; // taaki marker kinare par na kate
    return [
      Math.min(...lngs) - pad,
      Math.min(...lats) - pad,
      Math.max(...lngs) + pad,
      Math.max(...lats) + pad,
    ];
  }, [providers, coords]);

  const boundsKey = bounds ? bounds.map(n => n.toFixed(4)).join(',') : '';
  const lastFitKey = useRef('');

  /* Filter/location badalte hi naye markers fit karo. */
  useEffect(() => {
    if (!boundsKey || !bounds || !cameraRef.current || lastFitKey.current === boundsKey) {
      return;
    }
    lastFitKey.current = boundsKey;
    cameraRef.current.fitBounds(bounds, {
      padding: { top: 24, right: 24, bottom: 24, left: 24 },
      duration: 600,
    });
  }, [bounds, boundsKey]);

  /* Providers na milein to user/location par hi zoom in. */
  useEffect(() => {
    if (boundsKey || !coords || !cameraRef.current) {
      return;
    }
    cameraRef.current.flyTo({ center: [coords.lng, coords.lat], zoom: 13, duration: 500 });
  }, [boundsKey, coords]);

  /* Camera ka starting point (mount par ek baar). Data/location aate hi
     upar wale effects fitBounds/flyTo se actual area par le jaate hain. */
  const initialView = useMemo<InitialViewState>(
    () => ({ center: [FALLBACK_REGION.longitude, FALLBACK_REGION.latitude], zoom: 12.4 }),
    [],
  );

  const selected = useMemo(() => providers.find(p => p.id === selectedId) ?? null, [providers, selectedId]);

  const withCoords = useMemo(
    () =>
      providers.filter(
        p => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)),
      ),
    [providers],
  );

  const handleMapPress = () => {
    if (Date.now() - markerPressedAt.current < 700) {
      return;
    }
    setSelectedId(null);
  };

  /** Marker/child tap — timestamp guard taaki map ka onPress selection clear na kare. */
  const selectProvider = (id: string) => {
    markerPressedAt.current = Date.now();
    setSelectedId(id);
  };

  return (
    <View>
      {/* Filter chips */}
      <View style={styles.chipRow}>
        {FILTERS.map(f => (
          <Chip
            key={f.key}
            label={f.label}
            icon={f.icon}
            active={filter === f.key}
            onPress={() => {
              if (filter !== f.key) {
                setFilter(f.key);
                onFilterChange?.(f.key);
              }
            }}
          />
        ))}
      </View>

      {/* Map / fallback */}
      {loading && providers.length === 0 ? (
        <View style={[styles.mapBox, styles.centerBox]}>
          <Loader label="Finding care near you…" />
        </View>
      ) : hasNativeMap && MapLibreMap && MapLibreCamera && MapLibreMarker ? (
        <View style={styles.mapBox}>
          <MapLibreMap
            mapStyle={OSM_STYLE}
            style={StyleSheet.absoluteFill}
            onPress={handleMapPress}
            compassPosition={{ top: 10, right: 10 }}
            attributionPosition={{ bottom: 6, left: 8 }}
            logoPosition={{ bottom: 6, left: 8 }}
          >
            <MapLibreCamera ref={cameraRef} initialViewState={initialView} maxZoom={17} />
            {withCoords.map(p => {
              const active = p.id === selectedId;
              return (
                <MapLibreMarker
                  key={p.id}
                  id={p.id}
                  lngLat={[Number(p.longitude), Number(p.latitude)]}
                  onPress={() => selectProvider(p.id)}
                >
                  <Pressable
                    onPress={() => selectProvider(p.id)}
                    hitSlop={10}
                    style={[styles.pin, active && styles.pinActive]}
                  >
                    <Icon
                      name={filter === 'lab' ? 'flask' : filter === 'caretaker' ? 'users' : 'stethoscope'}
                      size={13}
                      color={active ? colors.textInverse : colors.blue}
                    />
                  </Pressable>
                </MapLibreMarker>
              );
            })}
          </MapLibreMap>

          {/* Locate me */}
          <Pressable
            onPress={locateMe}
            style={({ pressed }) => [styles.locateBtn, pressed && { opacity: 0.85 }]}
            accessibilityLabel="Locate me"
          >
            <Icon name="navigation" size={16} color={colors.blue} />
            <Text style={styles.locateText}>{detecting ? 'Locating…' : 'Near me'}</Text>
          </Pressable>

          {providers.length === 0 ? (
            <View style={styles.noResult} pointerEvents="none">
              <Text style={[typography.small, { textAlign: 'center' }]}>
                No verified {FILTERS.find(f => f.key === filter)?.label.toLowerCase()} within {RADIUS_KM} km.
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        /* MapLibre native module abhi build nahi hai — list mode fallback */
        <View style={[styles.mapBox, styles.listMode]}>
          <View style={styles.fallbackNote}>
            <Icon name="map-pin" size={14} color={colors.blue} />
            <Text style={typography.caption}>
              Map view appears after the app rebuild — showing the same nearby list.
            </Text>
          </View>
          {withCoords.slice(0, 4).map(p => {
            const photo = photoUrl(p.avatar);
            return (
              <Pressable key={p.id} style={styles.fallbackRow} onPress={() => onSelect(p)}>
                <View style={styles.fallbackIcon}>
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.fallbackPhoto} resizeMode="cover" />
                  ) : (
                    <Icon name="stethoscope" size={15} color={colors.blue} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.smallMedium} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={typography.caption} numberOfLines={1}>
                    {staffLabel(p)}
                    {typeof p.calculatedDistance === 'number' ? ` • ${p.calculatedDistance} km` : ''}
                  </Text>
                </View>
                <Icon name="chevron-right" size={16} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Selected provider card */}
      {selected ? (
        <View style={styles.providerCard}>
          <View style={styles.providerTop}>
            <View style={styles.providerAvatar}>
              {(() => {
                const photo = photoUrl(selected.avatar);
                if (photo) {
                  return (
                    <Image
                      source={{ uri: photo }}
                      style={styles.providerPhoto}
                      resizeMode="cover"
                    />
                  );
                }
                return (
                  <View style={[styles.providerPhoto, styles.initialsBox]}>
                    <Text style={styles.initialsText}>{initialsOf(selected.name) || '?'}</Text>
                  </View>
                );
              })()}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.h4} numberOfLines={1}>
                {selected.name}
              </Text>
              <Text style={[typography.small, { marginTop: 1 }]} numberOfLines={1}>
                {staffLabel(selected)}
              </Text>
            </View>
            <VerificationBadge doctor={selected} />
          </View>

          <View style={styles.providerMeta}>
            <Rating value={Number(selected.rating) || 0} count={selected.reviewCount ?? 0} size={13} />
            {typeof selected.calculatedDistance === 'number' ? (
              <View style={styles.metaItem}>
                <Icon name="map-pin" size={13} color={colors.textMuted} />
                <Text style={typography.caption}>{selected.calculatedDistance} km away</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Icon name="rupee" size={13} color={colors.textMuted} />
              <Text style={typography.caption}>₹{visitFee(selected)} /visit</Text>
            </View>
          </View>

          <View style={styles.providerActions}>
            <AppButton
              label="View profile"
              icon="arrow-right"
              size="sm"
              full={false}
              style={{ flex: 1 }}
              onPress={() => onSelect(selected)}
            />
            <AppButton
              label="Close"
              variant="outline"
              size="sm"
              full={false}
              onPress={() => setSelectedId(null)}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  mapBox: {
    height: 180,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardMuted,
    overflow: 'hidden',
    ...shadow.card,
  },
  centerBox: { alignItems: 'center', justifyContent: 'center' },
  listMode: { padding: spacing.md, gap: spacing.sm },
  fallbackNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  fallbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  fallbackIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#EAF1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackPhoto: { width: '100%', height: '100%' },
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.card,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  pinActive: { backgroundColor: colors.blue, borderColor: colors.textInverse },
  locateBtn: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    ...shadow.card,
  },
  locateText: { ...typography.caption, color: colors.blue, fontWeight: '700' },
  noResult: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    backgroundColor: colors.cardOverlay,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    maxWidth: '86%',
    ...shadow.sm,
  },
  providerCard: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  providerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  providerAvatar: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.primaryLight,
  },
  providerPhoto: { width: '100%', height: '100%' },
  initialsBox: { alignItems: 'center', justifyContent: 'center' },
  initialsText: { ...typography.h4, color: colors.primaryDark },
  providerMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  providerActions: { flexDirection: 'row', gap: spacing.sm },
});
