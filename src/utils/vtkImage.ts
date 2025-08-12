import vtkImageData from 'vtk.js/Sources/Common/DataModel/ImageData';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';

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


