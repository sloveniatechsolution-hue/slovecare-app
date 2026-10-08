const values = new Map();

module.exports = {
  getItem: jest.fn(key => Promise.resolve(values.get(key) ?? null)),
  setItem: jest.fn((key, value) => {
    values.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn(key => {
    values.delete(key);
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    values.clear();
    return Promise.resolve();
  }),
};
