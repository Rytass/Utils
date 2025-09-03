/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-undef */

// jest.setup.ts
import { TextEncoder, TextDecoder } from 'util';

(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;
