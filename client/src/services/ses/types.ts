export type SesIdentityType = 'EmailAddress' | 'Domain';

export type SesConfig = {
  identityName: string;
  identityType: SesIdentityType;
  mailFromDomain: string;
};
