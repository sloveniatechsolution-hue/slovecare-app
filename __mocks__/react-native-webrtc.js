module.exports = {
  RTCPeerConnection: jest.fn().mockImplementation(() => ({
    createOffer: jest.fn().mockResolvedValue({}),
    createAnswer: jest.fn().mockResolvedValue({}),
    setLocalDescription: jest.fn().mockResolvedValue({}),
    setRemoteDescription: jest.fn().mockResolvedValue({}),
    addIceCandidate: jest.fn().mockResolvedValue({}),
    addTrack: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })),
  RTCSessionDescription: jest.fn(),
  RTCIceCandidate: jest.fn(),
  MediaStream: jest.fn(),
  mediaDevices: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: jest.fn().mockReturnValue([]),
    }),
    enumerateDevices: jest.fn().mockResolvedValue([]),
  },
  RTCView: 'RTCView',
};
