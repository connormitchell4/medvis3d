import * as nifti from 'nifti-reader-js';
import pako from 'pako';
import type { LoadedNifti, VolumeData } from '../types';

export async function loadNiftiFromFile(file: File): Promise<LoadedNifti> {
  const arrayBuffer = await file.arrayBuffer();
  let raw: ArrayBuffer;
  if (nifti.isCompressed(arrayBuffer)) {
    const decompressed = pako.inflate(new Uint8Array(arrayBuffer)).buffer as ArrayBuffer;
    raw = decompressed;
  } else {
    raw = arrayBuffer;
  }

  if (!nifti.isNIFTI(raw)) {
    throw new Error('File is not a valid NIFTI');
  }

  const header = nifti.readHeader(raw);
  const imageData = nifti.readImage(header, raw);

  // Use dim as reported; final scalars are in native data order (x fastest)
  const dims: [number, number, number] = [
    Number(header.dims[1] || 1),
    Number(header.dims[2] || 1),
    Number(header.dims[3] || 1),
  ];
  const spacing: [number, number, number] = [
    Number(header.pixDims[1] || 1),
    Number(header.pixDims[2] || 1),
    Number(header.pixDims[3] || 1),
  ];

  const origin: [number, number, number] = [
    // Many files are 0 origin; we ignore qform/sform for simplicity
    (header as any).qoffset_x ?? 0,
    (header as any).qoffset_y ?? 0,
    (header as any).qoffset_z ?? 0,
  ];

  let scalarData = niftiToTypedArray(header, imageData);
  // Apply NIfTI scaling if present (scl_slope / scl_inter)
  const slope = (header as any).scl_slope ?? 1;
  const inter = (header as any).scl_inter ?? 0;
  if (slope !== 1 || inter !== 0) {
    const out = new Float32Array(scalarData.length);
    for (let i = 0; i < scalarData.length; i += 1) {
      out[i] = (scalarData[i] as number) * slope + inter;
    }
    scalarData = out;
  }

  const volumeData: VolumeData = {
    dimensions: dims,
    spacing,
    origin,
    scalarData,
  };

  // Compute simple min/max
  const [min, max] = computeMinMax(scalarData);
  volumeData.scalarMin = min;
  volumeData.scalarMax = max;

  return { header, data: volumeData };
}

function niftiToTypedArray(header: any, imageData: ArrayBuffer): any {
  const dtype = header.datatypeCode;
  // nifti1 codes: 2=uint8, 4=int16, 8=int32, 16=float32, 64=float64, 256=int8, 512=uint16, 768=uint32
  switch (dtype) {
    case nifti.NIFTI1.TYPE_UINT8:
      return new Uint8Array(imageData);
    case nifti.NIFTI1.TYPE_INT16:
      return new Int16Array(imageData);
    case nifti.NIFTI1.TYPE_INT32:
      return new Int32Array(imageData);
    case nifti.NIFTI1.TYPE_FLOAT32:
      return new Float32Array(imageData);
    case nifti.NIFTI1.TYPE_FLOAT64:
      return new Float64Array(imageData);
    case nifti.NIFTI1.TYPE_INT8:
      return new Int8Array(imageData);
    case nifti.NIFTI1.TYPE_UINT16:
      return new Uint16Array(imageData);
    case nifti.NIFTI1.TYPE_UINT32:
      return new Uint32Array(imageData);
    default:
      // Fallback to Float32
      return new Float32Array(imageData);
  }
}

export function computeMinMax(array: ArrayLike<number>): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < array.length; i += 1) {
    const v = array[i] as number;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

export function extractUniqueLabels(
  array: ArrayLike<number>,
  excludeZero = true,
  maxUnique = 256,
): number[] {
  const set = new Set<number>();
  for (let i = 0; i < array.length; i += 1) {
    const v = Math.round(array[i] as number);
    if (excludeZero && v === 0) continue;
    set.add(v);
    if (set.size > maxUnique) break;
  }
  return Array.from(set).sort((a, b) => a - b);
}

export function buildBinaryMask(
  labelsArray: ArrayLike<number>,
  selectedLabels: Set<number>,
): Float32Array {
  const out = new Float32Array(labelsArray.length);
  for (let i = 0; i < labelsArray.length; i += 1) {
    const v = Math.round(labelsArray[i] as number);
    out[i] = selectedLabels.has(v) ? 1 : 0;
  }
  return out;
}

export function clamp01Array(array: ArrayLike<number>): Float32Array {
  const out = new Float32Array(array.length);
  for (let i = 0; i < array.length; i += 1) {
    let v = array[i] as number;
    if (Number.isNaN(v) || !Number.isFinite(v)) v = 0;
    // If values look like 0..255 bytes, normalize to 0..1
    // Heuristic: detect integer-like with small range, otherwise trust original
    if (v > 1 && v <= 255 && Number.isInteger(v)) {
      v = v / 255;
    }
    if (v < 0) v = 0;
    if (v > 1) v = 1;
    out[i] = v;
  }
  return out;
}


