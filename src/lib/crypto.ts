/**
 * Simple AES-GCM encryption for temporary secure messaging.
 * Supports both random keys and passphrase-derived keys.
 */

// Helper: base64 to Uint8Array
const b64ToUint8 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
// Helper: Uint8Array to base64
const uint8ToB64 = (arr: Uint8Array) => btoa(String.fromCharCode(...arr));

export const generateKey = async (): Promise<CryptoKey> => {
    return crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
};

export const exportKey = async (key: CryptoKey): Promise<string> => {
    const exported = await crypto.subtle.exportKey("raw", key);
    return uint8ToB64(new Uint8Array(exported));
};

export const importKey = async (keyStr: string): Promise<CryptoKey> => {
    const raw = b64ToUint8(keyStr);
    return crypto.subtle.importKey(
        "raw",
        raw,
        "AES-GCM",
        true,
        ["encrypt", "decrypt"]
    );
};

/**
 * Derives an AES-GCM key from a user-provided passphrase and salt.
 */
export const deriveKey = async (passphrase: string, salt: Uint8Array): Promise<CryptoKey> => {
    const encoder = new TextEncoder();
    const passphraseKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(passphrase),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: new Uint8Array(salt),
            iterations: 100000,
            hash: "SHA-256",
        },
        passphraseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
};

export const generateSalt = () => crypto.getRandomValues(new Uint8Array(16));
export const generateIv = () => crypto.getRandomValues(new Uint8Array(12));

export const encryptMessage = async (text: string, key: CryptoKey, iv?: Uint8Array): Promise<{ ciphertext: string; iv: string }> => {
    const usedIv = iv || generateIv();
    const encoded = new TextEncoder().encode(text);

    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: new Uint8Array(usedIv) },
        key,
        encoded
    );

    return {
        ciphertext: uint8ToB64(new Uint8Array(ciphertext)),
        iv: uint8ToB64(usedIv)
    };
};

export const decryptMessage = async (ciphertext: string, iv: string, key: CryptoKey): Promise<string> => {
    const cipherBuffer = b64ToUint8(ciphertext);
    const ivBuffer = b64ToUint8(iv);

    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
        key,
        new Uint8Array(cipherBuffer)
    );

    return new TextDecoder().decode(decrypted);
};

export { b64ToUint8, uint8ToB64 };
