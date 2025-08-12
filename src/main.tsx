import { createRoot } from 'react-dom/client'
import '@kitware/vtk.js/Rendering/Profiles/All'
import './index.css'
import App from './App.tsx'
import { animateFavicon } from './utils/favicon.ts';

animateFavicon([
  '/assets/heartfavicons/frame_00_delay-0.07s.png',
  '/assets/heartfavicons/frame_01_delay-0.07s.png',
  '/assets/heartfavicons/frame_02_delay-0.07s.png',
  '/assets/heartfavicons/frame_03_delay-0.07s.png',
  '/assets/heartfavicons/frame_04_delay-0.07s.png',
  '/assets/heartfavicons/frame_05_delay-0.07s.png',
  '/assets/heartfavicons/frame_06_delay-0.07s.png',
  '/assets/heartfavicons/frame_07_delay-0.07s.png',
  '/assets/heartfavicons/frame_08_delay-0.07s.png',
  '/assets/heartfavicons/frame_09_delay-0.07s.png',
  '/assets/heartfavicons/frame_10_delay-0.07s.png',
  '/assets/heartfavicons/frame_11_delay-0.07s.png',
  '/assets/heartfavicons/frame_12_delay-0.07s.png',
  '/assets/heartfavicons/frame_13_delay-0.07s.png',
  '/assets/heartfavicons/frame_14_delay-0.07s.png',
  '/assets/heartfavicons/frame_15_delay-0.07s.png',
  '/assets/heartfavicons/frame_16_delay-0.07s.png',
  '/assets/heartfavicons/frame_17_delay-0.07s.png',
  '/assets/heartfavicons/frame_18_delay-0.07s.png',
  '/assets/heartfavicons/frame_19_delay-0.07s.png',
  '/assets/heartfavicons/frame_20_delay-0.07s.png',
  '/assets/heartfavicons/frame_21_delay-0.07s.png',
  '/assets/heartfavicons/frame_22_delay-0.07s.png',
  '/assets/heartfavicons/frame_23_delay-0.07s.png',
  '/assets/heartfavicons/frame_24_delay-0.07s.png',
  '/assets/heartfavicons/frame_25_delay-0.07s.png',
  '/assets/heartfavicons/frame_26_delay-0.07s.png',
  '/assets/heartfavicons/frame_27_delay-0.07s.png',
  '/assets/heartfavicons/frame_28_delay-0.07s.png',
  '/assets/heartfavicons/frame_29_delay-0.07s.png',
  '/assets/heartfavicons/frame_30_delay-0.07s.png',
  '/assets/heartfavicons/frame_31_delay-0.07s.png',
  '/assets/heartfavicons/frame_32_delay-0.07s.png',
  '/assets/heartfavicons/frame_33_delay-0.07s.png',
  '/assets/heartfavicons/frame_34_delay-0.07s.png',
  '/assets/heartfavicons/frame_35_delay-0.07s.png'
], 7);

createRoot(document.getElementById('root')!).render(
  <App />,
)
