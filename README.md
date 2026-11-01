# Unified Engineering Workbench

C++17 assessment prototype for geometry import, rod thermal FEA, multicore execution, simulated embedded devices and explicit backpropagation. AI assistance is disclosed in docs/AI_USE_LOG.md.

## Windows 11 x64: one-click use

1. Extract the entire ZIP to a writable local folder.
2. Double-click **Launch.exe**. A console opens and the default browser opens the workbench at a local address between `http://127.0.0.1:8765` and port 8789.
3. Keep the console open while using the application. Close it to stop the local server. Closing only the browser tab leaves the server running.
4. Use the four main tabs and the additional Backpropagation tab. Sample buttons load bundled files. Export buttons download CSVs using the browser's normal download mechanism.

No installation, administrator rights, terminal commands, editor, external packages, internet, or first-run build is required for the packaged Windows app. Windows 11 supplies the Universal CRT and system DLLs. A modern installed Edge/Chrome/Firefox browser is required. The executable is unsigned; actual Windows security-policy behaviour and launch remain unverified on the development Mac.

**Verification status:** Windows PE32+ x64 release cross-build succeeds. Its import table has no MinGW/libstdc++ runtime DLL dependencies. Actual Windows 11 launch and clean-machine tests have NOT been performed. Mac launch, browser workflows, core and HTTP tests have been performed; see results and docs/CHECKPOINTS.md.

## Editor run configuration

Open the extracted package folder in VS Code. No extension is required. Use Terminal -> Run Task -> **Run packaged Windows Workbench**. The supplied `.vscode/tasks.json` starts the same root `Launch.exe`. The standalone launcher has no editor dependency.

## Source build and tests

Build prerequisites only: CMake >=3.16, a C++17 compiler, and a standard build tool. No C++ libraries must be downloaded.

```sh
cmake -S . -B build/native -DCMAKE_BUILD_TYPE=Release
cmake --build build/native --config Release
ctest --test-dir build/native -C Release --output-on-failure
```

On Mac/Linux with a single-configuration generator, run `build/native/Launch --no-browser` (Mac auto-open is supported; Linux browser auto-open is not). On native Windows/MSVC use `build/native/Release/Launch.exe`; CMake copies the web and data folders next to it.

To cross-build Windows from a Mac with MinGW-w64 installed:

```sh
cmake -S . -B build/windows -DCMAKE_TOOLCHAIN_FILE=cmake/windows-cross.cmake -DCMAKE_BUILD_TYPE=Release
cmake --build build/windows
```

With the server running, Node >=18 can run the optional HTTP integration suite: `node tests/integration.mjs`. Node is a development test dependency, never a runtime requirement.

Generate raw numerical evidence with `Launch.exe --evidence results/generated` on Windows or `build/native/Launch --evidence results/generated` on Mac. This runs 2000 benchmark cases with 5000 elements, warm-ups and five measured repetitions per worker count. Report plots can be regenerated using `tools/make_report.py` with ReportLab installed. Report-generation Python never implements application backend features.

## Architecture

- `src/core.hpp`, `src/core.cpp`: pure C++ numerical algorithms, parsers, batch concurrency and explicit gradients.
- `src/main.cpp`: portable launcher, bounded local HTTP request pool, C++ mock device state, API transport and evidence exports.
- `web/`: presentation only; custom Canvas 2D orthographic projection, interaction and charts. Uploaded file parsing and numerical computations run in C++.
- `data/`: self-created ASCII STL and synthetic ANSYS-style CSV; see PROVENANCE.md.
- `tests/`: positive, negative, numerical and HTTP integration tests.
- `results/`: actual raw CSV/JSON, plots, test logs and timestamped screenshot walkthrough.
- `docs/`: engineering design, limitations, AI-use log and handwritten derivation guide.

## Workflows and supported inputs

Geometry: load ASCII STL or CSV. Drag rotates, Shift-drag pans, scroll zooms, Fit resets framing. Click a temperature point to inspect its ID, location and temperature. STL is unitless; the provided sample is in metres. CSV coordinates must be metres and temperatures Celsius. Formats and limits are documented in data/PROVENANCE.md.

Thermal: run a custom rod or the required four-mesh study. The latter always uses the assignment defaults regardless of custom form edits. Export temperatures or convergence CSVs.

Performance: set case count and mesh size, run a bounded worker batch, then export all five raw repetitions per worker count. Maximum 20 million total elements. One active thermal/benchmark computation is admitted; a competing request receives an actionable busy error. A calculation safely completes if the view changes. No partial results are committed or exported. There is no mid-solve cancellation.

Hardware: all device behaviour is simulated. Inspect capabilities, connect, request telemetry, trigger timeout, reconnect, and disconnect. No drivers, firmware or actual hardware are accessed.

Backpropagation: calculate explicit gradients, inspect finite-difference agreement, export loss across the first update plus 100 subsequent updates.

## Known limitations and remaining candidate actions

- Windows launch must still be tested on an actual Windows 11 x64 laptop; cross-build validation is not runtime validation.
- Candidate ID was unavailable. Rename the final archive from `CandidateID_Workbench.zip` to your actual ID before submitting.
- The required handwritten appendix must be written/scanned by the candidate; docs/HANDWRITTEN_GUIDE.md provides verified values, not a handwritten submission.
- No actual hardware, firmware, FPGA programming, ANSYS export or CAD registration is claimed.
- ASCII STL only, maximum 10000 triangles; CSV maximum 10000 nodes; both maximum 20 MiB. Rendering is a basic orthographic software view with depth-sorted triangles, not a full CAD renderer.
- The thermal solver assumes uniform rod properties, uniform volumetric source and prescribed end temperatures. It is not a multidimensional solver.
- Local HTTP uses a deliberately small protocol subset and is bound only to loopback. It is an assessment prototype, not a production network service.
- Benchmark results depend on machine, workload, allocation, thread startup, thermal state and other activity. Mac measurements are not Windows performance claims.
- Read and confirm docs/OWNERSHIP.md and docs/EFFORT.md before submission. No fabricated history, authorship, effort, clean-machine tests or Windows screenshots are supplied.

## Submission review

Open docs/FINAL_CHECKLIST.md. Report.pdf is at most six pages. Screenshot walkthrough with logs is provided instead of a video. Git bundle and readable commit log establish actual development history.
