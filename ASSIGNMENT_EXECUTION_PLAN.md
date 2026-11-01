# Unified Engineering Workbench - Emergency Execution Plan

**Deadline:** 2 November 2026, 06:00 IST  
**Working interval:** 1 November 2026, 17:30 to 2 November 2026, 06:00 IST  
**Usable time:** 12.5 hours, including packaging and upload  
**Feature freeze:** 03:30 IST  
**Upload target:** 05:45 IST

## 1. Objective

Build the smallest coherent Windows 11 x64 prototype that clears the company's shortlist gates and demonstrates every task at least once. Prioritize correctness, reproducibility, and evidence over visual polish.

The brief expects 40-50 hours of work. In 12.5 hours, target a credible **60-75 points**. A higher score is possible only if the Windows toolchain, packaging, and 3D rendering work without long debugging.

## 2. Non-negotiable shortlist gates

The submission must have all of these:

- A working C++ backend.
- A standalone `Launch.exe` that starts without installation, terminal commands, administrator rights, editor, internet, or first-run compilation.
- At least a minimally usable interface with Geometry, Thermal Analysis, Performance, and Hardware views.
- Correct one-dimensional thermal FEA with analytical comparison.
- Tests and evidence sufficient for at least 6/12 in C++ backend, 7/14 in thermal FEA, and 3/6 in delivery/report.
- A ZIP named `CandidateID_Workbench.zip` with source, tests, data, results, documentation, version-control evidence, AI-use disclosure, and ownership statement.

If time slips, remove polish before removing any item above.

## 3. Fastest practical architecture

Use one C++17 executable as a local backend and launcher, with a bundled browser UI:

- **C++17 core:** FEA, STL/CSV parsing and validation, parallel batch runner, backpropagation, hardware mocks, exports, and tests.
- **Local HTTP layer:** a small header-only server such as `cpp-httplib`; bind only to localhost.
- **Frontend:** static HTML/CSS/JavaScript served by the executable.
- **3D view:** a locally bundled Three.js build for STL triangles and temperature point clouds. No CDN or runtime internet access.
- **Data exchange:** JSON APIs plus generated CSV files.
- **Build:** CMake with pinned dependency versions.
- **Windows package:** `Launch.exe`, static frontend assets, data, and only the required runtime libraries.

This architecture keeps numerical work and file validation in C++ while allowing a usable interface quickly.

## 4. Scope by priority

### P0 - Finish even if other features are reduced

1. Repository, CMake, folder structure, and meaningful commits.
2. `Launch.exe` plus four working navigation views.
3. Thermal FEA for N = 10, 20, 40, 80 with both Dirichlet boundary conditions.
4. Analytical solution, midpoint-interpolated maximum error, convergence evidence, and CSV export.
5. Positive, negative, and numerical tests.
6. README, short report, AI-use log, ownership statement, licenses, and final ZIP audit.

### P1 - High-value engineering evidence

1. ASCII STL parser in C++ with malformed/non-finite/empty-file rejection.
2. ANSYS-style CSV parser for `node_id,x_m,y_m,z_m,temperature_C`.
3. Rotate, pan, zoom, fit-to-view, temperature legend, units, and node inspection.
4. Responsive status, actionable errors, export, and safe completion/cancellation.
5. Serial and bounded-worker parallel batch execution with deterministic ordering.

### P2 - Complete with minimal but correct implementations

1. Performance table for 1, 2, and up to 4 workers; five repetitions; median, speedup, efficiency, and agreement.
2. Three simulated hardware adapters, capability reporting, connect/disconnect, telemetry, and a recoverable timeout.
3. Backpropagation calculation in C++, central-difference gradient check, and 100-step loss CSV/plot.
4. Two-page handwritten appendix prepared from verified calculations.

### P3 - Cut first if behind

- Animation and advanced styling.
- Rich telemetry or multiple failure scenarios.
- More than one sample STL and temperature CSV.
- Sophisticated plotting inside the application; labelled exported plots are acceptable evidence.
- Extra worker counts beyond the logical CPU limit required by the brief.

## 5. Time-boxed schedule

