#include "core.hpp"
#include "studies.hpp"
#include "verification.hpp"
#include <cmath>
#include <functional>
#include <iostream>
#include <limits>
#include <stdexcept>
int checks = 0;
void check(bool ok, const char *message) {
    ++checks;
    if (!ok)
        throw std::runtime_error(message);
}
void rejects(std::function<void()> f) {
    bool caught = false;
    try {
        f();
    } catch (const std::exception &) {
        caught = true;
    }
    check(caught, "Invalid input was accepted");
}
int main() {
    try {
        double previous = 0;
        auto sweep = wb::sweep(wb::Rod{}, "k", .5, 2, 3);
        check(sweep.size() == 3 && sweep.front().value == 5 && sweep.back().value == 20,
              "Sweep uses requested multipliers and property");
        check(std::abs(sweep.front().midpointError - .625) < 1e-8 &&
                  std::abs(sweep.back().midpointError - .15625) < 1e-8,
              "Conductivity sweep independently follows inverse-k midpoint error");
        check(std::abs(sweep.back().peakTemperature - 128.9) < 1e-9,
              "Conductivity sweep has expected continuous maximum");
        auto areaSweep = wb::sweep(wb::Rod{}, "area", .5, 2, 2);
        check(std::abs(areaSweep[0].peakTemperature - areaSweep[1].peakTemperature) < 1e-8 &&
                  std::abs(areaSweep[1].generatedHeat - 2) < 1e-12,
              "Area changes power, not the constant-property temperature profile");
        rejects([] { wb::sweep(wb::Rod{}, "unknown", .5, 2, 5); });
        rejects([] { wb::sweep(wb::Rod{}, "k", 2, 1, 5); });
        rejects([] { wb::sweep(wb::Rod{}, "k", .5, 2, 10); });
        rejects([] { wb::sweep(wb::Rod{}, "q", 0, 2, 2); });
        auto lengthSweep = wb::sweep(wb::Rod{}, "length", .5, 2, 2);
        check(std::abs(lengthSweep[1].midpointError - 1.25) < 1e-8 &&
                  std::abs(lengthSweep[1].generatedHeat - 2) < 1e-12,
              "Length sweep has quadratic error and linear power scaling");
        auto zeroSource = wb::Rod{};
        zeroSource.heat = 0;
        const auto zeroSweep = wb::sweep(zeroSource, "q", .5, 2, 2);
        check(zeroSweep[0].generatedHeat == 0 && zeroSweep[1].midpointError < 1e-8,
              "Scaling a zero source preserves the linear rod");
        auto largeStudy = wb::Rod{};
        largeStudy.elements = 10001;
        rejects([&] { wb::comparisonJson(largeStudy, wb::Rod{}); });
        const auto first = wb::element(wb::Rod{}, 0), next = wb::element(wb::Rod{}, 1);
        check(std::abs(first.stiffness[0] - .02) < 1e-15 &&
                  first.stiffness[1] == -first.stiffness[0] &&
                  first.stiffness[2] == first.stiffness[1] &&
                  first.stiffness[3] == first.stiffness[0],
              "Element stiffness and symmetry");
        check(std::abs(first.load[0] - .025) < 1e-15 && first.load[0] == first.load[1],
              "Consistent half-element source loads");
        check(std::abs(first.balance[1] + next.balance[0]) < 1e-12,
              "Neighbouring element contributions assemble to zero at free nodes");
        check(std::abs(first.balance[0] + .42) < 1e-12,
              "Boundary element contribution is the signed reaction");
        check(std::abs(first.flux + 3950) < 1e-8, "Element heat flux direction");
        rejects([] { wb::element(wb::Rod{}, 20); });
        auto peakRod = wb::Rod{};
        auto hot = wb::peak(peakRod, wb::solve(peakRod));
        check(std::abs(hot.analyticalX - .42) < 1e-12 &&
                  std::abs(hot.analyticalTemperature - 188.2) < 1e-10,
              "Analytical peak lies between nodes");
        check(std::abs(hot.feX - .4) < 1e-12 && std::abs(hot.feTemperature - 188) < 1e-9,
              "Piecewise linear FE peak is a nodal maximum");
        peakRod.heat = 0;
        peakRod.left = 20;
        peakRod.right = 100;
        hot = wb::peak(peakRod, wb::solve(peakRod));
        check(hot.analyticalX == 1 && hot.analyticalTemperature == 100,
              "Linear rod peaks at hotter boundary");
        peakRod.heat = -10000;
        peakRod.right = 20;
        hot = wb::peak(peakRod, wb::solve(peakRod));
        check(hot.analyticalX == 0 && hot.analyticalTemperature == 20,
              "Convex cooling profile maximum remains a boundary");
        rejects([] { wb::peak(wb::Rod{}, wb::Thermal{}); });
        check(wb::accuracyJson(wb::Rod{}, 1).find("\"elements\":12") != std::string::npos,
              "Accuracy selection rounds up to the smallest sufficient uniform mesh");
        rejects([] { wb::accuracyJson(wb::Rod{}, 0); });
        rejects([] { wb::accuracyJson(wb::Rod{}, -1); });
        rejects([] { wb::accuracyJson(wb::Rod{}, std::numeric_limits<double>::infinity()); });
        rejects([] { wb::accuracyJson(wb::Rod{}, 1e-20); });
        auto invalidRod = wb::Rod{};
        invalidRod.conductivity = 0;
        rejects([&] { wb::accuracyJson(invalidRod, 1); });
        auto extreme = wb::Rod{};
        extreme.length = 1e-200;
        extreme.area = 1e-300;
        extreme.conductivity = 1e200;
        extreme.heat = 0;
        extreme.elements = 2;
        rejects([&] { wb::solve(extreme); }); // Finite temperatures can still yield infinite flux.
        for (int n : {10, 20, 40, 80}) {
            wb::Rod r;
            r.elements = n;
            auto t = wb::solve(r);
            check(t.temperature.front() == 100 && t.temperature.back() == 20,
                  "Boundary conditions");
            for (std::size_t i = 0; i < t.x.size(); ++i)
                check(std::abs(t.temperature[i] - wb::exact(r, t.x[i])) < 1e-8,
                      "Analytical nodal agreement");
            double expected = r.heat / (8 * r.conductivity) * std::pow(r.length / n, 2);
            check(std::abs(t.midpointError - expected) < 1e-8, "Midpoint interpolation error");
            if (previous)
                check(std::abs(previous / t.midpointError - 4) < 1e-6, "Second-order convergence");
            previous = t.midpointError;
            check(std::abs(t.leftOutflow - .42) < 1e-9, "Left boundary reaction heat flow");
            check(std::abs(t.rightOutflow - .58) < 1e-9, "Right boundary reaction heat flow");
            check(std::abs(t.leftOutflow + t.rightOutflow - t.generatedHeat) < 1e-9,
                  "Global energy conservation");
            check(t.residual < 1e-9, "Assembled interior equation residual");
        }
        wb::Rod r;
        r.heat = 0;
        r.left = -20;
        r.right = 80;
        r.length = 2;
        auto t = wb::solve(r);
        check(std::abs(t.temperature[10] - 30) < 1e-10 && std::abs(t.leftOutflow - .05) < 1e-10 &&
                  std::abs(t.rightOutflow + .05) < 1e-10,
              "Zero-source linear solution and signed boundary heat flows");
        r.conductivity = 0;
        rejects([&] { wb::solve(r); });
        r.conductivity = 10;
        r.elements = 1;
        rejects([&] { wb::solve(r); });
        std::string stl = "solid test\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 "
                          "0\nvertex 0 1 0\nendloop\nendfacet\nendsolid test\n";
        check(wb::parseStl(stl).size() == 3, "ASCII STL triangle");
        rejects([] { wb::parseStl(""); });
        rejects([] { wb::parseStl("solid empty\nendsolid empty"); });
        rejects([&] { wb::parseStl(stl + "junk"); });
        rejects([] { wb::parseStl("solid bad\nfacet normal nan 0 1"); });
        std::string header = "node_id,x_m,y_m,z_m,temperature_C\n";
        check(wb::parseCsv(header + "1,0,1,2,100\n2,1,2,3,20\n").size() == 2, "CSV import");
        rejects([&] { wb::parseCsv(header); });
        rejects([&] { wb::parseCsv(header + "1,0,0,0,nan"); });
        rejects([&] { wb::parseCsv(header + "1,0,0,0,20\n1,0,0,0,30"); });
        rejects([&] { wb::parseCsv(header + "1,0,0,0,20,"); });
        rejects([&] { wb::parseCsv(header + "1,0,0,0,20junk"); });
        std::string many = header;
        for (int i = 0; i < 10000; ++i)
            many += std::to_string(i) + ",0,0,0,20\n";
        check(wb::parseCsv(many).size() == 10000, "CSV supported node limit");
        rejects([&] { wb::parseCsv(many + "10000,0,0,0,20\n"); });
        rejects([&] { wb::parseCsv(header + "1,1e300,0,0,20\n"); });
        rejects([] { wb::parseCsv(std::string(20 * 1024 * 1024 + 1, 'x')); });
        rejects([] { wb::parseStl(std::string(20 * 1024 * 1024 + 1, 'x')); });
        std::string triangles = "solid boundary\n";
        const std::string facet = "facet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 "
                                  "0\nvertex 0 1 0\nendloop\nendfacet\n";
        for (int i = 0; i < 10000; ++i)
            triangles += facet;
        check(wb::parseStl(triangles + "endsolid boundary\n").size() == 30000,
              "STL supported triangle limit");
        rejects([&] { wb::parseStl(triangles + facet + "endsolid boundary\n"); });
        auto b = wb::backprop();
        auto point = wb::probe(wb::Rod{}, .525);
        check(std::abs(point.error - .3125) < 1e-9, "Probe uses FE interpolation between nodes");
        check(std::abs(point.flux - 1050) < 1e-7, "Probe reports element heat flux");
        check(wb::probe(wb::Rod{}, 1).temperature == 20, "Probe at right boundary");
        rejects([] { wb::probe(wb::Rod{}, 1.01); });
        check(b.maxError < 1e-5, "Gradient finite-difference agreement");
        check(b.loss.size() == 101, "One update plus 100 subsequent steps");
        check(b.loss.back() < 1e-12, "Loss convergence");
        for (std::size_t i = 1; i < b.loss.size(); ++i)
            check(b.loss[i] <= b.loss[i - 1] + 1e-15, "Loss increases");
        auto rows = wb::benchmark(20, 40);
        std::atomic<bool> cancelled{true};
        rejects([&] { wb::benchmark(20, 40, &cancelled); });
        cancelled = false;
        std::atomic<std::size_t> completed{0};
        auto counted = wb::benchmark(20, 40, &cancelled, &completed);
        check(completed == 20 * (1 + 6 * counted.size()),
              "Benchmark progress covers reference warmups and measured solves");
        check(!rows.empty(), "Benchmark output");
        for (auto &row : rows) {
            check(row.samples.size() == 5, "Five timing repetitions");
            check(row.difference <= 1e-8, "Serial/parallel agreement");
            check(row.median > 0 && row.speedup > 0, "Valid timings");
        }
        const auto report = wb::verifyNumerics();
        check(report.size() == 10, "Runtime verification covers ten named checks");
        for (const auto &item : report)
            check(item.passed(), item.name.c_str());
        check(
            !wb::VerificationCheck{"nonfinite", "", std::numeric_limits<double>::quiet_NaN(), 1e-8}
                 .passed(),
            "Verification rejects non-finite errors");
        check(!wb::VerificationCheck{"excessive", "", 1, 1e-8}.passed(),
              "Verification fails errors above tolerance");
        std::cout << "PASS: " << checks << " checks\n";
        return 0;
    } catch (const std::exception &e) {
        std::cerr << "FAIL after " << checks << " checks: " << e.what() << '\n';
        return 1;
    }
}
