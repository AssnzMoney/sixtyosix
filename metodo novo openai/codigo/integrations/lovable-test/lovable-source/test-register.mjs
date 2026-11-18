// node --experimental-strip-types --import ./integrations/lovable-test/lovable-source/test-register.mjs --test ...
import { register } from 'node:module'

register('./test-hooks.mjs', import.meta.url)
