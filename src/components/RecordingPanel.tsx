import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CameraPose, Keyframe } from '../types';
import { encodeTGA } from '../utils/tga';
// Removed JSZip to avoid large in-memory ZIP allocations during recording

export type RecordingPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  getCameraPose: () => CameraPose | null;
  setCameraPose: (pose: CameraPose) => void;
  captureRGBA: (opts: { width: number; height: number }) => Promise<{ width: number; height: number; rgba: Uint8ClampedArray }>;
  applyQualityMode: () => void;
  getSliceIndex: () => number;
  setSliceIndex: (n: number) => void;
  maxSlice: number;
};

type SaveDirHandle = any; // File System Access API directory handle

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lerp3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// Basic smoothstep easing
function easeInOut(t: number) { return 0.5 * (1 - Math.cos(Math.PI * t)); }

export default function RecordingPanel({
  isOpen,
  onClose,
  getCameraPose,
  setCameraPose,
  captureRGBA,
  applyQualityMode,
  getSliceIndex,
  setSliceIndex,
  maxSlice,
}: RecordingPanelProps) {
  const [keyframes, setKeyframes] = useState<Keyframe[]>([]);
  const [framerate, setFramerate] = useState(30);
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(720);
  const [saveHandle, setSaveHandle] = useState<SaveDirHandle | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [durationSec, setDurationSec] = useState(5);
  const [currentTime, setCurrentTime] = useState(0);

  const sortedKeyframes = useMemo(() => keyframes.slice().sort((a, b) => a.timeSec - b.timeSec), [keyframes]);

  const addKeyframe = useCallback(() => {
    const pose = getCameraPose();
    if (!pose) return;
    const kf: Keyframe = {
      timeSec: Math.max(0, Math.min(durationSec, currentTime)),
      camera: pose,
      sliceIndex: getSliceIndex(),
    };
    setKeyframes((prev) => [...prev, kf]);
  }, [getCameraPose, getSliceIndex, currentTime, durationSec]);

  const clearKeyframes = useCallback(() => setKeyframes([]), []);

  const pickDirectory = useCallback(async () => {
    const anyWindow = window as any;
    if (!anyWindow.showDirectoryPicker) {
      alert('Your browser does not support the File System Access API. Use Chrome/Edge on desktop.');
      return;
    }
    try {
      const handle = await anyWindow.showDirectoryPicker();
      setSaveHandle(handle);
    } catch {}
  }, []);

  function sampleAtTime(t: number) {
    // If no keyframes, just hold current
    if (sortedKeyframes.length === 0) return { camera: getCameraPose(), sliceIndex: getSliceIndex() };
    if (sortedKeyframes.length === 1) return sortedKeyframes[0];
    // Clamp to endpoints
    if (t <= sortedKeyframes[0].timeSec) return sortedKeyframes[0];
    if (t >= sortedKeyframes[sortedKeyframes.length - 1].timeSec) return sortedKeyframes[sortedKeyframes.length - 1];
    // Find span
    let i = 0;
    while (i < sortedKeyframes.length - 1 && !(sortedKeyframes[i].timeSec <= t && t <= sortedKeyframes[i + 1].timeSec)) i++;
    const a = sortedKeyframes[i];
    const b = sortedKeyframes[i + 1];
    const span = b.timeSec - a.timeSec;
    const localT = span > 0 ? (t - a.timeSec) / span : 0;
    const e = easeInOut(localT);
    return {
      timeSec: t,
      camera: {
        position: lerp3(a.camera.position, b.camera.position, e),
        focalPoint: lerp3(a.camera.focalPoint, b.camera.focalPoint, e),
        viewUp: lerp3(a.camera.viewUp, b.camera.viewUp, e),
        viewAngle: lerp(a.camera.viewAngle, b.camera.viewAngle, e),
      },
      sliceIndex: Math.round(lerp(a.sliceIndex, b.sliceIndex, e)),
    } as Keyframe;
  }

  useEffect(() => {
    const samp = sampleAtTime(currentTime);
    if (samp && samp.camera) setCameraPose(samp.camera as CameraPose);
    if (typeof (samp as any)?.sliceIndex === 'number') setSliceIndex(Math.max(0, Math.min(maxSlice, (samp as any).sliceIndex)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime]);

  const record = useCallback(async () => {
    if (!saveHandle) {
      alert('Select a destination folder first.');
      return;
    }
    if (sortedKeyframes.length < 1) {
      alert('Create at least one keyframe.');
      return;
    }
    const totalFrames = Math.max(1, Math.round(durationSec * framerate));
    setIsRecording(true);
    try {
      applyQualityMode();
      // Write each frame directly into the chosen directory to avoid ZIP memory usage
      const dirHandle = saveHandle as any;
      for (let f = 0; f < totalFrames; f++) {
        const t = (f / Math.max(1, (totalFrames - 1))) * durationSec;
        const samp = sampleAtTime(t);
        if (samp.camera) setCameraPose(samp.camera as CameraPose);
        if (typeof samp.sliceIndex === 'number') setSliceIndex(Math.max(0, Math.min(maxSlice, samp.sliceIndex)));
        // Give the renderer a tick
        await new Promise((r) => setTimeout(r, 0));
        const { rgba } = await captureRGBA({ width, height });
        const tga = encodeTGA(width, height, rgba);
        const name = `frame_${String(f).padStart(5, '0')}.tga`;
        // Create and write the file immediately to release memory per frame
        const fileHandle = await dirHandle.getFileHandle(name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(tga.data);
        await writable.close();
      }
      alert('Recording complete (frames saved to selected folder).');
    } catch (err) {
      console.error(err);
      alert('Recording failed: ' + (err as any)?.message);
    } finally {
      setIsRecording(false);
    }
  }, [saveHandle, sortedKeyframes, durationSec, framerate, width, height, captureRGBA, setCameraPose, setSliceIndex, maxSlice, applyQualityMode]);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const isScrubbingRef = useRef(false);
  const onScrubToClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const tNorm = rect.width > 0 ? x / rect.width : 0;
    setCurrentTime(tNorm * durationSec);
  };
  useEffect(() => {
    const onMove = (e: PointerEvent) => { if (isScrubbingRef.current) onScrubToClientX(e.clientX); };
    const onUp = () => { isScrubbingRef.current = false; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [durationSec]);

  if (!isOpen) return null;
  const panelHeight = 220;
  return (
    <div
      style={{
        position: 'relative', left: 0, right: 0, height: panelHeight,
        background: '#1a1a1a', borderTop: '1px solid #333',
        color: '#eee', display: 'flex', flexDirection: 'column', gap: 8, padding: 12,
        overflowY: 'auto', flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 600 }}>Recorder</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" disabled={isRecording} onClick={record}>Record</button>
          <button className="btn" disabled={isRecording} onClick={onClose}>Close</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn" onClick={addKeyframe}>Set Keyframe</button>
        <button className="btn" onClick={clearKeyframes}>Clear</button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label>FPS</label>
          <input type="number" min={1} max={120} value={framerate} onChange={(e) => setFramerate(parseInt(e.target.value || '30', 10))} style={{ width: 72 }} />
          <label>Duration (s)</label>
          <input type="number" min={0.1} step={0.1} value={durationSec} onChange={(e) => setDurationSec(parseFloat(e.target.value || '5'))} style={{ width: 80 }} />
          <label>Res</label>
          <input type="number" min={16} value={width} onChange={(e) => setWidth(parseInt(e.target.value || '1280', 10))} style={{ width: 80 }} />
          <span>x</span>
          <input type="number" min={16} value={height} onChange={(e) => setHeight(parseInt(e.target.value || '720', 10))} style={{ width: 80 }} />
          <button className="btn" onClick={pickDirectory}>{saveHandle ? 'Change Folder' : 'Choose Folder'}</button>
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
        <div style={{ flex: 1, position: 'relative' }} onWheel={(e) => {
          e.preventDefault();
          const direction = e.deltaY > 0 ? 1 : -1;
          const step = durationSec / 50; // 50 steps across duration per wheel notch
          setCurrentTime((t) => Math.max(0, Math.min(durationSec, t + direction * step)));
        }}>
          <div
            ref={trackRef}
            onPointerDown={(e) => { isScrubbingRef.current = true; onScrubToClientX(e.clientX); }}
            style={{ position: 'absolute', inset: 0, background: '#0e0e0e', borderRadius: 4, border: '1px solid #333' }}
          />
          <div style={{ position: 'absolute', inset: 0 }}>
            {Array.from({ length: Math.max(2, Math.floor(durationSec) + 1) }).map((_, i) => {
              const x = (i / Math.max(1, durationSec)) * 100;
              return (
                <div key={i} style={{ position: 'absolute', left: `${x}%`, top: 0, bottom: 0 }}>
                  <div style={{ width: 1, height: '100%', background: '#222' }} />
                  <div style={{ position: 'absolute', top: 4, left: 4, fontSize: 10, color: '#aaa' }}>{i}s</div>
                </div>
              );
            })}
          </div>
          <div style={{ position: 'absolute', inset: 0 }}>
            {sortedKeyframes.map((k, idx) => {
              const tNorm = durationSec > 0 ? Math.min(Math.max(k.timeSec / durationSec, 0), 1) : 0;
              const left = `${tNorm * 100}%`;
              return (
                <div key={idx} style={{ position: 'absolute', left, top: '50%', transform: 'translate(-50%, -50%)' }}>
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startTime = k.timeSec;
                      const el = trackRef.current;
                      if (!el) return;
                      const rect = el.getBoundingClientRect();
                      const move = (ev: PointerEvent) => {
                        const dx = ev.clientX - startX;
                        const tDelta = (dx / rect.width) * durationSec;
                        const newTime = Math.max(0, Math.min(durationSec, startTime + tDelta));
                        setKeyframes((prev) => prev.map((p) => (p === k ? { ...p, timeSec: newTime } : p)));
                        setCurrentTime(newTime);
                      };
                      const up = () => {
                        window.removeEventListener('pointermove', move);
                        window.removeEventListener('pointerup', up);
                      };
                      window.addEventListener('pointermove', move);
                      window.addEventListener('pointerup', up);
                    }}
                    title={`t=${k.timeSec.toFixed(2)}s, slice ${k.sliceIndex}`}
                    style={{ width: 12, height: 12, background: '#e67e22', transform: 'rotate(45deg)', cursor: 'pointer' }}
                  />
                </div>
              );
            })}
          </div>
          <div style={{ position: 'absolute', inset: 0 }}>
            {(() => {
              const x = durationSec > 0 ? (currentTime / durationSec) * 100 : 0;
              return (
                <div style={{ position: 'absolute', left: `${x}%`, top: 0, bottom: 0 }}>
                  <div style={{ width: 2, height: '100%', background: '#5dade2' }} />
                </div>
              );
            })()}
          </div>
        </div>
        <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, marginLeft: 16 }}>Keyframes</div>
          <div style={{ overflow: 'auto', maxHeight: '100%' }}>
            {sortedKeyframes.map((k, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                <button className="btn" onClick={() => setCurrentTime(k.timeSec)}>Go</button>
                <input
                  type="number"
                  step={0.1}
                  value={k.timeSec}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setKeyframes((prev) => prev.map((p) => (p === k ? { ...p, timeSec: v } : p)));
                  }}
                  style={{ width: 80 }}
                />
                <span style={{ fontSize: 12, color: '#bbb' }}>slice {k.sliceIndex}</span>
                <button className="btn" onClick={() => setKeyframes((prev) => prev.filter((p) => p !== k))}>Del</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


