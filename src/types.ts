export type Vector3 = [number, number, number];

export interface VolumeData {
  dimensions: Vector3; // [nx, ny, nz]
  spacing: Vector3; // [sx, sy, sz]
  origin: Vector3; // [ox, oy, oz]
  scalarData: Float32Array | Uint8Array | Uint16Array | Int16Array | Int32Array | Float64Array;
  scalarMin?: number;
  scalarMax?: number;
}

export interface LoadedNifti {
  header: any;
  data: VolumeData;
}

export interface SegmentationInfo {
  isProbabilistic: boolean;
  uniqueLabels: number[]; // for discrete labels (excluding 0)
}

export interface CameraPose {
  position: Vector3;
  focalPoint: Vector3;
  viewUp: Vector3;
  viewAngle: number; // degrees
}

export interface Keyframe {
  timeSec: number; // timeline time in seconds
  camera: CameraPose;
  sliceIndex: number;
}


