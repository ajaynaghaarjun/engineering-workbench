# Verification checkpoints

## Enhanced release v1.1

Added 317-core-check suite and 15 API scenarios. Enhancements include safe benchmark cancellation and live progress; custom-parameter convergence; all-mesh comparison and selected-mesh inspection; heat flux, reaction heat flows, energy balance, equation residual and nodal error diagnostics; richer exports with parameters; C++ mesh/temperature summaries; camera presets and wireframe. Cancellation is exercised while health remains responsive, then a fresh benchmark is started successfully. Previous completed results remain intact after cancellation.

For the default rod, outward heat flows are 0.42 W and 0.58 W against 1 W generation. These are recovered with half-element source contributions at the boundaries. Flux exports use the positive-x convention. Source limits and Windows verification limitations remain unchanged.

## 1. Foundation - passed available checks

Mac CMake release build passed. Windows x64 release cross-build passed. Browser connects to the loopback C++ backend. Windows runtime launch remains unverified. Sandbox initially prevented socket bind; approved local execution resolved it. CMake and MinGW were installed through Homebrew.

## 2. Thermal core - passed

Correct boundary conditions, exact nodal comparison, independent midpoint error formula and second-order convergence for N=10,20,40,80. Zero-source linear case also passes. Results are in generated CSV/JSON and plots. Negative parameters are rejected.

## 3. Geometry and imports - passed supported workflows

C++ imports self-created ASCII STL and synthetic CSV. Browser renders both; node 8 was inspected at 185 C. Empty/malformed/non-finite/duplicate input tests pass. Maximum supported counts and oversized file rejection are tested. Review replaced argument-spread extrema and added rendering limits. Rotation/pan/zoom implementations exist; static screenshots alone are not evidence of every interaction.

## 4. Engineering features - passed

Serial and 2/4-worker batch results agree at every node. Five repetitions and medians are recorded. Initial gradients agree with central differences by approximately 1.13e-10. Loss decreases through the first plus 100 subsequent updates. All three C++ hardware mocks pass connection, telemetry, timeout and recovery HTTP scenarios.

## 5. Integration review - passed available checks

299 core checks pass in Release and under AddressSanitizer/UndefinedBehaviorSanitizer. Twelve HTTP scenarios pass. Browser views, sample loading, node inspection, thermal study, benchmark and backpropagation have been exercised. Hardware timeout UI mismatch was fixed and retested. CSV download was exercised; saved loss.csv was observed. A download-event automation wait stalled; it was abandoned in favour of direct UI action and file inspection. No application failure is inferred from that automation limitation.

## 6. Delivery - build/package checks, candidate actions pending

Windows x64 executable has only system DLL imports; no compiler runtime DLL needs installation. Report is six pages and visually inspected; raw data, plots, tests, disclosure, provenance, licences, editor task and source are included. Git bundle, commit log, hashes and ZIP extraction audit are generated with the package.

Actual Windows 11 launch, the candidate's handwritten appendix, actual candidate ID, personal understanding/ownership confirmation and final upload remain candidate-dependent. No clean-Windows-machine success, handwritten authorship or submission receipt is fabricated.
