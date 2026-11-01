# AI assistance and judgement log

## Models and tools used

- Planning conversation: GPT-5.6 Sol; later model-selection discussion and implementation session: GPT-6.1 Sol as identified by the environment.
- Codex tools: terminal, file patches, browser inspection, official documentation search, PDF rendering.
- Build/test tools: CMake, Apple Clang, MinGW-w64, Node integration tests. ReportLab produces documentation and labelled plots only.

## Representative real requests and resulting work

1. Candidate requested a deadline-based plan from the company PDF, with Plus usage and medium/high reasoning guidance. Output: execution plan and priority gates.
2. Candidate requested checkpoints with debugging, review and fixes because they could inspect only 2-6 times. Output: six-stage verification process.
3. Candidate confirmed Mac development and access to a Windows laptop. Output: portable C++ design and Windows cross-build route.
4. Candidate said “Start working.” Output: source implementation, tests, browser UI, data and documentation.
5. Candidate said “DO not ask me anythig I won't be avilable . do what is nessary in a safer way.” Output: autonomous local development; no account creation, external publication, or submission was performed.

## AI-generated work and edits

The C++ implementation, HTML/CSS/JavaScript, sample files, tests, report draft, calculations and documentation were generated with substantial AI assistance. Candidate review and understanding are still required. The assistant compiled Mac and Windows targets, ran core and API tests, inspected browser workflows, and corrected findings recorded below.

## Incorrect or unsuitable suggestions identified

- The first architecture proposed cpp-httplib and Three.js. A dependency-free local server and Canvas renderer were implemented instead to avoid external frontend/runtime dependencies. The simplified server and renderer have documented scope limits.
- An initial generic UI success message said results were “verified” after every successful response. This overstated verification and overwrote the timeout message. It was changed to say the operation completed, and it preserves actionable timeout errors.
- Review found `Math.min(...largeArray)` / `Math.max(...largeArray)` could fail for large thermal meshes. Extrema now use iteration; import count limits also bound interactive rendering.
- The initial batch generator used standard-library real distributions, whose exact mapping is not portable across libraries. It now uses explicit integer-to-double mapping from a fixed mt19937 seed.
- Early checkpoint reporting depended on executable cross-build. It is explicitly labelled build-only evidence; Windows runtime success is not claimed.
- Formatting reordered Windows headers and broke the rebuild. Header order is now explicitly preserved (winsock2, windows, shellapi); the Windows target was rebuilt successfully.
- A browser test exposed that the API helper threw on a recoverable timeout payload before the UI could update device state. It now distinguishes HTTP failures from recoverable device messages; the browser shows disconnected status and reconnect recovery correctly.

## Independent validation within the development session

FEA results are compared to the analytical expression and the expected interpolation error q h^2/(8k), rather than only testing self-consistency. Backpropagation gradients are compared to central finite differences. Serial/parallel comparisons cover every nodal temperature, not just a checksum. Invalid input tests and HTTP workflow tests exercise failure paths. Browser screenshots show observed application state.

## Candidate review still needed

## Enhancement request

The candidate asked to add more features and enhance the project after the initial package. Version 1.1 adds numerical diagnostics, custom studies, richer inspection/exports, bounded cancellation and progress. New checks independently verify boundary heat flow/energy balance, mesh area/bounds, temperature summaries, live cancellation and restart. The original archive was preserved as a fallback. No physical hardware or Windows-runtime success was added to the claims.

The candidate must understand and defend the source, confirm actual Windows launch, write the handwritten appendix, and confirm ownership and actual personal effort. These actions have not been invented or attributed to the candidate.
