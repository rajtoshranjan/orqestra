export type FSxFileSystemType = 'WINDOWS' | 'LUSTRE' | 'NETAPP_ONTAP' | 'OPENZFS';

export type FSxConfig = {
  fileSystemName: string;
  fileSystemType: FSxFileSystemType;
  storageCapacityGb: number;
};
