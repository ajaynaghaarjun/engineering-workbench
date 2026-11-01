#include "core.hpp"
#include <cmath>
#include <functional>
#include <iostream>
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
        }
        wb::Rod r;
        r.heat = 0;
        r.left = -20;
        r.right = 80;
        r.length = 2;
        auto t = wb::solve(r);
        check(std::abs(t.temperature[10] - 30) < 1e-10, "Zero-source linear solution");
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
        check(b.maxError < 1e-5, "Gradient finite-difference agreement");
        check(b.loss.size() == 101, "One update plus 100 subsequent steps");
        check(b.loss.back() < 1e-12, "Loss convergence");
        for (std::size_t i = 1; i < b.loss.size(); ++i)
            check(b.loss[i] <= b.loss[i - 1] + 1e-15, "Loss increases");
        auto rows = wb::benchmark(20, 40);
        check(!rows.empty(), "Benchmark output");
        for (auto &row : rows) {
            check(row.samples.size() == 5, "Five timing repetitions");
            check(row.difference <= 1e-8, "Serial/parallel agreement");
            check(row.median > 0 && row.speedup > 0, "Valid timings");
        }
        std::cout << "PASS: " << checks << " checks\n";
        return 0;
    } catch (const std::exception &e) {
        std::cerr << "FAIL after " << checks << " checks: " << e.what() << '\n';
        return 1;
    }
}
