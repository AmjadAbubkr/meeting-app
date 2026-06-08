export default {
  fetch: jest.fn().mockResolvedValue({ isConnected: true, type: 'wifi' } as any),
  addEventListener: jest.fn(),
};
