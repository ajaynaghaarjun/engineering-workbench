# Scenario workspace and demonstration tools

All thermal solves, sweeps and comparison differences execute in C++. Browser storage contains presentation configuration and notes only. Earlier required views remain available.

1. Solve a rod in Thermal Analysis. Open Scenario workspace, enter a name and save the displayed analysis. This saves the parameters of the result, even if the form has since changed.
2. Save up to 12 scenarios. Restore only fills inputs; Re-run selected performs a fresh C++ solve and displays it. Delete selected removes local configuration. Export the library for a readable configuration record; JSON-file reimport is not implemented.
3. Choose A and B and compare. The table reports B minus A for analytical peak, midpoint error and generated power. The chart overlays FEM curves in absolute metres, so rods with different lengths have different endpoints. Export JSON includes both full results and names.
4. Set baseline parameters in Thermal Analysis, then open Parameter sweep. Choose conductivity, volumetric heat source, length or area. Set increasing positive multipliers in [0.001,100] and 2-9 cases. Each case uses the same mesh count, capped at 10000. Source sign is preserved; a zero source remains zero. The plot shows continuous analytical peak versus multiplier. CSV includes the property value and thermal metrics; JSON also includes the full baseline.
5. Manually edited thermal inputs are saved as a browser draft. Restore last input draft fills the form without changing displayed results. Always solve again to update results.
6. Experiment notes save as you type, up to 4000 characters, and can be exported as plain text.
7. Save chart PNG exports the current canvas. Geometry, thermal, convergence, flux, loss, comparison and sweep canvases have controls. Generate a chart first. PNGs contain chart pixels; pair them with JSON/CSV for parameters and units.
8. Expand chart uses the browser fullscreen API where available; Escape exits. Print current view opens the normal browser print dialog and hides navigation/action controls. High contrast persists in this browser. Alt/Option+1-7 switches views while focus is outside inputs; platform shortcuts may take precedence.

## Temperature limits and profiles (v1.7)

Solve a rod, then use Temperature limit & sampled profile at the bottom of Scenario workspace. Enter an upper limit and 2-101 uniform stations. The panel assesses the displayed analysis parameters; later form edits do not change it. A new displayed analysis invalidates old profile evidence. Inspection supports up to 10000 elements.

The global result compares the continuous analytical peak against your limit, with margin = limit minus peak. Equality counts as within the limit using the computed floating-point values. Uniform samples may miss an interior maximum; the global assessment does not depend on hitting that point. A result applies only to this steady constant-property 1D model.

Station tables include FEM/exact temperatures, absolute error, flux and element index, plus separate above-limit flags. Filtering affects the table only; charts and CSV retain all stations. At an internal node, flux is taken from the element on the right (within floating-point coordinate tolerance); at x=L the last element is used. Two plots show temperature/limit and absolute error. JSON includes the full analysis and limit; CSV contains all stations; PNG exports the error plot.

Rename selected uses the scenario-name input as the new name. Duplicate selected copies parameters into a new saved item, using the entered name or a copy suffix. The 12-item cap still applies. Previously completed/exported comparisons retain the names captured when they ran.

## Persistence and verification limits

Storage is local to a browser profile and exact localhost origin/port. Changing ports, clearing storage or using private browsing may hide or discard earlier configuration. Storage failure shows an error and the current session remains usable. Export important work; local browser storage is not a backup or submission record.

The C++ calculations and served assets are covered by core/API tests. New presentation controls have syntax/source review, but visual behaviour, storage/fullscreen/printing and browser downloads have not been exercised in this enhancement pass because local browser automation is disabled in Work settings. Windows execution remains unverified. Do not label these controls as browser-acceptance tested.
