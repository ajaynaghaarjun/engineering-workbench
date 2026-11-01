#pragma once
#include "core.hpp"

namespace wb {
struct SweepRow {
    double factor, value, peakTemperature, peakX, midpointError, generatedHeat, imbalance;
};
std::vector<SweepRow> sweep(const Rod &, const std::string &parameter, double start, double end,
                            std::size_t samples);
std::string sweepJson(const Rod &, const std::string &, double, double, std::size_t);
std::string comparisonJson(const Rod &, const Rod &);
} // namespace wb
