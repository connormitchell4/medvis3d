import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';

import type { VolumeData } from '../types';

export function createVtkImageFromVolume(data: VolumeData) {
  const imageData = vtkImageData.newInstance();

  const [nx, ny, nz] = data.dimensions;
  const [sx, sy, sz] = data.spacing;
  const [ox, oy, oz] = data.origin;

  imageData.setDimensions([nx, ny, nz]);
  imageData.setSpacing([sx, sy, sz]);
  imageData.setOrigin([ox, oy, oz]);

  const values = data.scalarData;

  const dataArray = vtkDataArray.newInstance({
    name: 'Scalars',
    values,
    numberOfComponents: 1,
  });

  imageData.getPointData().setScalars(dataArray);

  return imageData;
}


export function downsampleImageData(
  input: vtkImageData,
  factors: [number, number, number] = [2, 2, 2],
  mode: 'average' | 'mode' = 'average',
): vtkImageData {
  const [nx, ny, nz] = input.getDimensions();
  const [sx, sy, sz] = input.getSpacing();
  const [ox, oy, oz] = input.getOrigin();
  const fx = Math.max(1, Math.floor(factors[0]));
  const fy = Math.max(1, Math.floor(factors[1]));
  const fz = Math.max(1, Math.floor(factors[2]));
  const onx = Math.max(1, Math.ceil(nx / fx));
  const ony = Math.max(1, Math.ceil(ny / fy));
  const onz = Math.max(1, Math.ceil(nz / fz));

  const inArray = input.getPointData().getScalars().getData() as ArrayLike<number>;
  const outArray = new Float32Array(onx * ony * onz);

  const idx = (x: number, y: number, z: number) => x + y * nx + z * nx * ny;
  const odx = (x: number, y: number, z: number) => x + y * onx + z * onx * ony;

  for (let ozk = 0; ozk < onz; ozk += 1) {
    const z0 = ozk * fz;
    const z1 = Math.min((ozk + 1) * fz, nz);
    for (let oyj = 0; oyj < ony; oyj += 1) {
      const y0 = oyj * fy;
      const y1 = Math.min((oyj + 1) * fy, ny);
      for (let oxi = 0; oxi < onx; oxi += 1) {
        const x0 = oxi * fx;
        const x1 = Math.min((oxi + 1) * fx, nx);
        const outIndex = odx(oxi, oyj, ozk);
        if (mode === 'average') {
          let sum = 0;
          let count = 0;
          for (let z = z0; z < z1; z += 1) {
            for (let y = y0; y < y1; y += 1) {
              for (let x = x0; x < x1; x += 1) {
                sum += inArray[idx(x, y, z)] as number;
                count += 1;
              }
            }
          }
          outArray[outIndex] = count > 0 ? sum / count : 0;
        } else {
          // mode (majority vote) among integer labels in the block
          const counts = new Map<number, number>();
          for (let z = z0; z < z1; z += 1) {
            for (let y = y0; y < y1; y += 1) {
              for (let x = x0; x < x1; x += 1) {
                const v = Math.max(0, Math.round(inArray[idx(x, y, z)] as number));
                counts.set(v, (counts.get(v) || 0) + 1);
              }
            }
          }
          let best = 0;
          let bestCount = -1;
          counts.forEach((c, v) => {
            if (c > bestCount) { bestCount = c; best = v; }
          });
          outArray[outIndex] = best;
        }
      }
    }
  }

  const out = vtkImageData.newInstance();
  out.setDimensions([onx, ony, onz]);
  out.setSpacing([sx * fx, sy * fy, sz * fz]);
  out.setOrigin([ox, oy, oz]);
  const arr = vtkDataArray.newInstance({ name: 'Scalars', values: outArray, numberOfComponents: 1 });
  out.getPointData().setScalars(arr);
  return out;
}


