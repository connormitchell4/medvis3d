import { useMemo } from 'react';

type Props = {
  sliceIndex: number;
  setSliceIndex: (n: number) => void;
  maxSlice: number;

  volumeOpacity2D: number;
  setVolumeOpacity2D: (v: number) => void;
  overlayOpacity2D: number;
  setOverlayOpacity2D: (v: number) => void;
  volumeOpacity3D: number;
  setVolumeOpacity3D: (v: number) => void;
  overlayOpacity3D: number;
  setOverlayOpacity3D: (v: number) => void;

  showSlice3D: boolean;
  setShowSlice3D: (v: boolean) => void;

  show2D: boolean;
  setShow2D: (v: boolean) => void;
  show3D: boolean;
  setShow3D: (v: boolean) => void;

  resetView: () => void;

  hasSeg: boolean;
  isProbabilistic: boolean;
  setIsProbabilistic: (v: boolean) => void;
  uniqueLabels: number[];
  selectedLabels: Set<number>;
  toggleLabel: (label: number) => void;

  highPerf3D: boolean;
  setHighPerf3D: (v: boolean) => void;
};

export default function Controls({
  sliceIndex,
  setSliceIndex,
  maxSlice,
  volumeOpacity2D,
  setVolumeOpacity2D,
  overlayOpacity2D,
  setOverlayOpacity2D,
  volumeOpacity3D,
  setVolumeOpacity3D,
  overlayOpacity3D,
  setOverlayOpacity3D,
  showSlice3D,
  setShowSlice3D,
  show2D,
  setShow2D,
  show3D,
  setShow3D,
  resetView,
  hasSeg,
  isProbabilistic,
  setIsProbabilistic,
  uniqueLabels,
  selectedLabels,
  toggleLabel,
  highPerf3D,
  setHighPerf3D,
}: Props) {
  const clampedMax = Math.max(0, maxSlice);
  const labels = useMemo(() => uniqueLabels.slice(0, 64), [uniqueLabels]);

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const handleWheelFloat = (
    e: React.WheelEvent<HTMLInputElement>,
    current: number,
    setter: (v: number) => void,
    stepWhileScroll = 0.001
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const direction = e.deltaY < 0 ? 1 : -1;
    const next = clamp01(current + direction * stepWhileScroll);
    setter(next);
  };
  const handleWheelInt = (
    e: React.WheelEvent<HTMLInputElement>,
    current: number,
    setter: (v: number) => void,
    min: number,
    max: number,
    step = 1
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const direction = e.deltaY < 0 ? 1 : -1;
    const next = Math.min(max, Math.max(min, current + direction * step));
    setter(next);
  };
  return (
    <div className="controls">
      <div className="section-title" style={{ fontSize: '1.4rem', textAlign: 'center' }}>Controls</div>
      <div className="divider" />
      <div className="row">
        <label>Index</label>
        <input
          type="range"
          min={0}
          max={clampedMax}
          value={Math.min(sliceIndex, clampedMax)}
          onChange={(e) => setSliceIndex(parseInt(e.target.value, 10))}
          onWheel={(e) => handleWheelInt(e, Math.min(sliceIndex, clampedMax), setSliceIndex, 0, clampedMax, 1)}
        />
        <span>{Math.min(sliceIndex, clampedMax)} / {clampedMax}</span>
      </div>
      <div className="divider" />
      <div className="section-title">
        <label>
          <input type="checkbox" checked={show2D} onChange={(e) => setShow2D(e.target.checked)} /> 2D View
        </label>
      </div>
      <div className="row">
        <label>Volume</label>
        <input type="range" min={0} max={1} step={0.001}
          value={volumeOpacity2D}
          onChange={(e) => setVolumeOpacity2D(parseFloat(e.target.value))}
          onWheel={(e) => handleWheelFloat(e, volumeOpacity2D, setVolumeOpacity2D, 0.001)}
        />
        <span>{volumeOpacity2D.toFixed(3)}</span>
      </div>
      {hasSeg && (
        <div className="row">
          <label>Segmentation</label>
          <input type="range" min={0} max={1} step={0.001}
            value={overlayOpacity2D}
            onChange={(e) => setOverlayOpacity2D(parseFloat(e.target.value))}
            onWheel={(e) => handleWheelFloat(e, overlayOpacity2D, setOverlayOpacity2D, 0.001)}
          />
          <span>{overlayOpacity2D.toFixed(3)}</span>
        </div>
      )}
      <div className="divider" />
      <div className="section-title">
        <label>
          <input type="checkbox" checked={show3D} onChange={(e) => setShow3D(e.target.checked)} /> 3D View
        </label>
      </div>
      <div className="row">
        <label>Volume</label>
        <input type="range" min={0} max={1} step={0.001}
          value={volumeOpacity3D}
          onChange={(e) => setVolumeOpacity3D(parseFloat(e.target.value))}
          onWheel={(e) => handleWheelFloat(e, volumeOpacity3D, setVolumeOpacity3D, 0.001)}
        />
        <span>{volumeOpacity3D.toFixed(3)}</span>
      </div>
      {hasSeg && (
        <div className="row">
          <label>Segmentation</label>
          <input type="range" min={0} max={1} step={0.001}
            value={overlayOpacity3D}
            onChange={(e) => setOverlayOpacity3D(parseFloat(e.target.value))}
            onWheel={(e) => handleWheelFloat(e, overlayOpacity3D, setOverlayOpacity3D, 0.001)}
          />
          <span>{overlayOpacity3D.toFixed(3)}</span>
        </div>
      )}
      <div className="divider" />
      <div className="row">
        <div className="toggles" style={{ width: '100%', flexDirection: 'column', alignItems: 'flex-start' }}>
          <label>
            <input
              type="checkbox"
              checked={highPerf3D}
              onChange={(e) => setHighPerf3D(e.target.checked)}
            /> High performance
          </label>
          <label>
            <input type="checkbox" checked={showSlice3D} onChange={(e) => setShowSlice3D(e.target.checked)} /> Slice in 3D
          </label>
          <label>
            <input
              type="checkbox"
              checked={isProbabilistic}
              disabled={!hasSeg}
              onChange={(e) => setIsProbabilistic(e.target.checked)}
            /> Probabilistic label
          </label>
          <div className="divider" />
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'center' }}>
            <button className="btn" onClick={resetView}>Reset View</button>
          </div>
        </div>
      </div>
      {hasSeg && !isProbabilistic && labels.length > 0 && (
        <div className="row">
          <label>Labels</label>
          <div className="labels">
            {labels.map((l) => (
              <label key={l}>
                <input
                  type="checkbox"
                  checked={selectedLabels.has(l)}
                  onChange={() => toggleLabel(l)}
                />
                {l}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


