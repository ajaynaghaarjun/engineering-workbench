#include "studies.hpp"
#include <cmath>
#include <iomanip>
#include <sstream>
#include <stdexcept>

namespace wb {
std::vector<SweepRow> sweep(const Rod &base, const std::string &parameter, double start, double end,
                            std::size_t samples) {
    if (parameter != "k" && parameter != "q" && parameter != "length" && parameter != "area")
        throw std::runtime_error("Sweep parameter must be k, q, length or area.");
    if (!std::isfinite(start) || !std::isfinite(end) || start <= 0 || end <= start || end > 100 ||
        start < .001 || samples < 2 || samples > 9 || base.elements > 10000)
        throw std::runtime_error("Sweep needs 2-9 samples, increasing factors in [0.001,100] and "
                                 "at most 10000 elements.");
    solve(base); // Validate the unmodified baseline as well as each scaled case.
    std::vector<SweepRow> rows;
    for (std::size_t i = 0; i < samples; ++i) {
        const double factor = start + (end - start) * i / (samples - 1);
        Rod r = base;
        double *value = parameter == "k"        ? &r.conductivity
                        : parameter == "q"      ? &r.heat
                        : parameter == "length" ? &r.length
                                                : &r.area;
        *value *= factor;
        const auto result = solve(r);
        const auto hot = peak(r, result);
        rows.push_back({factor, *value, hot.analyticalTemperature, hot.analyticalX,
                        result.midpointError, result.generatedHeat,
                        std::abs(result.leftOutflow + result.rightOutflow - result.generatedHeat)});
    }
    return rows;
}
std::string sweepJson(const Rod &base, const std::string &parameter, double start, double end,
                      std::size_t samples) {
    const auto rows = sweep(base, parameter, start, end, samples);
    std::ostringstream s;
    s << std::setprecision(17) << "{\"parameter\":" << quote(parameter)
      << ",\"baseline\":" << thermalJson(base, solve(base)) << ",\"rows\":[";
    for (std::size_t i = 0; i < rows.size(); ++i) {
        if (i)
            s << ',';
        const auto &r = rows[i];
        s << "{\"factor\":" << r.factor << ",\"parameter_value\":" << r.value
          << ",\"analytical_peak_C\":" << r.peakTemperature << ",\"peak_x_m\":" << r.peakX
          << ",\"midpoint_error_C\":" << r.midpointError
          << ",\"generated_heat_W\":" << r.generatedHeat
          << ",\"energy_imbalance_W\":" << r.imbalance << '}';
    }
    return s.str() + "]}";
}
std::string comparisonJson(const Rod &a, const Rod &b) {
    if (a.elements > 10000 || b.elements > 10000)
        throw std::runtime_error("Comparison supports at most 10000 elements per scenario.");
    const auto ta = solve(a), tb = solve(b);
    const auto pa = peak(a, ta), pb = peak(b, tb);
    const double peakDelta = pb.analyticalTemperature - pa.analyticalTemperature,
                 errorDelta = tb.midpointError - ta.midpointError,
                 heatDelta = tb.generatedHeat - ta.generatedHeat;
    if (!std::isfinite(peakDelta) || !std::isfinite(errorDelta) || !std::isfinite(heatDelta))
        throw std::runtime_error(
            "Scenario differences exceed numerical range. Rescale the inputs.");
    std::ostringstream s;
    s << std::setprecision(17) << "{\"a\":" << thermalJson(a, ta) << ",\"b\":" << thermalJson(b, tb)
      << ",\"difference_B_minus_A\":{\"analytical_peak_C\":" << peakDelta
      << ",\"midpoint_error_C\":" << errorDelta << ",\"generated_heat_W\":" << heatDelta << "}}";
    return s.str();
}
} // namespace wb
