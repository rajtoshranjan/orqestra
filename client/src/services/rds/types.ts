export type RDSEngine =
  | 'mysql'
  | 'postgres'
  | 'aurora-mysql'
  | 'aurora-postgres'
  | 'oracle-se2';

export type RDSConfig = {
  instanceIdentifier: string;
  engine: RDSEngine;
  instanceClass: string;
  allocatedStorage: number;
  multiAz: boolean;
};
