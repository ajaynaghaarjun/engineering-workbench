#pragma once
#include "core.hpp"

namespace wb {
struct Profile {
    Thermal field;
    Peak maximum;
    double limit, margin;
    bool withinLimit;
    std::vector<Probe> stations;
};
Profile inspectProfile(const Rod &, double limit, std::size_t stations);
std::string profileJson(const Rod &, double limit, std::size_t stations);
} // namespace wb
