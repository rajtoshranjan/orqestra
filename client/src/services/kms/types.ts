export type KMSKeyUsage = 'ENCRYPT_DECRYPT' | 'SIGN_VERIFY';

export type KMSConfig = {
  keyAlias: string;
  description: string;
  keyUsage: KMSKeyUsage;
  multiRegion: boolean;
};
