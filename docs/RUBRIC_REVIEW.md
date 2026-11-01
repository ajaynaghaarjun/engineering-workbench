# Rubric review - version 1.4

## Latest enhancement review

Accuracy-driven mesh selection extends the thermal/UI evidence: C++ selects a uniform mesh from |q|L²/(8kN²), runs the FEM solver, and reports measured target attainment. It handles negative/zero heat sources and rejects targets beyond the supported mesh limit. Input presets and JSON evidence export support reproducible exploration. This supplements the required four-mesh study.

This pass found and fixed a numerical-range defect: finite nodal temperatures could still produce infinite flux and invalid JSON. Such inputs now fail with an actionable range error; a core regression and HTTP scenario cover this case. The convergence table no longer reports an order when either error is dominated by roundoff. Current suite: 341 core checks and 26 HTTP scenarios. Browser automation is disabled in the current Work settings; the new controls have not been visually exercised. Previous screenshots are historical evidence. No score or outstanding gate status changes follow from these additions.

Basis: the company's three-page Unified Engineering Workbench brief, especially the 100-point rubric on page 3. This is an evidence audit, not a company grade or shortlist prediction. Extra features earn credit only when they improve a published criterion.

## Gate status

**Standalone Windows launch: UNVERIFIED.** A cross-compiled executable and passing Mac tests do not clear this gate. Both shortlist bands require a successful standalone launch and a working C++ backend, plus the stated minimum scores in C++ (6/12), thermal FEA (7/14) and delivery/report (3/6). Only the company can award those scores.

**Handwritten appendix: MISSING.** The typed guide and C++ checks do not satisfy the handwritten derivation subcriterion, worth four of the seven backpropagation points.

**Candidate understanding and ownership confirmation: PENDING.** AI assistance is permitted and disclosed. The candidate must still explain a function, reproduce a test and make a small change during verification.

## Criterion-by-criterion review

| Criterion | Max | Evidence available | Remaining gap / practical limitation |
|---|---:|---|---|
| Interface / webpage design | 8 | Coherent engineering tabs; parameter validation; status/errors; benchmark progress and safe cancellation; units, legends, node inspection, probes and exports; verification/evidence view | Full usability and export behaviour still need testing in the actual Windows browser. Large files use documented limits; renderer is deliberately basic. |
| C++ backend and testing | 12 | C++ owns numerical computation, parsing, concurrency, mock state and verification. Positive/negative/numerical tests, API tests and address/undefined-behaviour sanitizer checks are recorded. Verification can be rerun through the UI. | Small custom HTTP server supports a restricted subset. Review fixed malformed/duplicate length/header acceptance and method validation; this is not a production HTTP implementation. |
| Folder architecture | 6 | Separate core, hardware and verification modules; web presentation; tests/data/results/docs/licences; CMake and pinned observed toolchain versions | Transport/routing/evidence generation remain together in main.cpp. Additional splitting is a maintainability improvement, not necessary to prove functionality. |
| Code readability | 6 | Formatted C++; named data structures; domain-specific modules; meaningful comments on boundary reactions, concurrency and simulated behaviour | Main frontend file remains long. Verification view is separated into evidence.js. Candidate should be able to explain the larger functions without relying on generated prose. |
| Version control | 5 | Actual milestone commits, readable commit log and verified Git bundle; no backdating; build outputs excluded from development history | Compressed development timeline and a large first commit are visible. Commit count alone earns no credit; no earlier work is invented. |
| Thermal FEA and adoption | 14 | Correct element assembly and prescribed boundaries; analytical comparison; N=10/20/40/80; midpoint FE interpolation; factor-four convergence; CSV/plots; energy balance, residuals and C++ probe; assumptions and debugging insight | Candidate's interdisciplinary learning/understanding must be demonstrated personally. Diagnostics supplement the required solver; they do not replace explanation of the formulation. |
| CAD / ANSYS visualization | 10 | Both specified C++ importers; self-created STL and labelled synthetic CSV; provenance/schema/units; rotation/pan/zoom/fit, point colours/legend, inspection, search/highlight and malformed/non-finite rejection | Orthographic depth-sorted renderer can show painter-order artefacts with intersecting triangles. No registration, binary STL or native CAD/ANSYS formats is claimed. Imported STL units remain source-defined. |
| Multicore performance | 10 | Real independent C++ solves; bounded workers; fixed reproducible input mapping; 1/2/up-to-4 workers; warm-ups, five raw repetitions, medians, speedup/efficiency, full nodal agreement; environment/flags and separate launch timing | Results are Mac measurements and vary with scheduling/memory/thermal state. CLI evidence excludes optional UI progress-counter overhead. Launch timing is backend/HTML readiness, excluding browser visual startup; full Windows user-ready timing remains outstanding. No Windows speedup claim or minimum-speedup guarantee. |
| Embedded integration | 8 | Labelled design, interface/voltage table and vendor sources; distinct MCU/FPGA/debug mocks, discovery/capabilities, connect/disconnect, telemetry, timeout/recovery; sequenced events | Electrical harness and board-revision assumptions are documented but untested physically. Physical wiring is outside required scope. Mock values are not measurements or universal pinout guarantees. |
| Backpropagation | 7 | Explicit C++ gradients; central differences with epsilon=1e-6; error below 1e-5; simultaneous update; 100 subsequent steps; raw loss CSV/plot and typed derivation guide | Required handwritten forward pass/chain rule/update appendix remains absent. The C++ portion supports at most its three-point subcriterion without the handwritten evidence. |
| Prompt engineering / AI judgement | 8 | Model/tool disclosure, representative actual requests, corrected unsuitable suggestions, independent analytical/gradient checks and ownership draft | Candidate must review and defend the work, confirm original/reused contributions and actual personal effort. Automated test output is not proof of candidate understanding. |
| One-click delivery / report | 6 | Portable x64 Launch.exe, system-DLL import audit, source/CMake, editor task, six-page report, raw data/plots, timestamped walkthrough, Git bundle, hashes and archive/extracted-source checks | Actual clean Windows 11 x64 launch and editor task remain unverified. Candidate ID is a placeholder; handwritten file and final upload/receipt are still pending. |

Total published maximum: **100 points**. No numerical self-score is assigned because Windows execution, handwritten work and personal understanding remain material unknowns.

## Improvements made from this review

1. A new verification/evidence view runs ten named C++ numerical checks and exposes measured errors/tolerances, rather than displaying static success badges.
2. The view links the report, this review, Windows acceptance instructions and a concise defence guide; it explicitly lists pending submission gates.
3. Runtime checks distinguish numerical results from clean-machine delivery and company scoring. The build target shown in the UI is not an OS certification.
4. HTTP review added strict decimal Content-Length handling, duplicate-header rejection, unsupported transfer-encoding rejection and consistent API method checks; negative raw-request tests cover these paths.
5. Verification logic is in its own C++ module and its presentation in a separate JavaScript file.
6. CSV numeric-conversion failures now identify the data line and explain text/empty/range problems, instead of exposing cryptic standard-library conversion errors.

## Highest-value remaining actions

1. Perform and record the Windows acceptance procedure. This is the outstanding shortlist gate that more features cannot clear from the Mac.
2. Prepare the handwritten appendix from verified calculations and explain it in your own words.
3. Read the defence guide and reproduce at least the midpoint error, energy balance and gradient check yourself.
4. Confirm Candidate ID, actual effort, ownership/disclosure and the company's upload destination; submit before 06:00 IST on 2 November 2026.
