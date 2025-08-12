import { useEffect, useMemo, useState } from 'react';
import './App.css';
import Controls from './components/Controls';
import Volume2DView from './components/Volume2DView';
import Volume3DView from './components/Volume3DView';
import { loadNiftiFromFile, buildBinaryMask, clamp01Array, extractUniqueLabels } from './utils/nifti';
import { createVtkImageFromVolume } from './utils/vtkImage';
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';

function App() {
  const [segFile, setSegFile] = useState<File | null>(null);
  const [segIsProb, setSegIsProb] = useState<boolean>(false);

  const [vtkVolume, setVtkVolume] = useState<vtkImageData | null>(null);
  const [vtkOverlay, setVtkOverlay] = useState<vtkImageData | null>(null);

  const [sliceIndex, setSliceIndex] = useState(0);
  const [maxSlice, setMaxSlice] = useState(0);
  const [show2D, setShow2D] = useState(true);
  const [show3D, setShow3D] = useState(true);
  const [resetToken, setResetToken] = useState(0);

  const [volumeOpacity2D, setVolumeOpacity2D] = useState(1.0);
  const [overlayOpacity2D, setOverlayOpacity2D] = useState(0.75);
  const [volumeOpacity3D, setVolumeOpacity3D] = useState(0.3);
  const [overlayOpacity3D, setOverlayOpacity3D] = useState(0.15);
  const [showSlice3D, setShowSlice3D] = useState(true);
  const [highPerf3D, setHighPerf3D] = useState(false);

  const [uniqueLabels, setUniqueLabels] = useState<number[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<Set<number>>(new Set());

  // Lighting controls
  // Fixed lights now; no interactive lighting controls

  // File handlers
  async function handleVolumeUpload(file: File) {
    const loaded = await loadNiftiFromFile(file);
    const vtkImage = createVtkImageFromVolume(loaded.data);
    setVtkVolume(vtkImage);
    const nz = loaded.data.dimensions[2];
    setMaxSlice(nz - 1);
    setSliceIndex(Math.floor(nz / 2));
    setResetToken((t) => t + 1);
  }

  async function handleSegUpload(file: File, isProb: boolean) {
    setSegFile(file);
    setSegIsProb(isProb);
    const loaded = await loadNiftiFromFile(file);

    // Ensure matching dimensions
    if (vtkVolume) {
      const vd = vtkVolume.getDimensions();
      const sd = loaded.data.dimensions;
      if (vd[0] !== sd[0] || vd[1] !== sd[1] || vd[2] !== sd[2]) {
        alert('Segmentation dimensions do not match volume.');
        return;
      }
    }

    let segArray: Float32Array;
    if (isProb) {
      // Ensure values are in 0..1, accounting for nifti scl_slope/inter and potential 0..255 bytes
      segArray = clamp01Array(loaded.data.scalarData as any);
      setUniqueLabels([]);
      setSelectedLabels(new Set());
    } else {
      const labels = extractUniqueLabels(loaded.data.scalarData as any, true, 256);
      setUniqueLabels(labels);
      const initial = new Set(labels);
      setSelectedLabels(initial);
      segArray = buildBinaryMask(loaded.data.scalarData as any, initial);
    }

    const overlayVtk = createVtkImageFromVolume({
      ...loaded.data,
      scalarData: segArray,
      scalarMin: 0,
      scalarMax: 1,
    });
    setVtkOverlay(overlayVtk);

  }

  // Recompute overlay mask when selection changes (discrete case)
  useEffect(() => {
    if (!segFile || segIsProb) return;
    (async () => {
      const loaded = await loadNiftiFromFile(segFile);
      const segArray = buildBinaryMask(loaded.data.scalarData as any, selectedLabels);
      const overlayVtk = createVtkImageFromVolume({
        ...loaded.data,
        scalarData: segArray,
        scalarMin: 0,
        scalarMax: 1,
      });
      setVtkOverlay(overlayVtk);
    })();
  }, [selectedLabels]);

  const handleToggleLabel = (label: number) => {
    setSelectedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const maxSliceComputed = useMemo(() => maxSlice, [maxSlice]);

  const overlayColormap = segIsProb ? 'prob' : 'binary' as const;
  const [controlsOpen, setControlsOpen] = useState(false);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">MedVis3D</div>
        <div className="uploads">
          <div className="upload">
            <label className="btn">
              Load Volume (.nii.gz)
              <input
                type="file"
                accept=".nii,.nii.gz,application/gzip"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleVolumeUpload(f);
                }}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          <div className="upload">
            <label className="btn">
              Load Segmentation (.nii.gz)
              <input
                type="file"
                accept=".nii,.nii.gz,application/gzip"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const isProb = (document.getElementById('probSeg') as HTMLInputElement)?.checked;
                    handleSegUpload(f, Boolean(isProb));
                  }
                }}
                style={{ display: 'none' }}
              />
            </label>
            <label className="checkbox">
              <input id="probSeg" type="checkbox" /> Probabilistic label
            </label>
          </div>
          <button className="btn" onClick={() => setControlsOpen((v) => !v)}>
            {controlsOpen ? 'Hide Controls' : 'Show Controls'}
          </button>
        </div>
      </header>
      {controlsOpen && (
        <div className="controls-dropdown">
          <Controls
            sliceIndex={sliceIndex}
            setSliceIndex={setSliceIndex}
            maxSlice={maxSliceComputed}
            volumeOpacity2D={volumeOpacity2D}
            setVolumeOpacity2D={setVolumeOpacity2D}
            overlayOpacity2D={overlayOpacity2D}
            setOverlayOpacity2D={setOverlayOpacity2D}
            volumeOpacity3D={volumeOpacity3D}
            setVolumeOpacity3D={setVolumeOpacity3D}
            overlayOpacity3D={overlayOpacity3D}
            setOverlayOpacity3D={setOverlayOpacity3D}
            showSlice3D={showSlice3D}
            setShowSlice3D={setShowSlice3D}
            show2D={show2D}
            setShow2D={setShow2D}
            show3D={show3D}
            setShow3D={setShow3D}
            resetView={() => setResetToken((t) => t + 1)}
            hasSeg={Boolean(vtkOverlay)}
            isProbabilistic={segIsProb}
            uniqueLabels={uniqueLabels}
            selectedLabels={selectedLabels}
            toggleLabel={handleToggleLabel}
            highPerf3D={highPerf3D}
            setHighPerf3D={setHighPerf3D}
          />
        </div>
      )}
      <div className="main">
        <section className="views">
          <div className="view" style={{ display: show2D ? 'block' : 'none' }}>
            <Volume2DView
              volumeImage={vtkVolume}
              overlayImage={vtkOverlay}
              show={show2D}
              sliceIndex={sliceIndex}
              onSliceIndexChange={setSliceIndex}
              volumeOpacity={Math.min(1, Math.max(0, volumeOpacity2D))}
              overlayOpacity={Math.min(1, Math.max(0, overlayOpacity2D))}
              overlayColormap={overlayColormap}
            />
          </div>
          <div className="view" style={{ display: show3D ? 'block' : 'none' }}>
            <Volume3DView
              volumeImage={vtkVolume}
              overlayImage={vtkOverlay}
              overlayColormap={overlayColormap}
              show={show3D}
              volumeOpacity={Math.min(1, Math.max(0, volumeOpacity3D))}
              overlayOpacity={Math.min(1, Math.max(0, overlayOpacity3D))}
              sliceIndex={sliceIndex}
              resetToken={resetToken}
              sliceCTOpacity={Math.min(1, Math.max(0, volumeOpacity2D))}
              sliceSegOpacity={Math.min(1, Math.max(0, overlayOpacity2D))}
              showSlice3D={showSlice3D}
              highPerf3D={highPerf3D}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
