#include "verification.hpp"
#include "core.hpp"
#include <algorithm>
#include <cmath>
#include <iomanip>
#include <sstream>
#include <thread>

namespace wb {
bool VerificationCheck::passed() const {
    return std::isfinite(error) && error <= tolerance;
}
std::vector<VerificationCheck> verifyNumerics() {
    double boundary = 0, nodal = 0, midpoint = 0, convergence = 0, energy = 0, residual = 0,
           previous = 0;
    for (unsigned n : {10u, 20u, 40u, 80u}) {
        Rod r;
        r.elements = n;
        const auto t = solve(r);
        boundary = std::max({boundary, std::abs(t.temperature.front() - r.left),
                             std::abs(t.temperature.back() - r.right)});
        nodal = std::max(nodal, t.nodalError);
        const double h = r.length / n;
        midpoint = std::max(
            midpoint, std::abs(t.midpointError - std::abs(r.heat) * h * h / (8 * r.conductivity)));
        if (previous)
            convergence = std::max(convergence, std::abs(previous / t.midpointError - 4));
        previous = t.midpointError;
        energy = std::max(energy, std::abs(t.leftOutflow + t.rightOutflow - t.generatedHeat));
        residual = std::max(residual, t.residual);
    }
    const auto b = backprop();
    double parallel = 0;
    for (const auto &row : benchmark(20, 40))
        parallel = std::max(parallel, row.difference);
    return {{"Prescribed boundary temperatures (C)",
             "Both rod endpoints retain their prescribed temperatures.", boundary, 1e-12},
            {"Analytical nodal agreement (C)",
             "All four meshes are compared against the exact quadratic solution.", nodal, 1e-8},
            {"Midpoint interpolation formula (C)",
             "Independent expected interpolation error is |q| h^2 / (8 k), not zero nodal error.",
             midpoint, 1e-8},
            {"Second-order mesh convergence (ratio error)",
             "Halving element length should reduce midpoint error by a factor of four.",
             convergence, 1e-6},
            {"Global energy conservation (W)",
             "Outward boundary heat flow must equal the integrated source q A L.", energy, 1e-9},
            {"Interior equilibrium residual (W)",
             "The original assembled equations are checked at interior nodes.", residual, 1e-9},
            {"Finite-difference gradient agreement",
             "Explicit chain-rule gradients are compared with central differences at epsilon=1e-6.",
             b.maxError, 1e-5},
            {"Training loss after 101 updates",
             "One initial simultaneous update plus 100 subsequent updates should fit this single "
             "sample.",
             b.loss.back(), 1e-12},
            {"Serial / parallel nodal agreement",
             "Every nodal temperature is compared; this small check does not replace the recorded "
             "performance benchmark.",
             parallel, 1e-8},
            {"Thermal probe at right endpoint (C)",
             "The endpoint probe must recover the prescribed right temperature exactly.",
             std::abs(probe(Rod{}, 1).temperature - 20), 1e-12}};
}
std::string verificationJson() {
    const auto checks = verifyNumerics();
    bool passed = true;
    for (const auto &c : checks)
        passed = passed && c.passed();
    std::string platform = "other", architecture = "other";
#ifdef _WIN32
    platform = "windows";
#elif defined(__APPLE__)
    platform = "macos";
#elif defined(__linux__)
    platform = "linux";
#endif
#if defined(_M_X64) || defined(__x86_64__)
    architecture = "x64";
#elif defined(__aarch64__) || defined(__arm64__)
    architecture = "arm64";
#endif
    std::ostringstream s;
    s << std::setprecision(17)
      << "{\"version\":\"1.3\",\"all_passed\":" << (passed ? "true" : "false")
      << ",\"platform\":" << quote(platform) << ",\"architecture\":" << quote(architecture)
      << ",\"logical_cpus\":" << std::thread::hardware_concurrency() << ",\"checks\":[";
    for (std::size_t i = 0; i < checks.size(); ++i) {
        if (i)
            s << ',';
        const auto &c = checks[i];
        s << "{\"name\":" << quote(c.name) << ",\"explanation\":" << quote(c.explanation)
          << ",\"error\":" << c.error << ",\"tolerance\":" << c.tolerance
          << ",\"passed\":" << (c.passed() ? "true" : "false") << '}';
    }
    s << "],\"scope\":\"Selected numerical checks in this running C++ process. This does not "
         "certify Windows clean-machine launch, UI correctness, handwritten work or a company "
         "score.\"}";
    return s.str();
}
} // namespace wb
