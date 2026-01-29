import LZString from "lz-string";

export const encodeData = (data: unknown): string => {
    const json = JSON.stringify(data);
    return LZString.compressToEncodedURIComponent(json);
};

export const decodeData = <T>(encoded: string): T | null => {
    try {
        const json = LZString.decompressFromEncodedURIComponent(encoded);
        return json ? (JSON.parse(json) as T) : null;
    } catch (e) {
        console.error("Failed to decode URL data", e);
        return null;
    }
};

/**
 * Generates a stable ID from a configuration object.
 */
export const generateId = async (data: unknown): Promise<string> => {
    const msgUint8 = new TextEncoder().encode(JSON.stringify(data));
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 12);
};

/**
 * Robustly gets a parameter from the URL, checking both the search string and the hash.
 * This is crucial for HashRouter compatibility.
 */
export const getParam = (name: string): string | null => {
    // 1. Check standard search params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has(name)) return urlParams.get(name);

    // 2. Check hash
    const hash = window.location.hash;
    if (!hash) return null;

    // Remove leading #
    const hashContent = hash.substring(1);

    // The hash could be /path?id=... or just id=...
    // We want to find the part that looks like query params
    const paramString = hashContent.includes("?")
        ? hashContent.split("?")[1]
        : (hashContent.includes("=") ? hashContent : "");

    if (paramString) {
        const pairs = paramString.split("&");
        for (const pair of pairs) {
            const equalIndex = pair.indexOf("=");
            if (equalIndex > 0) {
                const key = pair.substring(0, equalIndex);
                if (key === name) {
                    return decodeURIComponent(pair.substring(equalIndex + 1));
                }
            }
        }
    }

    // Fallback search for ID in the path-like part (e.g. #/chat/123)
    const segments = hashContent.split("/");
    if (name === "id" && segments.length > 2) return segments[2];

    return null;
};

export const getDataFromUrl = <T>(key: string): T | null => {
    const val = getParam(key);
    return val ? decodeData<T>(val) : null;
};
