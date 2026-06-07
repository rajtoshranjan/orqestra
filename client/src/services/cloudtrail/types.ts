export type CloudTrailManagementEvents = 'ReadOnly' | 'WriteOnly' | 'All';

export type CloudTrailConfig = {
  trailName: string;
  destinationBucketName: string;
  managementEvents: CloudTrailManagementEvents;
};
