export type EFSAccessPoint = {
  id: string;
  name: string;
  path: string;
};

export type EFSConfig = {
  creationToken: string;
  encrypted: boolean;
  performanceMode: 'generalPurpose' | 'maxIO';
  throughputMode: 'bursting' | 'provisioned' | 'elastic';
  provisionedThroughputInMibps?: number;
  accessPoints: EFSAccessPoint[];
};
