# Prepare for the company's verification discussion

These are study prompts and verified explanations, not a claim that the candidate has learned them. Read the corresponding source and practise explaining each point aloud.

1. **What does the rod model assume?** Steady one-dimensional conduction, constant k and A, uniform volumetric q, insulated sides, prescribed end temperatures. It cannot model multidimensional geometry or transient behaviour.
2. **Where do the element terms come from?** Linear shape functions yield K_e=(kA/h)[[1,-1],[-1,1]] and f_e=qAh/2[1,1]. Assemble shared-node contributions, move prescribed endpoint terms to neighbouring right-hand sides, then solve the tridiagonal system.
3. **Why check midpoints?** Uniform constant-source linear FEA reproduces the quadratic solution at nodes here, while the piecewise-linear field differs between nodes. The expected midpoint error is |q|h^2/(8k); halving h reduces it by four.
4. **Explain one physical check.** The default source generates qAL=1 W. Recovered outward boundary flows are 0.42 W and 0.58 W. Their sum must equal the source. Boundary reaction recovery includes half-element source terms.
5. **How does the probe work?** It solves the displayed rod in C++, finds the containing element and evaluates its two shape functions at the requested x. Flux is constant within a linear element. At x=0.525 m for N=20, FEA is 182.375 C, exact is 182.6875 C, and error is 0.3125 C.
6. **What is actually parallel?** Independent complete rod solves are distributed by an atomic case index to bounded worker threads. Each result goes to its fixed input-index slot. UI background work alone would not establish multicore computation.
7. **Why might speedup disappoint?** Thread startup, allocations, memory bandwidth, scheduling and short workloads add overhead. Report raw repetitions and medians honestly; full nodal comparisons establish correctness independently of timing.
8. **What happens on cancellation?** Workers check a cancellation flag between cases, finish active solves, join, and discard the partial batch. Earlier completed UI results are retained. This is cooperative cancellation, not arbitrary thread termination.
9. **How do file errors reach the user?** C++ rejects empty/malformed/non-finite input, duplicate IDs and documented size/count limits. HTTP transports an actionable error; the UI preserves the last valid result. STL itself has no unit metadata; the synthetic CSV has documented metres/Celsius.
10. **Why is JTAG not a third compute board?** A debug adapter bridges a host to a target's debug interface. It has different signals, ownership and voltage-reference needs. The selected STM32 uses SWD; Arty uses its supported onboard bridge. All app telemetry is simulated.
11. **Derive the gradients.** With e=y_hat-y and h=tanh(wx+b): dJ/dw=e*v*(1-h^2)*x; dJ/db=e*v*(1-h^2); dJ/dv=e*h; dJ/dc=e. Compute all gradients from the same old state before updating every parameter.
12. **How do you check AI output?** Compare FEA to an independent analytical expression, gradients to central differences, parallel results to serial nodal arrays, and errors to explicit tolerances. Give an actual corrected suggestion from AI_USE_LOG.md; do not invent one.

## Small changes to practise

- Inspect element 0: its diagonal stiffness is 0.02 W/K, each source load is 0.025 W, and its left nodal contribution is -0.42 W. Explain why adjacent element contributions cancel at an unconstrained interior node.
- Explain why the analytical maximum is at x=0.42 m while the 20-element piecewise-linear solution reaches its maximum at the x=0.40 m node. The derivative of the analytical profile vanishes at the continuous peak.
- Change the left/right temperatures and explain how the zero-source linear profile changes.
- Change q and predict the midpoint error and generated power before running the app.
- Add one negative CSV test and explain why the parser should reject it.
- Explain the difference between a successful cross-build and a successful Windows standalone launch.

Source map: core.cpp (solver/parsers/probe/batch/gradients), hardware.cpp (mock state/history), verification.cpp (numerical evidence checks), main.cpp (launcher/transport), web/app.js (interaction), web/evidence.js (rubric and verification presentation).
