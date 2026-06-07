export type AcmValidationMethod = 'DNS' | 'EMAIL';

export type AcmConfig = {
  certificateName: string;
  domainName: string;
  validationMethod: AcmValidationMethod;
};
