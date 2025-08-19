import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow';
import vtkRenderer from '@kitware/vtk.js/Rendering/Core/Renderer';
import vtkInteractorStyleTrackballCamera from '@kitware/vtk.js/Interaction/Style/InteractorStyleTrackballCamera';
import vtkVolume from '@kitware/vtk.js/Rendering/Core/Volume';
import vtkVolumeMapper from '@kitware/vtk.js/Rendering/Core/VolumeMapper';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction';
import vtkImageMapper from '@kitware/vtk.js/Rendering/Core/ImageMapper';
import vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice';
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';
import vtkLight from '@kitware/vtk.js/Rendering/Core/Light';
import type { CameraPose } from '../types';

type Props = {
  volumeImage?: vtkImageData | null;
  overlayImage?: vtkImageData | null; // probability [0..1] or binary mask
  overlayColormap: 'prob' | 'binary';
  show: boolean;
  volumeOpacity: number;
  overlayOpacity: number;
  sliceIndex: number; // for clipping + slice plane
  resetToken: number; // increment to trigger reset
  sliceCTOpacity: number; // opacity for the 2D CT slice actor shown in 3D view
  sliceSegOpacity: number; // opacity for the 2D seg overlay on the slice in 3D view
  showSlice3D: boolean;
  highPerf3D: boolean;
};

export type Volume3DViewHandle = {
  getCameraPose: () => CameraPose | null;
  setCameraPose: (pose: CameraPose) => void;
  captureRGBA: (opts: { width: number; height: number }) => Promise<{ width: number; height: number; rgba: Uint8ClampedArray }>;
  applyQualityMode: () => void;
};

