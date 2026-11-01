#include "core.hpp"
#include <algorithm>
#include <chrono>
#include <cmath>
#include <iomanip>
#include <limits>
#include <random>
#include <sstream>
#include <stdexcept>
#include <thread>

namespace wb {
namespace {
bool finite(double x) {
    return std::isfinite(x);
}
std::ostringstream stream() {
    std::ostringstream s;
    s << std::setprecision(17);
    return s;
}
void require(bool condition, const char *message) {
    if (!condition)
        throw std::runtime_error(message);
}
double number(const std::string &text) {
    std::size_t p = 0;
    double v;
    try {
        v = std::stod(text, &p);
    } catch (const std::invalid_argument &) {
        throw std::runtime_error(
            "Expected a numeric CSV value; remove text, empty fields or unsupported quoting.");
    } catch (const std::out_of_range &) {
        throw std::runtime_error("CSV number is outside the supported floating-point range.");
    }
    require(text.find_first_not_of(" \r\t", p) == std::string::npos && finite(v),
            "CSV values must be finite numbers.");
    return v;
}
double loss(const std::array<double, 4> &p) {
    double e = p[2] * std::tanh(p[0] + p[1]) + p[3] - 2;
    return .5 * e * e;
}
} // namespace
std::string quote(const std::string &s) {
    std::string o = "\"";
    for (unsigned char c : s) {
        if (c == '"' || c == '\\') {
            o += '\\';
            o += c;
        } else if (c == '\n')
            o += "\\n";
        else if (c == '\r')
            o += "\\r";
        else if (c == '\t')
            o += "\\t";
        else if (c >= 32)
            o += c;
    }
    return o + '"';
}
double exact(const Rod &r, double x) {
    return r.left + (r.right - r.left) * x / r.length +
           r.heat * x * (r.length - x) / (2 * r.conductivity);
}
Thermal solve(const Rod &r) {
    require(finite(r.length) && finite(r.area) && finite(r.conductivity) && finite(r.heat) &&
                finite(r.left) && finite(r.right),
            "Rod parameters must be finite.");
    require(r.length > 0 && r.area > 0 && r.conductivity > 0,
            "Length, area and conductivity must be positive.");
    require(r.elements >= 2 && r.elements <= 200000, "Elements must be between 2 and 200000.");
    const auto n = r.elements;
    double h = r.length / n, ke = r.conductivity * r.area / h, fe = r.heat * r.area * h / 2;
    require(finite(ke) && ke > 0 && finite(fe), "Parameters exceed numerical range.");
    std::vector<double> d(n + 1, 0), b(n + 1, 0), lower(n + 1, 0), upper(n + 1, 0);
    for (std::size_t e = 0; e < n; ++e) {
        d[e] += ke;
        d[e + 1] += ke;
        upper[e] -= ke;
        lower[e + 1] -= ke;
        b[e] += fe;
        b[e + 1] += fe;
    }
    b[1] -= lower[1] * r.left;
    lower[1] = 0;
    b[n - 1] -= upper[n - 1] * r.right;
    upper[n - 1] = 0;
    d[0] = d[n] = 1;
    upper[0] = lower[n] = 0;
    b[0] = r.left;
    b[n] = r.right;
    for (std::size_t i = 1; i <= n; ++i) {
        double m = lower[i] / d[i - 1];
        d[i] -= m * upper[i - 1];
        b[i] -= m * b[i - 1];
    }
    Thermal out;
    out.x.resize(n + 1);
    out.temperature.resize(n + 1);
    out.temperature[n] = b[n] / d[n];
    for (std::size_t i = n; i-- > 0;)
        out.temperature[i] = (b[i] - upper[i] * out.temperature[i + 1]) / d[i];
    for (std::size_t i = 0; i <= n; ++i) {
        out.x[i] = i * h;
        require(finite(out.temperature[i]) && finite(exact(r, out.x[i])),
                "Parameters exceed supported numerical range.");
        out.nodalError =
            std::max(out.nodalError, std::abs(out.temperature[i] - exact(r, out.x[i])));
        if (i > 0 && i < n)
            out.residual = std::max(out.residual,
                                    std::abs(ke * (2 * out.temperature[i] - out.temperature[i - 1] -
                                                   out.temperature[i + 1]) -
                                             2 * fe));
    }
    for (std::size_t i = 0; i < n; ++i) {
        const double error = std::abs(.5 * out.temperature[i] + .5 * out.temperature[i + 1] -
                                      exact(r, (i + .5) * h));
        require(finite(error), "Midpoint comparison exceeds numerical range.");
        out.midpointError = std::max(out.midpointError, error);
    }
    // Recover outward boundary heat flow from the original assembled boundary equations.
    // The half-element source contribution is essential for global conservation.
    out.leftOutflow = ke * (out.temperature[1] - out.temperature[0]) + fe;
    out.rightOutflow = ke * (out.temperature[n - 1] - out.temperature[n]) + fe;
    out.generatedHeat = r.heat * r.area * r.length;
    require(finite(out.generatedHeat) && finite(out.leftOutflow) && finite(out.rightOutflow) &&
                finite(out.residual),
            "Thermal diagnostics exceed numerical range.");
    return out;
}
Probe probe(const Rod &r, double x) {
    require(finite(x) && x >= 0 && x <= r.length,
            "Probe position must lie within the rod (0 to L).");
    const auto t = solve(r);
    const double h = r.length / r.elements;
    const auto element = std::min(r.elements - 1, static_cast<std::size_t>(x / h));
    const double local = x == r.length ? 1.0 : std::clamp((x - t.x[element]) / h, 0.0, 1.0);
    const double temperature =
        (1 - local) * t.temperature[element] + local * t.temperature[element + 1];
    const double analytical = exact(r, x);
    return {x,
            temperature,
            analytical,
            std::abs(temperature - analytical),
            -r.conductivity * (t.temperature[element + 1] - t.temperature[element]) / h,
            element};
}
std::string probeJson(const Probe &p) {
    auto s = stream();
    s << "{\"x_m\":" << p.x << ",\"FEA_C\":" << p.temperature
      << ",\"exact_C\":" << p.exactTemperature << ",\"absolute_error_C\":" << p.error
      << ",\"heat_flux_W_m2\":" << p.flux << ",\"element_index\":" << p.element << '}';
    return s.str();
}
std::string thermalJson(const Rod &r, const Thermal &t) {
    auto s = stream();
    s << "{\"elements\":" << r.elements << ",\"midpoint_error_C\":" << t.midpointError
      << ",\"parameters\":{\"length_m\":" << r.length << ",\"area_m2\":" << r.area
      << ",\"conductivity_W_mK\":" << r.conductivity << ",\"heat_generation_W_m3\":" << r.heat
      << ",\"left_C\":" << r.left << ",\"right_C\":" << r.right << "},\"nodes\":[";
    for (std::size_t i = 0; i < t.x.size(); ++i) {
        if (i)
            s << ',';
        s << '[' << t.x[i] << ',' << t.temperature[i] << ',' << exact(r, t.x[i]) << ']';
    }
    s << "],\"midpoints\":[";
    for (std::size_t i = 0; i < r.elements; ++i) {
        if (i)
            s << ',';
        double x = .5 * (t.x[i] + t.x[i + 1]);
        s << '[' << x << ',' << (.5 * t.temperature[i] + .5 * t.temperature[i + 1]) << ','
          << exact(r, x) << ']';
    }
    s << "],\"flux\":[";
    for (std::size_t i = 0; i < r.elements; ++i) {
        if (i)
            s << ',';
        const double flux =
            -r.conductivity * (t.temperature[i + 1] - t.temperature[i]) / (r.length / r.elements);
        require(finite(flux) && finite(flux * r.area), "Heat flux exceeds numerical range.");
        s << '[' << .5 * (t.x[i] + t.x[i + 1]) << ',' << flux << ',' << flux * r.area << ']';
    }
    s << "],\"diagnostics\":{\"nodal_error_C\":" << t.nodalError
      << ",\"max_residual_W\":" << t.residual << ",\"left_outflow_W\":" << t.leftOutflow
      << ",\"right_outflow_W\":" << t.rightOutflow << ",\"generated_heat_W\":" << t.generatedHeat
      << ",\"energy_imbalance_W\":" << std::abs(t.leftOutflow + t.rightOutflow - t.generatedHeat)
      << "}}";
    return s.str();
}
std::vector<Vertex> parseStl(const std::string &text) {
    require(!text.empty(), "STL file is empty.");
    require(text.size() <= 20 * 1024 * 1024, "STL exceeds the 20 MiB limit.");
    std::istringstream in(text);
    std::string token;
    require(bool(in >> token) && token == "solid", "Expected ASCII STL beginning with solid.");
    std::getline(in, token);
    std::vector<Vertex> v;
    bool ended = false;
    auto expect = [&](const char *word) {
        require(bool(in >> token) && token == word, "Malformed ASCII STL structure.");
    };
    while (in >> token) {
        if (token == "endsolid") {
            ended = true;
            std::getline(in, token);
            require(!(in >> token), "Unexpected content after endsolid.");
            break;
        }
        require(token == "facet", "Expected facet or endsolid.");
        expect("normal");
        double a, b, c;
        require(bool(in >> a >> b >> c) && finite(a) && finite(b) && finite(c),
                "Invalid facet normal.");
        expect("outer");
        expect("loop");
        for (int i = 0; i < 3; ++i) {
            expect("vertex");
            Vertex p;
            require(bool(in >> p.x >> p.y >> p.z) && finite(p.x) && finite(p.y) && finite(p.z),
                    "Invalid STL vertex.");
            require(std::abs(p.x) <= 1e12 && std::abs(p.y) <= 1e12 && std::abs(p.z) <= 1e12,
                    "STL coordinates exceed supported range.");
            v.push_back(p);
        }
        expect("endloop");
        expect("endfacet");
        require(v.size() <= 30000, "STL exceeds the supported 10000-triangle limit.");
    }
    require(ended && !v.empty(), "STL must contain triangles and an endsolid marker.");
    return v;
}
std::vector<Node> parseCsv(const std::string &text) {
    require(!text.empty(), "CSV file is empty.");
    require(text.size() <= 20 * 1024 * 1024, "CSV exceeds the 20 MiB limit.");
    std::istringstream in(text);
    std::string line;
    std::getline(in, line);
    if (!line.empty() && line.back() == '\r')
        line.pop_back();
    require(line == "node_id,x_m,y_m,z_m,temperature_C",
            "Expected header: node_id,x_m,y_m,z_m,temperature_C");
    std::vector<Node> nodes;
    std::vector<double> ids;
    std::size_t lineNumber = 1;
    while (std::getline(in, line)) {
        ++lineNumber;
        if (line.empty() || line == "\r")
            continue;
        std::istringstream row(line);
        std::string cell;
        std::vector<double> values;
        while (std::getline(row, cell, ',')) {
            try {
                values.push_back(number(cell));
            } catch (const std::exception &e) {
                throw std::runtime_error("CSV line " + std::to_string(lineNumber) + ": " +
                                         e.what());
            }
        }
        require(values.size() == 5 && line.back() != ',',
                "Each CSV row must have exactly five values.");
        require(values[0] >= 0 && std::floor(values[0]) == values[0] &&
                    values[0] <= 9007199254740991.,
                "node_id must be a non-negative safe integer.");
        nodes.push_back({values[0], values[1], values[2], values[3], values[4]});
        require(std::abs(values[1]) <= 1e12 && std::abs(values[2]) <= 1e12 &&
                    std::abs(values[3]) <= 1e12 && std::abs(values[4]) <= 1e12,
                "CSV coordinates and temperatures must have magnitude <= 1e12.");
        ids.push_back(values[0]);
        require(nodes.size() <= 10000, "CSV exceeds the supported 10000-node limit.");
    }
    require(!nodes.empty(), "CSV contains no nodes.");
    std::sort(ids.begin(), ids.end());
    require(std::adjacent_find(ids.begin(), ids.end()) == ids.end(),
            "CSV node IDs must be unique.");
    return nodes;
}
std::string geometryJson(const std::vector<Vertex> &v) {
    require(!v.empty() && v.size() % 3 == 0, "Geometry summary requires complete triangles.");
    auto s = stream();
    s << "{\"vertices\":[";
    for (std::size_t i = 0; i < v.size(); ++i) {
        if (i)
            s << ',';
        s << '[' << v[i].x << ',' << v[i].y << ',' << v[i].z << ']';
    }
    Vertex lo = v.front(), hi = v.front();
    double area = 0;
    std::size_t degenerate = 0;
    for (const auto &p : v) {
        lo.x = std::min(lo.x, p.x);
        lo.y = std::min(lo.y, p.y);
        lo.z = std::min(lo.z, p.z);
        hi.x = std::max(hi.x, p.x);
        hi.y = std::max(hi.y, p.y);
        hi.z = std::max(hi.z, p.z);
    }
    for (std::size_t i = 0; i < v.size(); i += 3) {
        Vertex a{v[i + 1].x - v[i].x, v[i + 1].y - v[i].y, v[i + 1].z - v[i].z};
        Vertex b{v[i + 2].x - v[i].x, v[i + 2].y - v[i].y, v[i + 2].z - v[i].z};
        double cx = a.y * b.z - a.z * b.y, cy = a.z * b.x - a.x * b.z, cz = a.x * b.y - a.y * b.x;
        double triangle = .5 * std::sqrt(cx * cx + cy * cy + cz * cz);
        area += triangle;
        if (triangle == 0)
            ++degenerate;
    }
    s << "],\"summary\":{\"triangles\":" << v.size() / 3
      << ",\"surface_area_source_units2\":" << area << ",\"degenerate_triangles\":" << degenerate
      << ",\"bounds_min\":[" << lo.x << ',' << lo.y << ',' << lo.z << "],\"bounds_max\":[" << hi.x
      << ',' << hi.y << ',' << hi.z << "]}}";
    return s.str();
}
std::string nodesJson(const std::vector<Node> &v) {
    require(!v.empty(), "Node summary requires at least one node.");
    auto s = stream();
    s << "{\"nodes\":[";
    for (std::size_t i = 0; i < v.size(); ++i) {
        if (i)
            s << ',';
        s << '[' << v[i].id << ',' << v[i].x << ',' << v[i].y << ',' << v[i].z << ',' << v[i].t
          << ']';
    }
    double minimum = v.front().t, maximum = minimum, sum = 0;
    for (const auto &p : v) {
        minimum = std::min(minimum, p.t);
        maximum = std::max(maximum, p.t);
        sum += p.t;
    }
    s << "],\"summary\":{\"count\":" << v.size() << ",\"min_temperature_C\":" << minimum
      << ",\"max_temperature_C\":" << maximum << ",\"mean_temperature_C\":" << sum / v.size()
      << "}}";
    return s.str();
}
std::vector<Benchmark> benchmark(std::size_t count, std::size_t elements,
                                 const std::atomic<bool> *cancel,
                                 std::atomic<std::size_t> *completed) {
    require(count >= 10 && count <= 20000 && elements >= 10 && elements <= 10000 &&
                count * elements <= 20000000,
            "Use 10-20000 cases, 10-10000 elements, and at most 20 million total elements.");
    std::mt19937 gen(20261101);
    std::vector<Rod> cases(count);
    for (auto &r : cases) {
        r.elements = elements;
        // Explicit integer-to-double mapping keeps cases portable across standard libraries.
        r.conductivity = 2 + 28 * (static_cast<double>(gen()) / 4294967295.0);
        r.heat = 100 + 19900 * (static_cast<double>(gen()) / 4294967295.0);
    }
    // Each case stores all temperatures; comparisons cover the entire solution, not a checksum.
    std::vector<Thermal> reference(count), out(count);
    auto run = [&](unsigned workers, std::vector<Thermal> &dest) {
        std::atomic<std::size_t> next{0};
        auto worker = [&]() {
            for (;;) {
                if (cancel && cancel->load())
                    break;
                auto i = next.fetch_add(1);
                if (i >= count)
                    break;
                dest[i] = solve(cases[i]);
                if (completed)
                    completed->fetch_add(1);
            }
        };
        if (workers == 1) {
            worker();
            require(!cancel || !cancel->load(),
                    "Benchmark cancelled safely. No partial results were published.");
            return;
        }
        std::vector<std::thread> pool;
        for (unsigned i = 0; i < workers; ++i)
            pool.emplace_back(worker);
        for (auto &t : pool)
            t.join();
        require(!cancel || !cancel->load(),
                "Benchmark cancelled safely. No partial results were published.");
    };
    run(1, reference);
    std::vector<Benchmark> rows;
    unsigned cpus = std::max(1u, std::thread::hardware_concurrency());
    double baseline = 0;
    for (unsigned p : {1u, 2u, 4u}) {
        if (p > cpus)
            continue;
        run(p, out);
        Benchmark row{};
        row.workers = p;
        for (int rep = 0; rep < 5; ++rep) {
            auto begin = std::chrono::steady_clock::now();
            run(p, out);
            auto end = std::chrono::steady_clock::now();
            row.samples.push_back(std::chrono::duration<double>(end - begin).count());
        }
        auto sorted = row.samples;
        std::sort(sorted.begin(), sorted.end());
        row.median = sorted[2];
        if (p == 1)
            baseline = row.median;
        row.speedup = baseline / row.median;
        row.efficiency = row.speedup / p;
        row.difference = 0;
        for (std::size_t i = 0; i < count; ++i)
            for (std::size_t j = 0; j < out[i].temperature.size(); ++j)
                row.difference = std::max(
                    row.difference, std::abs(reference[i].temperature[j] - out[i].temperature[j]));
        rows.push_back(row);
    }
    return rows;
}
std::string benchmarkJson(const std::vector<Benchmark> &rows, std::size_t count,
                          std::size_t elements) {
    auto s = stream();
    s << "{\"cases\":" << count << ",\"elements\":" << elements
      << ",\"seed\":20261101,\"logical_cpus\":" << std::thread::hardware_concurrency()
      << ",\"rows\":[";
    for (std::size_t i = 0; i < rows.size(); ++i) {
        auto &r = rows[i];
        if (i)
            s << ',';
        s << "{\"workers\":" << r.workers << ",\"median_s\":" << r.median
          << ",\"speedup\":" << r.speedup << ",\"efficiency\":" << r.efficiency
          << ",\"max_difference_C\":" << r.difference << ",\"samples_s\":[";
        for (std::size_t j = 0; j < r.samples.size(); ++j) {
            if (j)
                s << ',';
            s << r.samples[j];
        }
        s << "]}";
    }
    s << "]}";
    return s.str();
}
Backprop backprop() {
    Backprop b{};
    std::array<double, 4> p{.5, 0, 1, 0};
    b.hidden = std::tanh(.5);
    b.prediction = b.hidden;
    b.initialLoss = loss(p);
    double e = b.prediction - 2, d = e * (1 - b.hidden * b.hidden);
    b.gradient = {d, d, e * b.hidden, e};
    for (int i = 0; i < 4; ++i) {
        auto plus = p, minus = p;
        plus[i] += 1e-6;
        minus[i] -= 1e-6;
        b.numerical[i] = (loss(plus) - loss(minus)) / (2e-6);
        b.maxError = std::max(b.maxError, std::abs(b.numerical[i] - b.gradient[i]));
        b.updated[i] = p[i] - .1 * b.gradient[i];
    }
    p = b.updated;
    b.loss.push_back(loss(p));
    for (int step = 0; step < 100; ++step) {
        double h = std::tanh(p[0] + p[1]), err = p[2] * h + p[3] - 2, dh = err * p[2] * (1 - h * h);
        std::array<double, 4> g{dh, dh, err * h, err};
        for (int i = 0; i < 4; ++i)
            p[i] -= .1 * g[i];
        b.loss.push_back(loss(p));
    }
    return b;
}
std::string backpropJson(const Backprop &b) {
    auto s = stream();
    s << "{\"hidden\":" << b.hidden << ",\"prediction\":" << b.prediction
      << ",\"initial_loss\":" << b.initialLoss << ",\"max_gradient_error\":" << b.maxError;
    auto arr = [&](const char *key, const auto &a) {
        s << ",\"" << key << "\":[";
        for (std::size_t i = 0; i < a.size(); ++i) {
            if (i)
                s << ',';
            s << a[i];
        }
        s << ']';
    };
    arr("gradient", b.gradient);
    arr("numerical", b.numerical);
    arr("updated", b.updated);
    arr("loss_after_updates", b.loss);
    s << '}';
    return s.str();
}
} // namespace wb
