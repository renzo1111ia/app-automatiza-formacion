# E2E-260603-001-LOW — Test flaky: token-crypto authTag tamper no-determinista

- **Severity**: LOW (test frágil, NO bug de seguridad)
- **Fase**: 03 (suite Vitest backend)
- **Estado**: 🟢 CERRADO in-session
- **Archivo**: `tests/unit/crypto/token-crypto.test.ts:60`

## Síntoma

`decryptToken falla con authTag manipulado (autenticacion GCM)` fallaba intermitentemente (~1/16 ejecuciones):

```
AssertionError: expected [Function] to throw an error
```

## Causa raíz

La manipulación del authTag usaba `parts[2].replace(/^[0-9a-f]/, "0")` — reemplazo fijo a `"0"`.
Cuando el primer nibble hex del authTag ya era `0` (probabilidad 1/16, aleatorio por IV/cifrado distinto cada run), el replace era **no-op** → authTag sin cambios → `decryptToken` tenía éxito → `toThrow()` no se cumplía.

**NO es vulnerabilidad**: `src/lib/crypto/token-crypto.ts` usa AES-256-GCM con `decipher.setAuthTag()` + `decipher.final()`, que lanza correctamente al detectar tampering. El roundtrip y la validación GCM son correctos. El fallo era exclusivamente del test.

## Fix

Flip determinista de 1 nibble vía XOR (`firstNibble ^ 0x1`), garantiza que el byte SIEMPRE cambia:

```ts
const firstNibble = parseInt(parts[2][0], 16);
const flipped = (firstNibble ^ 0x1).toString(16);
const tampered = flipped + parts[2].slice(1);
```

## Verificación

10/10 ejecuciones consecutivas verde (antes flaky ~1/16). Suite crypto 8/8.
