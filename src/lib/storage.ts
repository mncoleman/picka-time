/**
 * Simple localStorage wrapper for persisting saved secrets.
 */

export interface SavedSecret {
    id: string;
    url: string;
    note?: string;
    createdAt: number;
}

const STORAGE_KEYS = {
    SECRETS: "secretexchange_secrets",
};

export const saveSecret = (secret: SavedSecret) => {
    const secrets = getSecrets();
    const index = secrets.findIndex((s) => s.id === secret.id);
    if (index >= 0) {
        secrets[index] = secret;
    } else {
        secrets.push(secret);
    }
    localStorage.setItem(STORAGE_KEYS.SECRETS, JSON.stringify(secrets));
};

export const getSecrets = (): SavedSecret[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.SECRETS);
    return stored ? JSON.parse(stored) : [];
};

export const deleteSecret = (id: string) => {
    const secrets = getSecrets().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SECRETS, JSON.stringify(secrets));
};

export const clearAllData = () => {
    localStorage.clear();
};