| Time (IST) | Work | Exit condition |
|---|---|---|
| 17:30-18:00 | Freeze architecture, create repository/checklist, inspect compiler and Windows-build route | Stack fixed; no more framework comparisons |
| 18:00-18:45 | Scaffold folders, CMake, C++ executable, four-view UI, local asset serving | App launches locally and every view opens |
| 18:45-20:00 | Implement thermal FEA, analytical solution, midpoint error, CSV exports, tests | N=10/20/40/80 pass; convergence data exists |
| 20:00-21:00 | Implement ASCII STL and temperature CSV parsers, samples, validation tests | Valid samples load; malformed/non-finite/empty cases fail clearly |
| 21:00-22:00 | Connect geometry and temperature visualizations | Rotate/pan/zoom/fit, legend, units, inspection work |
| 22:00-22:30 | First integration and commit checkpoint | P0 app path works end to end; status file updated |
| 22:30-23:30 | Serial/parallel batch runner and benchmark harness | Deterministic results; agreement <= 1e-8 C; raw timings saved |
| 23:30-00:15 | Backpropagation code, gradient checks, 100-step loss data | Gradients pass <= 1e-5; appendix values frozen |
| 00:15-01:00 | Hardware block diagram, interface table, three mocks, timeout recovery | All device types appear in UI and one failure recovers |
| 01:00-02:00 | UI integration: parameters, progress, errors, cancellation/safe completion, exports | Primary demo path can run without manual file edits |
| 02:00-02:45 | Windows x64 release build and portable package | `Launch.exe` produced; runtime/assets included |
| 02:45-03:30 | Full verification and bug fixing | Clean launch, tests, samples, exports, and relative paths pass |
| 03:30-04:30 | Feature freeze; README, report, AI log, ownership, licenses, provenance, commit log | All required documents present and internally consistent |
| 04:30-05:00 | Record 3-5 minute demo or timestamped screenshot walkthrough | Evidence covers launch, FEA, imports, parallel run, hardware failure |
| 05:00-05:30 | Build Git bundle, final ZIP, extraction test, archive inventory | ZIP extracts and launches from a clean folder |
| 05:30-05:45 | Upload and confirm receipt | Submission visible before deadline |
| 05:45-06:00 | Emergency buffer | Only upload/repackaging fixes allowed |

## 6. Hard checkpoints and cut rules

- **20:00:** If FEA tests are not passing, stop all visualization work and finish FEA first.
- **22:30:** If no end-to-end app path exists, reduce UI styling to plain controls and tables.
- **00:15:** If parallel timing is unstable, report the limitation honestly and preserve raw data; do not invent speedup.
- **02:00:** If optional features remain incomplete, stop them and start Windows packaging.
- **03:30:** No new features. Only packaging, tests, documentation, evidence, and critical fixes.
- **05:30:** Do not change code unless the ZIP cannot launch or a required file is absent.

## 7. Model and reasoning strategy

### Recommended setting

Keep **GPT-5.6 Sol at medium reasoning** for most implementation. Medium is the best balance for multi-step coding and conserves the Plus usage allowance. Use high reasoning only for short, high-risk phases:

- architecture/API contracts before scaffolding;
- FEA derivation and numerical verification;
- diagnosis of a stubborn compiler, linker, concurrency, or packaging failure;
- final rubric-based audit.

Do not run the entire night at high reasoning. It is slower and may consume the usage allowance sooner.

If GPT-6.1 Sol is available in the model picker, it is a reasonable upgrade for this project because the official documentation positions it for complex coding and professional work. Switch only once, before substantial implementation, and use medium. Do not switch repeatedly. GPT-6 Astra is unnecessary unless progress is blocked by a genuinely difficult integration bug; its higher capability does not compensate for lost time if the project scope is not controlled.

## 8. Token and Plus-window budget

OpenAI does not publish a fixed raw-token quota for a Plus five-hour window, so an exact remaining allowance cannot be calculated from the brief. The estimate below is a project workload estimate, not a guaranteed ChatGPT limit.

