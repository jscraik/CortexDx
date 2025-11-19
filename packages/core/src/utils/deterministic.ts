import { createHash } from "node:crypto";

/**
 * Create a deterministic 32-bit seed from an arbitrary string namespace + key.
 */
export function createDeterministicSeed(key: string, namespace = "cortexdx"): number {
    const hash = createHash("sha256").update(namespace).update(key).digest();
    return hash.readUInt32BE(0);
}
