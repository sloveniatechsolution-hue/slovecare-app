module.exports = {
  getInitStatus: jest.fn().mockResolvedValue('success'),
  speak: jest.fn(),
  stop: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};
