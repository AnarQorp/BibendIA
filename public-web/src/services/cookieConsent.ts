export interface StorageNoticeAcknowledgement {
  acknowledged: true;
  timestamp: string;
}

const STORAGE_KEY = 'bibendia_storage_notice_v1';
export const CONSENT_UPDATED_EVENT = 'bibendia_storage_notice_updated';

export function getStoredCookieConsent(): StorageNoticeAcknowledgement | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StorageNoticeAcknowledgement>;
    if (parsed.acknowledged === true && typeof parsed.timestamp === 'string') {
      return { acknowledged: true, timestamp: parsed.timestamp };
    }
    return null;
  } catch {
    return null;
  }
}

export function acknowledgeStorageNotice(): StorageNoticeAcknowledgement {
  const acknowledgement: StorageNoticeAcknowledgement = {
    acknowledged: true,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(acknowledgement));
      window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, { detail: acknowledgement }));
    } catch (error) {
      console.warn('No se pudo recordar el aviso de almacenamiento local:', error);
    }
  }

  return acknowledgement;
}
