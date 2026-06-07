export type EBSVolumeType = 'gp3' | 'gp2' | 'io1' | 'io2' | 'st1' | 'sc1';

export type EBSConfig = {
  volumeName: string;
  volumeType: EBSVolumeType;
  sizeGb: number;
  encrypted: boolean;
};
