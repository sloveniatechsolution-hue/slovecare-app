/**
 * NearbyMap (MapLibre) ka interaction test:
 *  - providers load hote hi markers render
 *  - marker press → provider card dikhta hai ("View profile")
 *  - "View profile" → onSelect(provider) call hota hai (booking entry point)
 *  - map ka onPress (khaali tap) → card dismiss
 *
 * MapLibre native module ko yahan mock kiya gaya hai — ye test JS layer ka
 * behaviour verify karta hai (native module ke bina bhi chalta hai).
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

jest.mock('@maplibre/maplibre-react-native', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');

  const Map = (props: Record<string, unknown>) =>
    ReactLib.createElement(View, { testID: 'ml-map', onPress: props.onPress }, props.children);
  const Camera = () => ReactLib.createElement(View, { testID: 'ml-camera' });
  const Marker = (props: { id?: string; onPress?: () => void; children?: unknown }) =>
    ReactLib.createElement(
      View,
      { testID: `ml-marker-${props.id}`, onPress: props.onPress },
      props.children,
    );

  return { Map, Camera, Marker };
});

jest.mock('../src/api/api', () => {
  const providers = [
    {
      id: 'doc-1',
      name: 'Dr Asha Verma',
      type: 'doctor',
      specialty: 'General Physician',
      rating: 4.8,
      reviewCount: 12,
      experience: 6,
      latitude: 26.9124,
      longitude: 75.7873,
      visitFee: 300,
      verificationStatus: 'verified',
    },
    {
      id: 'doc-2',
      name: 'Dr Rohan Mehta',
      type: 'doctor',
      specialty: 'Pediatrician',
      rating: 4.5,
      reviewCount: 8,
      experience: 4,
      latitude: 26.92,
      longitude: 75.79,
      visitFee: 250,
      verificationStatus: 'verified',
    },
  ];
  return {
    __esModule: true,
    default: { doctors: { list: jest.fn().mockResolvedValue(providers) } },
  };
});

import NearbyMap from '../src/components/NearbyMap';
import api from '../src/api/api';

type Tree = ReactTestRenderer.ReactTestRenderer;

/** Async effects + API promise ko flush karne ke liye. */
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Children tree ko plain text me badalta hai (arrays/numbers samet). */
function textOf(children: unknown): string {
  if (typeof children === 'string') {
    return children;
  }
  if (typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(textOf).join('');
  }
  return '';
}

function findAllByText(root: ReactTestRenderer.ReactTestInstance, text: string) {
  return root.findAll(n => textOf(n.props.children) === text);
}

/** Text wale node se upar chadhkar uska onPress-holding Pressable dhoondta hai. */
function findPressableByText(
  root: ReactTestRenderer.ReactTestInstance,
  text: string,
): ReactTestRenderer.ReactTestInstance | null {
  for (const hit of findAllByText(root, text)) {
    let node: ReactTestRenderer.ReactTestInstance | null = hit;
    while (node) {
      if (typeof node.props?.onPress === 'function') {
        return node;
      }
      node = node.parent;
    }
  }
  return null;
}

describe('NearbyMap', () => {
  it('marker tap se provider card khulta hai aur View profile onSelect call karta hai', async () => {
    const onSelect = jest.fn();
    let tree!: Tree;

    await act(async () => {
      tree = ReactTestRenderer.create(<NearbyMap onSelect={onSelect} />);
    });
    await flush();

    // Data load hone ke baad markers render
    expect(tree.root.findByProps({ testID: 'ml-marker-doc-1' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'ml-marker-doc-2' })).toBeTruthy();

    // Abhi koi card nahi
    expect(findAllByText(tree.root, 'View profile')).toHaveLength(0);

    // Marker tap → card
    await act(async () => {
      tree.root.findByProps({ testID: 'ml-marker-doc-1' }).props.onPress();
    });
    expect(findAllByText(tree.root, 'View profile').length).toBeGreaterThan(0);
    expect(findAllByText(tree.root, 'Dr Asha Verma').length).toBeGreaterThan(0);

    // View profile → doctor detail screen ka entry point (onSelect)
    const viewProfile = findPressableByText(tree.root, 'View profile');
    expect(viewProfile).not.toBeNull();
    await act(async () => {
      viewProfile!.props.onPress();
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ id: 'doc-1' });

    // Marker press ke turant baad ka map tap card ko hilna NAHI chahiye
    // (guard: Android me marker + map dono onPress dispatch karte hain)
    await act(async () => {
      tree.root.findByProps({ testID: 'ml-map' }).props.onPress();
    });
    expect(findAllByText(tree.root, 'View profile').length).toBeGreaterThan(0);

    // Guard window (700ms) khatam hone ke baad map par khaali tap → card dismiss
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 760));
    });
    await act(async () => {
      tree.root.findByProps({ testID: 'ml-map' }).props.onPress();
    });
    expect(findAllByText(tree.root, 'View profile')).toHaveLength(0);
  });

  it('data na aane par "no results" fallback state dikhti hai', async () => {
    (api.doctors.list as jest.Mock).mockResolvedValueOnce([]);
    let tree!: Tree;

    await act(async () => {
      tree = ReactTestRenderer.create(<NearbyMap onSelect={jest.fn()} />);
    });
    await flush();

    const texts = tree.root.findAll(n =>
      /No verified doctors within 25 km/i.test(textOf(n.props.children)),
    );
    expect(texts.length).toBeGreaterThan(0);
    expect(() => tree.root.findByProps({ testID: 'ml-marker-doc-1' })).toThrow();
  });
});
