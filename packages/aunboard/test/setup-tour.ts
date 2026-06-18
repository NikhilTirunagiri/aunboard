import { vi } from "vitest";

// Node 25 ships a built-in localStorage that lacks .clear()/.setItem()/.removeItem().
// jsdom's populateGlobal won't override keys already present in the global (unless they're
// in its explicit allowlist). Stub the full Storage interface so tour persistence tests work.
const store: Record<string, string> = {};
const mockStorage: Storage = {
  get length() {
    return Object.keys(store).length;
  },
  key(index: number) {
    return Object.keys(store)[index] ?? null;
  },
  getItem(key: string) {
    return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
  },
  setItem(key: string, value: string) {
    store[key] = String(value);
  },
  removeItem(key: string) {
    delete store[key];
  },
  clear() {
    for (const key of Object.keys(store)) delete store[key];
  },
};

vi.stubGlobal("localStorage", mockStorage);
