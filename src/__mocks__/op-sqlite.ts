export const open = jest.fn().mockReturnValue({
  execute: jest.fn().mockReturnValue({ rows: [] }),
  executeSync: jest.fn().mockReturnValue({ rows: [] }),
  close: jest.fn(),
});
