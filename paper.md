---
title: 'WebMedVis3D: An open-source web app for 3D medical imaging visualization and recording'
tags:
  - JavaScript
  - React
  - VTK.js
  - medical imaging
  - visualization
  - CT
  - MRI
authors:
  - name: Connor Mitchell
    orcid: 0009-0004-7687-1555
    corresponding: true
    affiliation: 1
  - name: Ross Mitchell
    orcid: 0000-0000-0000-0000
    corresponding: false
    affiliation: "2, 3"
affiliations:
 - name: Department of Mathematics and Statistical Sciences, University of Alberta, Canada
   index: 1
 - name: Department of Medicine, University of Alberta, Canada
   index: 2
 - name: Department of Computing Science, University of Alberta, Canada
   index: 3
date: 5 September 2025
bibliography: paper.bib
---

# Summary

Medical imaging datasets, such as CT and MRI, are commonly stored as volumetric data (e.g., NIfTI). While mature desktop applications exist, they can be difficult to install, require powerful hardware, or present steep learning curves. This hinders quick, shareable exploration of 3D data in teaching and research settings.

WebMedVis3D is an open-source, in-browser application for visualizing 3D medical volumes with optional segmentation overlays. Built with VTK.js, it provides a 2D axial slice viewer and a 3D volume renderer, supports probabilistic and discrete label overlays with label selection, and includes a recording panel to export camera animations as image sequences. All processing and rendering occur locally in the browser, preserving privacy and eliminating server dependencies.

# Statement of need

Established tools such as 3D Slicer [@fedorov2012slicer] and ITK-SNAP [@yushkevich2006itk] provide extensive functionality but typically require installation, dedicated hardware, and non-trivial onboarding. Many use cases—teaching demonstrations, exploratory visualization of model outputs, quick validation of segmentations—benefit from a zero‑install viewer that runs entirely in the browser and never uploads data.

WebMedVis3D addresses this gap by offering:

- Web-based, lightweight access: open a URL, drag-and-drop NIfTI volumes and segmentations, and start exploring.
- Privacy by design: all computation and rendering stay on the client.
- Research/teaching utility: fast inspection of volumes, interactive label-based masks, and export of presentation-quality animations via image sequences.

The application is useful for researchers reviewing segmentation model outputs, instructors preparing lectures, and students exploring volumetric anatomy without installation or specialized hardware.

# Functionality

Key capabilities include:

- 2D axial slice viewer: mouse-wheel slice navigation; fixed window/level to dataset range for consistent appearance.
- Segmentation overlays: probabilistic (0..1) or discrete labels (integers). In discrete mode, up to 256 unique labels are enumerated and users can select which labels to include in a binary mask.
- 3D volume rendering: orbit/pan/zoom camera; optional axial slice plane with an overlaid segmentation slice.
- Recording panel: create keyframes over time (camera and slice index) and export numbered TGA frames via the File System Access API for video assembly.
- Performance-aware rendering: a “High performance” toggle increases interactivity during camera motion and restores quality when idle.
- Privacy: all data are processed locally; nothing is uploaded to a server.

# Example usage

Local development:

```bash
git clone https://github.com/connormitchell4/medvis3d
cd medvis3d
npm install
npm run dev
```

Then open the printed local URL in your browser.

Recording: open the Controls panel, click “Open Recorder”, add keyframes, set FPS/duration/resolution and a destination folder, then click “Record” to export a TGA image sequence suitable for encoding with ffmpeg, for example:

```bash
ffmpeg -framerate 30 -i frame_%05d.tga -pix_fmt yuv420p -crf 18 out.mp4
```

Or upload the TGA file sequence into a video editor of your choice to render as an mp4.

## Acknowledgements

We acknowledge the open-source projects that enable this work: VTK.js [@vtkjs] for rendering, nifti-reader-js [@nifti_reader_js] for NIfTI parsing, pako [@pako] and the gzip specification [@rfc1952] for compression, and the React [@react] and Vite [@vite] ecosystems for the web app framework and tooling.

## References


