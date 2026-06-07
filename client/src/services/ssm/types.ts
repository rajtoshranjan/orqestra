export type SsmParameterType = 'String' | 'StringList' | 'SecureString';

export type SsmParameterTier = 'Standard' | 'Advanced' | 'Intelligent-Tiering';

export type SsmConfig = {
  parameterName: string;
  parameterType: SsmParameterType;
  tier: SsmParameterTier;
};
