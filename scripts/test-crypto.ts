// Manual smoke test for token-crypto. Set ENCRYPTION_KEY first.
import {
  encryptToken,
  decryptToken,
  encryptJson,
  decryptJson,
  isEncryptedPayload,
} from "../src/lib/crypto/token-crypto";

const ct = encryptToken("hello-world-oauth-token-abc123");
console.log("ciphertext:", ct);
const rt = decryptToken(ct);
console.log("roundtrip:", rt);
if (rt !== "hello-world-oauth-token-abc123") {
  throw new Error("roundtrip mismatch");
}
console.log("isEncrypted:", isEncryptedPayload(ct));
console.log("isEncrypted (plain):", isEncryptedPayload("hello"));
const j = encryptJson({ access_token: "aaa", refresh_token: "bbb", expires_at: 1234 });
console.log("json ct:", j);
console.log("json roundtrip:", JSON.stringify(decryptJson(j)));
console.log("OK");
