import { Buffer } from 'buffer';

// Provide browser polyfills expected by amazon-cognito-identity-js.
if (!(globalThis as any).global) {
  (globalThis as any).global = globalThis;
}
if (!(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}
