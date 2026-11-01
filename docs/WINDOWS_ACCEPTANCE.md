# Windows 11 x64 acceptance procedure

This is an unperformed candidate procedure. Do not treat this document as a completed test record.

1. Confirm the laptop runs Windows 11 x64. Record its Windows version, CPU and RAM.
2. Copy the final ZIP to the laptop and extract the entire archive to a new writable folder. Keep the subfolders together.
3. Disconnect internet access if convenient to demonstrate offline operation. No installation, administrator session, editor, terminal command or first-run build should be necessary.
4. Double-click Launch.exe. Time from the double-click until the browser interface shows the C++ ready status and accepts interaction. Record this separately from compute time. Keep the console open. Record any Windows protection message or launch error accurately. The supplied Mac launch metric measures backend/HTML readiness and excludes browser visual startup.
5. Open Verification & evidence. Run C++ verification and export its JSON. Record the build target and measured checks. A target label is not proof that the machine is Windows 11; record the actual OS separately.
6. Load sample STL; exercise rotate, Shift-drag pan, wheel zoom and Fit. Load the synthetic CSV, inspect a point and search/select a node in the table.
7. Run the required thermal study. Check endpoint temperatures, the four midpoint errors and factor-four reduction. Export temperature and convergence CSVs and open them.
8. Run a benchmark. Verify complete results and raw timing export. Start a larger batch, cancel it, and check that previous complete results remain available.
9. Inspect/connect/telemetry/timeout/reconnect for each simulated hardware type. Confirm they remain labelled simulated and the log records the actions.
10. Run backpropagation and inspect finite-difference agreement and the loss plot. Export CSV.
11. Use the supplied VS Code task, if VS Code is available, to start the packaged executable. No editor extension is required. The standalone test in step 4 must already succeed independently.
12. Close the console and confirm the server stops. Record results and screenshots, plus every failure/fix. Do not describe a failed or unperformed step as passed.

## Record template

- Tester / date / local time:
- Windows version and architecture:
- CPU / logical cores / RAM:
- Extracted folder and archive SHA256:
- Double-click standalone launch: PASS / FAIL / NOT RUN
- Internet disabled during launch: YES / NO
- Editor task: PASS / FAIL / NOT RUN
- Workflow and CSV export outcomes:
- Verification JSON filename:
- Screenshot/video filenames:
- Errors, fixes and retest outcomes:

The archive has an unsigned executable. If Windows or organisational policy blocks execution, record the exact message and resolve it through the candidate's normal trusted workflow; do not weaken system security settings as part of this test.
