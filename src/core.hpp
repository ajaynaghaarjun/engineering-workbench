#pragma once
#include <array>
#include <atomic>
#include <cstddef>
#include <string>
#include <vector>

namespace wb {
struct Rod {
    double length = 1, area = 1e-4, conductivity = 10, heat = 10000, left = 100, right = 20;
    std::size_t elements = 20;
};
struct Thermal {
    std::vector<double> x, temperature;
    double midpointError = 0;
    double nodalError = 0, residual = 0, leftOutflow = 0, rightOutflow = 0, generatedHeat = 0;
};
double exact(const Rod &, double);
Thermal solve(const Rod &);
std::string thermalJson(const Rod &, const Thermal &);
// Uniform mesh selection for the supported constant-property rod, followed by a real FEM solve.
std::string accuracyJson(Rod, double targetError);
struct Peak {
    double feX, feTemperature, analyticalX, analyticalTemperature;
};
// Input result must correspond to the supplied rod.
Peak peak(const Rod &, const Thermal &);
struct Element {
    std::size_t index;
    std::array<double, 2> x, temperature, load, balance;
    std::array<double, 4> stiffness; // Row-major, W/K.
    double flux;
};
Element element(const Rod &, std::size_t index);
std::string elementJson(const Rod &, const Element &);
struct Probe {
    double x, temperature, exactTemperature, error, flux;
    std::size_t element;
};
Probe probe(const Rod &, double x);
// Reuse a matching solved field for multi-point inspection.
Probe probe(const Rod &, const Thermal &, double x);
std::string probeJson(const Probe &);
struct Vertex {
    double x, y, z;
};
struct Node {
    double id, x, y, z, t;
};
std::vector<Vertex> parseStl(const std::string &);
std::vector<Node> parseCsv(const std::string &);
std::string geometryJson(const std::vector<Vertex> &);
std::string nodesJson(const std::vector<Node> &);
struct Benchmark {
    unsigned workers;
    std::vector<double> samples;
    double median, speedup, efficiency, difference;
};
std::vector<Benchmark> benchmark(std::size_t count, std::size_t elements,
                                 const std::atomic<bool> *cancel = nullptr,
                                 std::atomic<std::size_t> *completed = nullptr);
std::string benchmarkJson(const std::vector<Benchmark> &, std::size_t, std::size_t);
struct Backprop {
    std::array<double, 4> gradient, numerical, updated;
    std::vector<double> loss;
    double initialLoss, hidden, prediction, maxError;
};
Backprop backprop();
std::string backpropJson(const Backprop &);
std::string quote(const std::string &);
} // namespace wb
