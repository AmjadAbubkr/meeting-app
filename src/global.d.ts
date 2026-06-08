declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function beforeEach(fn: () => void): void;
declare function beforeAll(fn: () => void): void;
declare function afterAll(fn: () => void): void;
declare function expect(value: unknown): any;
declare const jest: {
  fn: () => any;
  fn<T>(implementation?: (...args: any[]) => T): any;
  clearAllMocks(): void;
  mock(moduleName: string, factory: () => any, options?: any): void;
};
