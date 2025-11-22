// Mock uuid module to avoid ESM issues in Jest
export const v1 = jest.fn(() => 'c8cc50c0-8be0-11ef-a1e2-0242ac120002');
export const v4 = jest.fn(() => 'c8cc50c0-8be0-11ef-a1e2-0242ac120002');