const Volume3DView = forwardRef<Volume3DViewHandle, Props>(function Volume3DView({
  volumeImage,
  overlayImage,
  overlayColormap,
  show,
  volumeOpacity,
  overlayOpacity,
  sliceIndex,
  resetToken,
  showSlice3D,
  highPerf3D,
}: Props, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const grwRef = useRef<vtkGenericRenderWindow | null>(null);
  const rendererRef = useRef<vtkRenderer | null>(null);

  const volumeActorRef = useRef<vtkVolume | null>(null);
  const volumeMapperRef = useRef<vtkVolumeMapper | null>(null);
  const overlayActorRef = useRef<vtkVolume | null>(null);
  const overlayMapperRef = useRef<vtkVolumeMapper | null>(null);
  const sliceActorRef = useRef<vtkImageSlice | null>(null);
  const sliceMapperRef = useRef<vtkImageMapper | null>(null);
  const overlaySliceActorRef = useRef<vtkImageSlice | null>(null);
  const overlaySliceMapperRef = useRef<vtkImageMapper | null>(null);

  const clippingPlaneRef = useRef<vtkPlane | null>(null);
  const lightRef = useRef<vtkLight | null>(null);
  const lightRefBottom = useRef<vtkLight | null>(null);

  // Turbo colormap table (r,g,b in 0..1)
  const turbo_colormap_data: [number, number, number][] = [
    [0.18995,0.07176,0.23217],[0.19483,0.08339,0.26149],[0.19956,0.09498,0.29024],[0.20415,0.10652,0.31844],[0.20860,0.11802,0.34607],[0.21291,0.12947,0.37314],[0.21708,0.14087,0.39964],[0.22111,0.15223,0.42558],[0.22500,0.16354,0.45096],[0.22875,0.17481,0.47578],[0.23236,0.18603,0.50004],[0.23582,0.19720,0.52373],[0.23915,0.20833,0.54686],[0.24234,0.21941,0.56942],[0.24539,0.23044,0.59142],[0.24830,0.24143,0.61286],[0.25107,0.25237,0.63374],[0.25369,0.26327,0.65406],[0.25618,0.27412,0.67381],[0.25853,0.28492,0.69300],[0.26074,0.29568,0.71162],[0.26280,0.30639,0.72968],[0.26473,0.31706,0.74718],[0.26652,0.32768,0.76412],[0.26816,0.33825,0.78050],[0.26967,0.34878,0.79631],[0.27103,0.35926,0.81156],[0.27226,0.36970,0.82624],[0.27334,0.38008,0.84037],[0.27429,0.39043,0.85393],[0.27509,0.40072,0.86692],[0.27576,0.41097,0.87936],[0.27628,0.42118,0.89123],[0.27667,0.43134,0.90254],[0.27691,0.44145,0.91328],[0.27701,0.45152,0.92347],[0.27698,0.46153,0.93309],[0.27680,0.47151,0.94214],[0.27648,0.48144,0.95064],[0.27603,0.49132,0.95857],[0.27543,0.50115,0.96594],[0.27469,0.51094,0.97275],[0.27381,0.52069,0.97899],[0.27273,0.53040,0.98461],[0.27106,0.54015,0.98930],[0.26878,0.54995,0.99303],[0.26592,0.55979,0.99583],[0.26252,0.56967,0.99773],[0.25862,0.57958,0.99876],[0.25425,0.58950,0.99896],[0.24946,0.59943,0.99835],[0.24427,0.60937,0.99697],[0.23874,0.61931,0.99485],[0.23288,0.62923,0.99202],[0.22676,0.63913,0.98851],[0.22039,0.64901,0.98436],[0.21382,0.65886,0.97959],[0.20708,0.66866,0.97423],[0.20021,0.67842,0.96833],[0.19326,0.68812,0.96190],[0.18625,0.69775,0.95498],[0.17923,0.70732,0.94761],[0.17223,0.71680,0.93981],[0.16529,0.72620,0.93161],[0.15844,0.73551,0.92305],[0.15173,0.74472,0.91416],[0.14519,0.75381,0.90496],[0.13886,0.76279,0.89550],[0.13278,0.77165,0.88580],[0.12698,0.78037,0.87590],[0.12151,0.78896,0.86581],[0.11639,0.79740,0.85559],[0.11167,0.80569,0.84525],[0.10738,0.81381,0.83484],[0.10357,0.82177,0.82437],[0.10026,0.82955,0.81389],[0.09750,0.83714,0.80342],[0.09532,0.84455,0.79299],[0.09377,0.85175,0.78264],[0.09287,0.85875,0.77240],[0.09267,0.86554,0.76230],[0.09320,0.87211,0.75237],[0.09451,0.87844,0.74265],[0.09662,0.88454,0.73316],[0.09958,0.89040,0.72393],[0.10342,0.89600,0.71500],[0.10815,0.90142,0.70599],[0.11374,0.90673,0.69651],[0.12014,0.91193,0.68660],[0.12733,0.91701,0.67627],[0.13526,0.92197,0.66556],[0.14391,0.92680,0.65448],[0.15323,0.93151,0.64308],[0.16319,0.93609,0.63137],[0.17377,0.94053,0.61938],[0.18491,0.94484,0.60713],[0.19659,0.94901,0.59466],[0.20877,0.95304,0.58199],[0.22142,0.95692,0.56914],[0.23449,0.96065,0.55614],[0.24797,0.96423,0.54303],[0.26180,0.96765,0.52981],[0.27597,0.97092,0.51653],[0.29042,0.97403,0.50321],[0.30513,0.97697,0.48987],[0.32006,0.97974,0.47654],[0.33517,0.98234,0.46325],[0.35043,0.98477,0.45002],[0.36581,0.98702,0.43688],[0.38127,0.98909,0.42386],[0.39678,0.99098,0.41098],[0.41229,0.99268,0.39826],[0.42778,0.99419,0.38575],[0.44321,0.99551,0.37345],[0.45854,0.99663,0.36140],[0.47375,0.99755,0.34963],[0.48879,0.99828,0.33816],[0.50362,0.99879,0.32701],[0.51822,0.99910,0.31622],[0.53255,0.99919,0.30581],[0.54658,0.99907,0.29581],[0.56026,0.99873,0.28623],[0.57357,0.99817,0.27712],[0.58646,0.99739,0.26849],[0.59891,0.99638,0.26038],[0.61088,0.99514,0.25280],[0.62233,0.99366,0.24579],[0.63323,0.99195,0.23937],[0.64362,0.98999,0.23356],[0.65394,0.98775,0.22835],[0.66428,0.98524,0.22370],[0.67462,0.98246,0.21960],[0.68494,0.97941,0.21602],[0.69525,0.97610,0.21294],[0.70553,0.97255,0.21032],[0.71577,0.96875,0.20815],[0.72596,0.96470,0.20640],[0.73610,0.96043,0.20504],[0.74617,0.95593,0.20406],[0.75617,0.95121,0.20343],[0.76608,0.94627,0.20311],[0.77591,0.94113,0.20310],[0.78563,0.93579,0.20336],[0.79524,0.93025,0.20386],[0.80473,0.92452,0.20459],[0.81410,0.91861,0.20552],[0.82333,0.91253,0.20663],[0.83241,0.90627,0.20788],[0.84133,0.89986,0.20926],[0.85010,0.89328,0.21074],[0.85868,0.88655,0.21230],[0.86709,0.87968,0.21391],[0.87530,0.87267,0.21555],[0.88331,0.86553,0.21719],[0.89112,0.85826,0.21880],[0.89870,0.85087,0.22038],[0.90605,0.84337,0.22188],[0.91317,0.83576,0.22328],[0.92004,0.82806,0.22456],[0.92666,0.82025,0.22570],[0.93301,0.81236,0.22667],[0.93909,0.80439,0.22744],[0.94489,0.79634,0.22800],[0.95039,0.78823,0.22831],[0.95560,0.78005,0.22836],[0.96049,0.77181,0.22811],[0.96507,0.76352,0.22754],[0.96931,0.75519,0.22663],[0.97323,0.74682,0.22536],[0.97679,0.73842,0.22369],[0.98000,0.73000,0.22161],[0.98289,0.72140,0.21918],[0.98549,0.71250,0.21650],[0.98781,0.70330,0.21358],[0.98986,0.69382,0.21043],[0.99163,0.68408,0.20706],[0.99314,0.67408,0.20348],[0.99438,0.66386,0.19971],[0.99535,0.65341,0.19577],[0.99607,0.64277,0.19165],[0.99654,0.63193,0.18738],[0.99675,0.62093,0.18297],[0.99672,0.60977,0.17842],[0.99644,0.59846,0.17376],[0.99593,0.58703,0.16899],[0.99517,0.57549,0.16412],[0.99419,0.56386,0.15918],[0.99297,0.55214,0.15417],[0.99153,0.54036,0.14910],[0.98987,0.52854,0.14398],[0.98799,0.51667,0.13883],[0.98590,0.50479,0.13367],[0.98360,0.49291,0.12849],[0.98108,0.48104,0.12332],[0.97837,0.46920,0.11817],[0.97545,0.45740,0.11305],[0.97234,0.44565,0.10797],[0.96904,0.43399,0.10294],[0.96555,0.42241,0.09798],[0.96187,0.41093,0.09310],[0.95801,0.39958,0.08831],[0.95398,0.38836,0.08362],[0.94977,0.37729,0.07905],[0.94538,0.36638,0.07461],[0.94084,0.35566,0.07031],[0.93612,0.34513,0.06616],[0.93125,0.33482,0.06218],[0.92623,0.32473,0.05837],[0.92105,0.31489,0.05475],[0.91572,0.30530,0.05134],[0.91024,0.29599,0.04814],[0.90463,0.28696,0.04516],[0.89888,0.27824,0.04243],[0.89298,0.26981,0.03993],[0.88691,0.26152,0.03753],[0.88066,0.25334,0.03521],[0.87422,0.24526,0.03297],[0.86760,0.23730,0.03082],[0.86079,0.22945,0.02875],[0.85380,0.22170,0.02677],[0.84662,0.21407,0.02487],[0.83926,0.20654,0.02305],[0.83172,0.19912,0.02131],[0.82399,0.19182,0.01966],[0.81608,0.18462,0.01809],[0.80799,0.17753,0.01660],[0.79971,0.17055,0.01520],[0.79125,0.16368,0.01387],[0.78260,0.15693,0.01264],[0.77377,0.15028,0.01148],[0.76476,0.14374,0.01041],[0.75556,0.13731,0.00942],[0.74617,0.13098,0.00851],[0.73661,0.12477,0.00769],[0.72686,0.11867,0.00695],[0.71692,0.11268,0.00629],[0.70680,0.10680,0.00571],[0.69650,0.10102,0.00522],[0.68602,0.09536,0.00481],[0.67535,0.08980,0.00449],[0.66449,0.08436,0.00424],[0.65345,0.07902,0.00408],[0.64223,0.07380,0.00401],[0.63082,0.06868,0.00401],[0.61923,0.06367,0.00410],[0.60746,0.05878,0.00427],[0.59550,0.05399,0.00453],[0.58336,0.04931,0.00486],[0.57103,0.04474,0.00529],[0.55852,0.04028,0.00579],[0.54583,0.03593,0.00638],[0.53295,0.03169,0.00705],[0.51989,0.02756,0.00780],[0.50664,0.02354,0.00863],[0.49321,0.01963,0.00955],[0.47960,0.01583,0.01055]
  ];

  function applyTurboFromTable(cfun: vtkColorTransferFunction, table: [number, number, number][]) {
    const n = table.length;
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0;
      const [r, g, b] = table[i];
      cfun.addRGBPoint(t, r, g, b);
    }
  }

  // legacy helper (no longer used)

  type RenderMode = 'quality' | 'highPerfStill' | 'highPerfInteraction';
  function get3DSettingsForMode(spacing: number[] = [1, 1, 1], mode: RenderMode) {
    const smax = Math.max(...spacing);
    switch (mode) {
      case 'highPerfInteraction':
        return {
          sampleDistance: smax * 1.8,
          maxSamplesPerRay: 512,
          shade: false,
          depthPeeling: false,
          maxPeels: 30,
          occlusionRatio: 0.4,
        };
      case 'highPerfStill':
        // Same as quality when idle, even in high performance mode
        return {
          sampleDistance: smax * 0.25,
          maxSamplesPerRay: 8192,
          shade: true,
          depthPeeling: true,
          maxPeels: 400,
          occlusionRatio: 0.05,
        };
      case 'quality':
      default:
        return {
          sampleDistance: smax * 0.1,
          maxSamplesPerRay: 8192,
          shade: true,
          depthPeeling: true,
          maxPeels: 400,
          occlusionRatio: 0.05,
        };
    }
  }

  const isInteractingRef = useRef(false);
  const highPerfRef = useRef(false);
  const idleTimerRef = useRef<number | null>(null);
  useEffect(() => { highPerfRef.current = highPerf3D; }, [highPerf3D]);

  function applySettingsForMode(mode: RenderMode) {
    const renderer = rendererRef.current;
    const volMapper = volumeMapperRef.current;
    const ovMapper = overlayMapperRef.current;
    const volActor = volumeActorRef.current;
    const ovActor = overlayActorRef.current;
    if (volMapper && volumeImage) {
      const s = get3DSettingsForMode(volumeImage.getSpacing(), mode);
      volMapper.setSampleDistance(s.sampleDistance);
      volMapper.setMaximumSamplesPerRay(s.maxSamplesPerRay);
      volActor?.getProperty()?.setShade?.(s.shade);
    }
    if (ovMapper && overlayImage) {
      const s = get3DSettingsForMode(overlayImage.getSpacing(), mode);
      ovMapper.setSampleDistance(s.sampleDistance);
      ovMapper.setMaximumSamplesPerRay(s.maxSamplesPerRay);
      ovActor?.getProperty()?.setShade?.(s.shade);
    }
    try {
      const s = get3DSettingsForMode(volumeImage?.getSpacing?.() ?? overlayImage?.getSpacing?.() ?? [1,1,1], mode);
      (renderer as any)?.setUseDepthPeeling?.(s.depthPeeling);
      (renderer as any)?.setMaximumNumberOfPeels?.(s.maxPeels);
      (renderer as any)?.setOcclusionRatio?.(s.occlusionRatio);
    } catch {}
    // Adjust render size (resolution scale): only low-res during interaction
    try {
      const grwAny = grwRef.current as any;
      const glrw = grwAny?.getOpenGLRenderWindow?.();
      if (glrw && containerRef.current) {
        const scale = mode === 'highPerfInteraction' ? 0.75 : 1.0;
        const w = Math.max(1, Math.floor(containerRef.current.clientWidth * scale));
        const h = Math.max(1, Math.floor(containerRef.current.clientHeight * scale));
        glrw.setSize(w, h);
      }
    } catch {}
    grwRef.current?.getRenderWindow().render();
  }

  useImperativeHandle(ref, () => ({
    getCameraPose: () => {
      const renderer = rendererRef.current;
      if (!renderer) return null;
      const cam = renderer.getActiveCamera();
      return {
        position: cam.getPosition() as [number, number, number],
        focalPoint: cam.getFocalPoint() as [number, number, number],
        viewUp: cam.getViewUp() as [number, number, number],
        viewAngle: cam.getViewAngle?.() ?? 30,
      };
    },
    setCameraPose: (pose: CameraPose) => {
      const renderer = rendererRef.current;
      const grw = grwRef.current;
      if (!renderer || !grw) return;
      const cam = renderer.getActiveCamera();
      cam.setPosition(...pose.position);
      cam.setFocalPoint(...pose.focalPoint);
      cam.setViewUp(...pose.viewUp);
      if ((cam as any).setViewAngle && typeof pose.viewAngle === 'number') {
        (cam as any).setViewAngle(pose.viewAngle);
      }
      renderer.resetCameraClippingRange();
      grw.getRenderWindow().render();
    },
    applyQualityMode: () => {
      applySettingsForMode('quality');
    },
    captureRGBA: async ({ width, height }: { width: number; height: number }) => {
      const grwAny = grwRef.current as any;
      const grw = grwRef.current;
      const renderer = rendererRef.current;
      if (!grwAny || !grw || !renderer) throw new Error('Renderer not ready');
      let glrw = grwAny.getOpenGLRenderWindow?.();
      if (!glrw) {
        const rwAny = grw.getRenderWindow() as any;
        const views = rwAny?.getViews?.();
        if (Array.isArray(views) && views.length > 0) {
          glrw = views[0];
        }
      }
      const canvas: HTMLCanvasElement | undefined = glrw?.getCanvas?.() ?? (containerRef.current?.querySelector('canvas') as HTMLCanvasElement | null) ?? undefined;
      if (!glrw && !canvas) throw new Error('OpenGLRenderWindow not available');
      const prevSize = glrw?.getSize?.();
      const prevWidth = prevSize?.[0] ?? canvas?.width ?? 1;
      const prevHeight = prevSize?.[1] ?? canvas?.height ?? 1;
      try {
        if (glrw?.setSize) {
          glrw.setSize(width, height);
          renderer.resetCameraClippingRange();
          grw.getRenderWindow().render();
        } else {
          // Fall back: render at current size and scale via 2D draw
          grw.getRenderWindow().render();
        }
        // Read back via 2D draw to avoid readPixels/flip headaches
        const off = document.createElement('canvas');
        off.width = width;
        off.height = height;
        const ctx2d = off.getContext('2d');
        if (!ctx2d) throw new Error('2D context unavailable');
        if (!canvas) throw new Error('Canvas unavailable');
        ctx2d.drawImage(canvas, 0, 0, width, height);
        const img = ctx2d.getImageData(0, 0, width, height);
        return { width, height, rgba: img.data };
      } finally {
        if (glrw?.setSize) {
          glrw.setSize(prevWidth, prevHeight);
          grw.getRenderWindow().render();
        }
      }
    },
  }), []);

  function applyDefaultCameraFacingAxial() {
    const renderer = rendererRef.current;
    const grw = grwRef.current;
    if (!renderer || !grw) return;
    const base = volumeImage ?? overlayImage;
    if (!base) return;
    const b = base.getBounds();
    const cx = (b[0] + b[1]) / 2;
    const cy = (b[2] + b[3]) / 2;
    const cz = (b[4] + b[5]) / 2;

    const cam = renderer.getActiveCamera();
    const target = {
      focalPoint: [-cx, cy, cz] as [number, number, number],
      position: [-cx, 90, cz * 2] as [number, number, number],
      viewUp: [0, 1, 0] as [number, number, number],
    };

    // If already close, snap
    const curFP = cam.getFocalPoint() as number[];
    const curPos = cam.getPosition() as number[];
    const curVU = cam.getViewUp() as number[];
    const dist = Math.hypot(curPos[0]-target.position[0], curPos[1]-target.position[1], curPos[2]-target.position[2]);
    const same = dist < 1e-3;
    if (same) {
      cam.setFocalPoint(...target.focalPoint);
      cam.setViewUp(...target.viewUp);
      renderer.resetCameraClippingRange();
      grw.getRenderWindow().render();
      return;
    }

    // Smooth tween over 1000ms
    const durationMs = 1000;
    const start = performance.now();
    const startFP = [...curFP];
    const startPos = [...curPos];
    const startVU = [...curVU];

    const easeInOut = (t: number) => 0.5 * (1 - Math.cos(Math.PI * t));

    const step = () => {
      const now = performance.now();
      const t = Math.min(1, (now - start) / durationMs);
      const e = easeInOut(t);
      const lerp = (a: number, b: number) => a + (b - a) * e;
      cam.setFocalPoint(
        lerp(startFP[0], target.focalPoint[0]),
        lerp(startFP[1], target.focalPoint[1]),
        lerp(startFP[2], target.focalPoint[2])
      );
      cam.setPosition(
        lerp(startPos[0], target.position[0]),
        lerp(startPos[1], target.position[1]),
        lerp(startPos[2], target.position[2])
      );
      cam.setViewUp(
        lerp(startVU[0], target.viewUp[0]),
        lerp(startVU[1], target.viewUp[1]),
        lerp(startVU[2], target.viewUp[2])
      );
      renderer.resetCameraClippingRange();
      grw.getRenderWindow().render();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  useEffect(() => {
    if (!containerRef.current) return;
    const grw = vtkGenericRenderWindow.newInstance({ background: [0.12, 0.12, 0.12] });
    grw.setContainer(containerRef.current);
    try {
      const glrw = (grw as any).getOpenGLRenderWindow?.();
      if (glrw && containerRef.current) {
        const hasWebGL2 = !!(window as any).WebGL2RenderingContext;
        glrw.setWebgl2?.(hasWebGL2);
        glrw.setContainer(containerRef.current);
        const scale = highPerf3D ? 0.75 : 1.0; // try 0.5–0.85
        const w = Math.max(1, Math.floor(containerRef.current.clientWidth * scale));
        const h = Math.max(1, Math.floor(containerRef.current.clientHeight * scale));
        glrw.setSize(w, h);
      
        // optional: verify at runtime
        const ctx = glrw.get3DContext?.();
        console.log('WebGL version', ctx?.getParameter(ctx?.VERSION));
      }
    } catch {}
    const renderer = grw.getRenderer();
    const renderWindow = grw.getRenderWindow();
    const interactor = renderWindow.getInteractor();
    interactor.setInteractorStyle(vtkInteractorStyleTrackballCamera.newInstance());

    grwRef.current = grw;
    rendererRef.current = renderer;

    // Log camera pose while moving: position, viewUp, focalPoint
    const cam = renderer.getActiveCamera();
    // Throttle logs to animation frames during interaction
    let rafId: number | null = null;
    const onCamModified = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
      });
    };
    const camSub = (cam as any).onModified?.(onCamModified);

    return () => {
      try {
        const rw = grw.getRenderWindow();
        const ia = rw.getInteractor();
        (ia as any)?.cancelAnimation?.();
        (ia as any)?.unbindEvents?.();
      } catch {}
      try { camSub?.unsubscribe?.(); } catch {}
      grw.delete();
      grwRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  // Volume actor setup
  useEffect(() => {
    const renderer = rendererRef.current;
    const grw = grwRef.current;
    if (!renderer || !grw) return;

    // remove previous
    if (volumeActorRef.current) {
      renderer.removeVolume(volumeActorRef.current);
      volumeActorRef.current.delete();
      volumeActorRef.current = null;
      volumeMapperRef.current = null;
    }
    if (!volumeImage) {
      grw.getRenderWindow().render();
      return;
    }

    const mapper = vtkVolumeMapper.newInstance();
    mapper.setInputData(volumeImage);
    mapper.setBlendModeToComposite();
    {
      const mode: RenderMode = highPerf3D ? 'highPerfStill' : 'quality';
      const s = get3DSettingsForMode(volumeImage.getSpacing(), mode);
      mapper.setSampleDistance(s.sampleDistance);
      mapper.setMaximumSamplesPerRay(s.maxSamplesPerRay);
    }
    volumeMapperRef.current = mapper;

    const actor = vtkVolume.newInstance();
    actor.setMapper(mapper);
    const property = actor.getProperty();
    const ctRange = volumeImage.getPointData().getScalars().getRange();
    const cfun = vtkColorTransferFunction.newInstance();
    cfun.addRGBPoint(ctRange[0], 0.0, 0.0, 0.0);
    cfun.addRGBPoint(ctRange[1], 1.0, 1.0, 1.0);
    const ofun = vtkPiecewiseFunction.newInstance();
    // Low opacity baseline; controlled globally by volumeOpacity
    ofun.addPoint(ctRange[0], 0.0);
    ofun.addPoint(ctRange[1], volumeOpacity);
    property.setRGBTransferFunction(0, cfun);
    (property as any).setUseLookupTableScalarRange?.(true);
    property.setScalarOpacity(0, ofun);
    property.setInterpolationTypeToLinear();
    // Shading: keep CT shaded in quality, follow perf settings in perf mode
    {
      const mode: RenderMode = highPerf3D ? 'highPerfStill' : 'quality';
      const s = get3DSettingsForMode(volumeImage.getSpacing(), mode);
      property.setShade(s.shade);
    }

    volumeActorRef.current = actor;
    renderer.addVolume(actor);
    // Mirror across Z axis horizontally (invert X) to match 2D orientation
    actor.setScale(-1, 1, 1);
    // Slight ambient to avoid pure black
    property.setAmbient(0.1);
    property.setDiffuse(0.9);
    property.setSpecular(0.0);
    renderer.resetCamera();
    // Translucent ordering tuned by perf mode
    try {
      const mode: RenderMode = highPerf3D ? 'highPerfStill' : 'quality';
      const s = get3DSettingsForMode(volumeImage.getSpacing(), mode);
      (renderer as any).setUseDepthPeeling?.(s.depthPeeling);
      (renderer as any).setMaximumNumberOfPeels?.(s.maxPeels);
      (renderer as any).setOcclusionRatio?.(s.occlusionRatio);
    } catch {}
    grw.getRenderWindow().render();
    // Position camera to face axial slice by default
    applyDefaultCameraFacingAxial();
  }, [volumeImage]);

  // Overlay volume setup
  useEffect(() => {
    const renderer = rendererRef.current;
    const grw = grwRef.current;
    if (!renderer || !grw) return;
    // remove previous
    if (overlayActorRef.current) {
      renderer.removeVolume(overlayActorRef.current);
      overlayActorRef.current.delete();
      overlayActorRef.current = null;
      overlayMapperRef.current = null;
    }
    if (!overlayImage) {
      grw.getRenderWindow().render();
      return;
    }

    const mapper = vtkVolumeMapper.newInstance();
    mapper.setInputData(overlayImage);
    mapper.setBlendModeToComposite();
    {
      const mode: RenderMode = highPerf3D ? 'highPerfStill' : 'quality';
      const s = get3DSettingsForMode(overlayImage.getSpacing(), mode);
      mapper.setSampleDistance(s.sampleDistance);
      mapper.setMaximumSamplesPerRay(s.maxSamplesPerRay);
    }
    overlayMapperRef.current = mapper;

    const actor = vtkVolume.newInstance();
    actor.setMapper(mapper);
    const property = actor.getProperty();
    const cfun = vtkColorTransferFunction.newInstance();
    if (overlayColormap === 'prob') {
      applyTurboFromTable(cfun, turbo_colormap_data);
    } else {
      cfun.addRGBPoint(0.0, 0, 0, 0);
      cfun.addRGBPoint(1.0, 0, 1, 0); // green
    }
    // For probabilistic overlays, color by value; opacity is constant for >0 with 0 kept transparent
    const ofun = vtkPiecewiseFunction.newInstance();
    const globalAlpha = Math.min(1, Math.max(0, overlayOpacity));
    const eps = 1e-4;
    ofun.addPoint(0.0, 0.0);
    ofun.addPoint(eps, globalAlpha);
    ofun.addPoint(1.0, globalAlpha);
    property.setRGBTransferFunction(0, cfun);
    (property as any).setUseLookupTableScalarRange?.(true);
    property.setScalarOpacity(0, ofun);
    // Interpolation: make overlay crisp in quality mode
    if (!highPerf3D) {
      property.setInterpolationTypeToNearest();
    } else {
    // Interpolation: make overlay crisp in quality mode
    if (!highPerf3D) {
      property.setInterpolationTypeToNearest();
    } else {
      if (overlayColormap === 'prob') {
        property.setInterpolationTypeToLinear();
      } else {
        property.setInterpolationTypeToNearest();
      }
    }
    }
    // Shading: off for crisp labels in quality (no lighting blur); on during interaction only
    {
      const mode: RenderMode = highPerf3D ? 'highPerfStill' : 'quality';
      const s = get3DSettingsForMode(overlayImage.getSpacing(), mode);
      property.setShade(s.shade);
    }
    overlayActorRef.current = actor;
    renderer.addVolume(actor);
    // Mirror to match 2D orientation
    actor.setScale(-1, 1, 1);
    // Enable lighting-like shading on segmentation by emphasizing edges via gradient opacity
    property.setAmbient(0.15);
    property.setDiffuse(0.85);
    property.setSpecular(0.3);
    property.setSpecularPower(8.0);
    grw.getRenderWindow().render();
  }, [overlayImage, overlayColormap]);
  
  // Apply settings on toggle change
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const mode: RenderMode = highPerf3D ? 'highPerfStill' : 'quality';
    applySettingsForMode(mode);
  }, [highPerf3D]);

  // Remove global resolution scaling on toggle; we now scale only during interaction

  // Interaction-aware quality switching (only when highPerf3D is enabled)
  useEffect(() => {
    const renderer = rendererRef.current;
    const grw = grwRef.current;
    if (!renderer || !grw) return;
    const cam = renderer.getActiveCamera();

    let rafId: number | null = null;
    const onCamModified = () => {
      if (!highPerfRef.current) return; // only when high performance is enabled
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        // switch to interaction mode immediately
        if (!isInteractingRef.current) {
          isInteractingRef.current = true;
          applySettingsForMode('highPerfInteraction');
        }
        // reset idle timer
        if (idleTimerRef.current) {
          window.clearTimeout(idleTimerRef.current);
          idleTimerRef.current = null;
        }
        idleTimerRef.current = window.setTimeout(() => {
          isInteractingRef.current = false;
          applySettingsForMode('highPerfStill');
        }, 100);
      });
    };
    const camSub = (cam as any).onModified?.(onCamModified);
    return () => {
      try { camSub?.unsubscribe?.(); } catch {}
      if (rafId) cancelAnimationFrame(rafId);
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [rendererRef.current, grwRef.current]);

  // Update opacities when sliders change
  useEffect(() => {
    if (volumeActorRef.current) {
      const range = volumeImage?.getPointData().getScalars().getRange() ?? [0, 1];
      const ofun = vtkPiecewiseFunction.newInstance();
      ofun.addPoint(range[0], 0.0);
      ofun.addPoint(range[1], volumeOpacity);
      volumeActorRef.current.getProperty().setScalarOpacity(0, ofun);
    }
    if (overlayActorRef.current) {
      const ofun = vtkPiecewiseFunction.newInstance();
      const globalAlpha = Math.min(1, Math.max(0, overlayOpacity));
      const eps = 1e-4;
      ofun.addPoint(0.0, 0.0);
      ofun.addPoint(eps, globalAlpha);
      ofun.addPoint(1.0, globalAlpha);
      overlayActorRef.current.getProperty().setScalarOpacity(0, ofun);
    }
    grwRef.current?.getRenderWindow().render();
  }, [volumeOpacity, overlayOpacity]);

  // Slice plane actor (for visual context) + overlay slice
  useEffect(() => {
    const renderer = rendererRef.current;
    const grw = grwRef.current;
    if (!renderer || !grw) return;
    if (sliceActorRef.current) {
      renderer.removeActor(sliceActorRef.current);
      sliceActorRef.current.delete();
      sliceActorRef.current = null;
      sliceMapperRef.current = null;
    }
    if (overlaySliceActorRef.current) {
      renderer.removeActor(overlaySliceActorRef.current);
      overlaySliceActorRef.current.delete();
      overlaySliceActorRef.current = null;
      overlaySliceMapperRef.current = null;
    }
    if (!volumeImage) {
      grw.getRenderWindow().render();
      return;
    }
    const mapper = vtkImageMapper.newInstance();
    mapper.setInputData(volumeImage);
    mapper.setSlicingMode(vtkImageMapper.SlicingMode.K);
    mapper.setSlice(sliceIndex);
    sliceMapperRef.current = mapper;

    if (showSlice3D) {
      const actor = vtkImageSlice.newInstance();
      actor.setMapper(mapper);
      const prop = actor.getProperty();
      const range = volumeImage.getPointData().getScalars().getRange();
      prop.setColorWindow(range[1] - range[0]);
      prop.setColorLevel((range[1] + range[0]) / 2);
      // If slice is shown, set to fully opaque; otherwise we won't create it
      prop.setOpacity(1);
      renderer.addViewProp(actor);
      sliceActorRef.current = actor;
      // Mirror to match 2D orientation
      actor.setScale(-1, 1, 1);
    }
    
    // Add overlay slice overlay if present
    if (overlayImage) {
      const omapper = vtkImageMapper.newInstance();
      omapper.setInputData(overlayImage);
      omapper.setSlicingMode(vtkImageMapper.SlicingMode.K);
      omapper.setSlice(sliceIndex);
      overlaySliceMapperRef.current = omapper;

      const oactor = vtkImageSlice.newInstance();
      oactor.setMapper(omapper);
      const oprop = oactor.getProperty();
    const cfun = vtkColorTransferFunction.newInstance();
    if (overlayColormap === 'prob') {
      applyTurboFromTable(cfun, turbo_colormap_data);
    } else {
        cfun.addRGBPoint(0.0, 0, 0, 0);
        cfun.addRGBPoint(1.0, 0, 1, 0);
      }
      const ofun = vtkPiecewiseFunction.newInstance();
      const segAlpha = Math.min(1, Math.max(0, 4 *overlayOpacity));
      const alphaEps = 1e-4;
      ofun.addPoint(0.0, 0.0);
      ofun.addPoint(alphaEps, segAlpha);
      ofun.addPoint(1.0, segAlpha);
      oprop.setRGBTransferFunction(0, cfun);
      // Ensure TF range [0..1] is respected for color mapping
      (oprop as any).setUseLookupTableScalarRange?.(true);
      oprop.setScalarOpacity(0, ofun);
      // Interpolation: make overlay crisp in quality mode
      if (!highPerf3D) {
        oprop.setInterpolationTypeToNearest();
      } else {
        if (overlayColormap === 'prob') {
          oprop.setInterpolationTypeToLinear();
        } else {
          oprop.setInterpolationTypeToNearest();
        }
      }
      // Slightly offset to avoid z-fighting
      const zEps = Math.max((overlayImage.getSpacing()?.[2] ?? 1) * 0.1, 0.01);
      oactor.setPosition(0, 0, zEps);
      renderer.addViewProp(oactor);
      overlaySliceActorRef.current = oactor;
      // Mirror to match 2D orientation
      oactor.setScale(-1, 1, 1);
    }
    grw.getRenderWindow().render();
  }, [volumeImage, overlayImage, overlayColormap, overlayOpacity, showSlice3D]);

  // Keep slice index in sync for slice actor
  useEffect(() => {
    if (sliceMapperRef.current) sliceMapperRef.current.setSlice(sliceIndex);
    if (overlaySliceMapperRef.current) overlaySliceMapperRef.current.setSlice(sliceIndex);
    grwRef.current?.getRenderWindow().render();
  }, [sliceIndex]);

  // Clipping plane synced with slice index
  useEffect(() => {
    const baseImage = volumeImage ?? overlayImage;
    const zWorld = getWorldZAtSlice(baseImage, sliceIndex);
    if (zWorld == null) return;
    if (!clippingPlaneRef.current) {
      clippingPlaneRef.current = vtkPlane.newInstance();
    }
    const plane = clippingPlaneRef.current;
    // Keep z >= zWorld (normal points +Z). This avoids fully clipping at low slices.
    plane.setOrigin(0, 0, zWorld);
    plane.setNormal(0, 0, 1);
    if (volumeMapperRef.current) {
      volumeMapperRef.current.removeAllClippingPlanes();
      volumeMapperRef.current.addClippingPlane(plane);
    }
    if (overlayMapperRef.current) {
      overlayMapperRef.current.removeAllClippingPlanes();
      overlayMapperRef.current.addClippingPlane(plane);
    }
    grwRef.current?.getRenderWindow().render();
  }, [sliceIndex, volumeImage, overlayImage]);

  // Keep overlay slice slightly in front of CT slice along camera view
  useEffect(() => {
    const renderer = rendererRef.current;
    const oactor = overlaySliceActorRef.current;
    if (!renderer || !oactor) return;
    const camera = renderer.getActiveCamera();
    const update = () => {
      const vpn = camera.getViewPlaneNormal() as number[];
      const step = Math.max(...(overlayImage?.getSpacing?.() ?? [1, 1, 1])) * 0.5;
      // Move overlay slice slightly toward the camera along the view-plane normal
      oactor.setPosition(vpn[0] * step, vpn[1] * step, vpn[2] * step);
      grwRef.current?.getRenderWindow().render();
    };
    update();
    const sub = (camera as any).onModified?.(update);
    return () => {
      try { sub?.unsubscribe?.(); } catch {}
    };
  }, [overlayImage, overlaySliceActorRef.current]);

  // Create fixed lights: one from above, one from below
  useEffect(() => {
    const renderer = rendererRef.current;
    const grw = grwRef.current;
    if (!renderer || !grw) return;
    if (!lightRef.current) {
      const light = vtkLight.newInstance();
      light.setLightTypeToSceneLight();
      light.setConeAngle(45);
      light.setIntensity(1.0);
      light.setPositional(true);
      lightRef.current = light;
      renderer.addLight(light);
    }
    if (!lightRefBottom.current) {
      const light = vtkLight.newInstance();
      light.setLightTypeToSceneLight();
      light.setConeAngle(45);
      light.setIntensity(0.8);
      light.setPositional(true);
      lightRefBottom.current = light;
      renderer.addLight(light);
    }
    const light = lightRef.current!;
    const lightBottom = lightRefBottom.current!;
    const bds = volumeImage?.getBounds() ?? overlayImage?.getBounds();
    const center: [number, number, number] = [
      (bds ? (bds[0] + bds[1]) / 2 : 0),
      (bds ? (bds[2] + bds[3]) / 2 : 0),
      (bds ? (bds[4] + bds[5]) / 2 : 0),
    ];
    const radius = bds ? Math.max(bds[1] - bds[0], bds[3] - bds[2], bds[5] - bds[4]) / 2 : 100;
    light.setPosition(center[0], center[1], center[2] + radius * 2);
    light.setFocalPoint(center[0], center[1], center[2]);
    // Bottom light pointing up
    lightBottom.setPosition(center[0], center[1], center[2] - radius * 2);
    lightBottom.setFocalPoint(center[0], center[1], center[2]);
    grw.getRenderWindow().render();
  }, [volumeImage, overlayImage]);

  // Reset camera when asked
  useEffect(() => {
    if (!resetToken) return;
    // Apply the exact same default camera pose as on load (no intermediate reset)
    applyDefaultCameraFacingAxial();
    applyDefaultCameraFacingAxial();
  }, [resetToken]);

  return (
    <div style={{ display: show ? 'block' : 'none', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
});

export default Volume3DView;

function getWorldZAtSlice(image: vtkImageData | null | undefined, k: number): number | null {
  if (!image) return null;
  const [,, nz] = image.getDimensions();
  const [,, sz] = image.getSpacing();
  const [,, oz] = image.getOrigin();
  const kk = Math.min(Math.max(k, 0), nz - 1);
  return oz + kk * sz;
}


