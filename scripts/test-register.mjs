// node --experimental-strip-types --import ./scripts/test-register.mjs --test server/*.test.ts
import { register } from 'node:module'

register('./ts-resolve.mjs', import.meta.url)
