#include "inspection.hpp"
#include <cmath>
#include <iomanip>
#include <sstream>
#include <stdexcept>

namespace wb {
Profile inspectProfile(const Rod &r, double limit, std::size_t stations) {
    if (!std::isfinite(limit) || stations < 2 || stations > 101 || r.elements > 10000)
        throw std::runtime_error("Inspection needs a finite temperature limit, 2-101 stations and "
                                 "at most 10000 elements.");
    Profile result;
    result.field = solve(r); // Solve once; interpolate all stations from the same field.
    result.maximum = peak(r, result.field);
    result.limit = limit;
    result.margin = limit - result.maximum.analyticalTemperature;
    if (!std::isfinite(result.margin))
        throw std::runtime_error("Temperature margin exceeds numerical range. Rescale inputs.");
    result.withinLimit = result.margin >= 0;
    result.stations.reserve(stations);
    for (std::size_t i = 0; i < stations; ++i) {
        const double x =
            i + 1 == stations ? r.length : r.length * (static_cast<double>(i) / (stations - 1));
        result.stations.push_back(probe(r, result.field, x));
    }
    return result;
}
std::string profileJson(const Rod &r, double limit, std::size_t stations) {
    const auto p = inspectProfile(r, limit, stations);
    std::ostringstream s;
    s << std::setprecision(17) << "{\"limit_C\":" << p.limit << ",\"margin_C\":" << p.margin
      << ",\"within_user_limit\":" << (p.withinLimit ? "true" : "false")
      << ",\"scope\":\"Assessment of this steady 1D constant-property model against your "
         "temperature limit; not a physical safety certification.\""
      << ",\"analysis\":" << thermalJson(r, p.field) << ",\"stations\":[";
    for (std::size_t i = 0; i < p.stations.size(); ++i) {
        if (i)
            s << ',';
        auto station = probeJson(p.stations[i]);
        station.pop_back();
        s << station
          << ",\"FEA_exceeds_limit\":" << (p.stations[i].temperature > limit ? "true" : "false")
          << ",\"analytical_exceeds_limit\":"
          << (p.stations[i].exactTemperature > limit ? "true" : "false") << '}';
    }
    return s.str() + "]}";
}
} // namespace wb
