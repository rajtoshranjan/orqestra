export type GuardDutyFindingPublishingFrequency =
  | 'FIFTEEN_MINUTES'
  | 'ONE_HOUR'
  | 'SIX_HOURS';

export type GuardDutyConfig = {
  detectorName: string;
  findingPublishingFrequency: GuardDutyFindingPublishingFrequency;
};