| Work block | Estimated model tokens (input + output + reasoning) |
|---|---:|
| Planning, architecture, repository inspection | 20k-35k |
| Scaffolding, build setup, UI shell | 35k-60k |
| FEA, analytical verification, tests | 45k-80k |
| STL/CSV parsing and visualization | 55k-95k |
| Parallel runner, hardware mocks, backpropagation | 55k-90k |
| Integration, debugging, packaging | 70k-120k |
| README, report, evidence, final audit | 35k-60k |
| **Total expected** | **315k-540k tokens** |

Plan for roughly **400k tokens**, with **550k as an upper safety estimate** if debugging is difficult. Hidden reasoning and repeated repository context make the total larger than the visible chat text.

### Allocation across the remaining five-hour windows

- **Window 1, 17:30-22:30:** 40% of usage. Complete scaffolding, FEA, importers, and the first integrated path.
- **Window 2, 22:30-03:30:** 40% of usage. Complete remaining tasks, integration, Windows packaging, and verification.
- **Window 3, 03:30-06:00:** reserve 20%. Documentation, evidence, final audit, ZIP test, and emergency fixes only.

Check **ChatGPT Settings -> Usage** at each checkpoint. The official documentation confirms that the five-hour allowance is shared across apps using the same Plus plan; there is no separate allowance for each app.

## 9. How to reduce wasted model usage

- Keep one implementation chat and one repository rather than starting many chats with repeated context.
- Store `STATUS.md` in the repository with completed work, failing commands, and the next three actions.
- Ask the agent to implement and verify one time-boxed milestone at a time.
- Request concise updates and file edits, not long tutorials.
- Run local tests and provide exact error output instead of asking the model to guess.
- Commit after every passing milestone so recovery is cheap.
- Generate report tables and plots from saved CSV data rather than typing results manually.
- Never fabricate timings, clean-machine tests, commits, screenshots, or hardware behavior.

## 10. Evidence checklist

- [ ] `Launch.exe` starts from a freshly extracted ZIP.
- [ ] Four UI views are present and usable.
- [ ] STL and temperature CSV sample provenance, units, and schemas are documented.
- [ ] Malformed, non-finite, and empty files have clear test evidence.
- [ ] FEA runs for 10, 20, 40, and 80 elements.
- [ ] Analytical comparison uses FE interpolation at element midpoints.
- [ ] Convergence plot and underlying CSV are included.
- [ ] Serial/parallel results agree within 1e-8 C.
- [ ] Hardware diagram, interface table, mocks, simulated label, and recovery are included.
- [ ] Handwritten two-page backpropagation appendix is legible.
- [ ] Gradient checks meet 1e-5 absolute error and loss plot covers 100 steps.
- [ ] Five-run median benchmark data, CPU/RAM/compiler/flags, speedup, and efficiency are reported.
- [ ] README covers prerequisites, one-click use, architecture, formats, tests/build, and limitations.
- [ ] Report is at most six pages, excluding the handwritten appendix.
- [ ] AI-use log names the model/tools, representative prompts, outputs, edits, validation, and at least one incorrect or unsuitable suggestion plus its outcome.
- [ ] Ownership statement separates original and reused work.
- [ ] Dependency versions, licenses, and data provenance are included.
- [ ] Git bundle or local repository and readable commit log are included.
- [ ] Demo video is 3-5 minutes, or a timestamped screenshot walkthrough with logs is included.
- [ ] Final archive is named `CandidateID_Workbench.zip` and contains no credentials or machine-specific absolute paths.

## 11. Suggested demo sequence

1. Extract the ZIP and double-click `Launch.exe`.
2. Load the sample ASCII STL; rotate, pan, zoom, and fit it.
3. Load the temperature CSV; show the colour legend, units, and node inspection.
4. Run the N=10/20/40/80 FEA study; export and open the results.
5. Run serial and parallel batches; show agreement and the saved timing table.
6. Connect the simulated microcontroller, FPGA, and JTAG adapter; trigger and recover from the timeout.
7. Show the backpropagation gradient-check and loss results.
8. End on the README, tests, report, AI-use disclosure, and known limitations.

