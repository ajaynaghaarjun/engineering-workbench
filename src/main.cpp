#include "core.hpp"
#include <algorithm>
#include <cctype>
#include <chrono>
#include <condition_variable>
#include <csignal>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <mutex>
#include <queue>
#include <sstream>
#include <thread>
#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
// clang-format off: Windows header dependency order is significant.
#include <winsock2.h>
#include <windows.h>
#include <shellapi.h>
// clang-format on
using Socket = SOCKET;
void closeSocket(Socket s) {
    closesocket(s);
}
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
using Socket = int;
void closeSocket(Socket s) {
    close(s);
}
#endif

namespace fs = std::filesystem;
namespace {
std::mutex computeMutex, hardwareMutex;
std::atomic<bool> benchmarkActive{false}, benchmarkCancel{false};
std::atomic<std::size_t> benchmarkCompleted{0}, benchmarkTotal{0};
std::map<std::string, bool> devices{{"microcontroller", false}, {"fpga", false}, {"jtag", false}};
std::string read(const fs::path &p) {
    std::ifstream f(p, std::ios::binary);
    if (!f)
        throw std::runtime_error("Required file is missing: " + p.filename().string());
    return {std::istreambuf_iterator<char>(f), {}};
}
void write(const fs::path &p, const std::string &value) {
    std::ofstream f(p);
    if (!f)
        throw std::runtime_error("Cannot write evidence output.");
    f << value;
}
wb::Rod rod(const std::string &body) {
    wb::Rod r;
    if (body.empty())
        return r;
    std::istringstream s(body);
    long long n;
    std::string extra;
    if (!(s >> r.length >> r.area >> r.conductivity >> r.heat >> r.left >> r.right >> n) ||
        s >> extra || n < 2 || n > 200000)
        throw std::runtime_error("Supply length, area, conductivity, heat, left temperature, right "
                                 "temperature and integer elements.");
    r.elements = static_cast<std::size_t>(n);
    return r;
}
std::string study(wb::Rod parameters = {}) {
    std::string s = "{\"runs\":[";
    bool comma = false;
    for (int n : {10, 20, 40, 80}) {
        wb::Rod r = parameters;
        r.elements = n;
        if (comma)
            s += ',';
        comma = true;
        s += wb::thermalJson(r, wb::solve(r));
    }
    return s + "]}";
}
std::string hardware(const std::string &body) {
    std::istringstream in(body);
    std::string device, action;
    in >> device >> action;
    std::lock_guard<std::mutex> guard(hardwareMutex);
    if (!devices.count(device))
        throw std::runtime_error("Select microcontroller, fpga or jtag.");
    if (action == "connect")
        devices[device] = true;
    else if (action == "disconnect")
        devices[device] = false;
    else if (action == "timeout") {
        devices[device] = false;
        return "{\"simulated\":true,\"connected\":false,\"error\":\"Simulated timeout. Reconnect "
               "to recover.\"}";
    } else if (action != "inspect" && action != "telemetry")
        throw std::runtime_error("Unknown device action.");
    if (action == "telemetry" && !devices[device])
        throw std::runtime_error("Device is disconnected. Connect before requesting telemetry.");
    return "{\"simulated\":true,\"device\":" + wb::quote(device) +
           ",\"connected\":" + (devices[device] ? "true" : "false") +
           ",\"capabilities\":[\"discovery\",\"connect\",\"disconnect\",\"telemetry\"],"
           "\"telemetry\":{\"sequence\":1,\"status\":\"ready\",\"temperature_C\":32.5}}";
}
std::string api(const std::string &path, const std::string &body) {
    if (path == "/api/health")
        return "{\"status\":\"ready\",\"backend\":\"C++17\",\"version\":\"1.1\"}";
    if (path == "/api/progress")
        return "{\"running\":" + std::string(benchmarkActive ? "true" : "false") +
               ",\"cancel_requested\":" + (benchmarkCancel ? "true" : "false") +
               ",\"completed\":" + std::to_string(benchmarkCompleted.load()) +
               ",\"total\":" + std::to_string(benchmarkTotal.load()) + "}";
    if (path == "/api/cancel") {
        if (benchmarkActive)
            benchmarkCancel = true;
        return "{\"requested\":" + std::string(benchmarkActive ? "true" : "false") + "}";
    }
    if (path == "/api/stl")
        return wb::geometryJson(wb::parseStl(body));
    if (path == "/api/csv")
        return wb::nodesJson(wb::parseCsv(body));
    if (path == "/api/hardware")
        return hardware(body);
    if (path == "/api/backprop")
        return wb::backpropJson(wb::backprop());
    std::unique_lock<std::mutex> guard(computeMutex, std::try_to_lock);
    if (!guard.owns_lock())
        throw std::runtime_error(
            "Another calculation is running. Wait for safe completion, then retry.");
    if (path == "/api/thermal") {
        auto r = rod(body);
        return wb::thermalJson(r, wb::solve(r));
    }
    if (path == "/api/study")
        return study();
    if (path == "/api/custom-study")
        return study(rod(body));
    if (path == "/api/benchmark") {
        std::istringstream in(body);
        std::size_t count = 1000, n = 200;
        std::string extra;
        if (!(in >> count >> n) || in >> extra)
            throw std::runtime_error("Supply integer case count and mesh size.");
        unsigned workerCounts = 1, cpus = std::max(1u, std::thread::hardware_concurrency());
        if (cpus >= 2)
            ++workerCounts;
        if (cpus >= 4)
            ++workerCounts;
        benchmarkCompleted = 0;
        benchmarkTotal = count * (1 + 6 * workerCounts);
        benchmarkCancel = false;
        benchmarkActive = true;
        try {
            auto rows = wb::benchmark(count, n, &benchmarkCancel, &benchmarkCompleted);
            benchmarkActive = false;
            return wb::benchmarkJson(rows, count, n);
        } catch (...) {
            benchmarkActive = false;
            throw;
        }
    }
    throw std::runtime_error("Unknown API endpoint.");
}
void sendAll(Socket socket, const std::string &s) {
    std::size_t sent = 0;
    while (sent < s.size()) {
        int n = send(socket, s.data() + sent,
                     static_cast<int>(std::min<std::size_t>(s.size() - sent, 65536)), 0);
        if (n <= 0)
            return;
        sent += n;
    }
}
void handle(Socket client, fs::path root, unsigned port) {
    try {
#ifdef _WIN32
        DWORD timeout = 15000;
        setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char *>(&timeout),
                   sizeof(timeout));
#else
        timeval timeout{15, 0};
        setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
#endif
        std::string request;
        char buffer[8192];
        std::size_t split;
        while ((split = request.find("\r\n\r\n")) == std::string::npos) {
            int n = recv(client, buffer, sizeof(buffer), 0);
            if (n <= 0)
                throw std::runtime_error("Incomplete request.");
            request.append(buffer, n);
            if (request.size() > 65536)
                throw std::runtime_error("Request headers too large.");
        }
        std::istringstream header(request.substr(0, split));
        std::string method, path, version, line;
        header >> method >> path >> version;
        std::getline(header, line);
        std::size_t length = 0;
        std::string host, origin;
        while (std::getline(header, line)) {
            if (!line.empty() && line.back() == '\r')
                line.pop_back();
            auto colon = line.find(':');
            if (colon == std::string::npos)
                continue;
            std::string key = line.substr(0, colon), value = line.substr(colon + 1);
            for (auto &c : key)
                c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
            while (!value.empty() && value.front() == ' ')
                value.erase(value.begin());
            if (key == "content-length")
                length = std::stoull(value);
            if (key == "host")
                host = value;
            if (key == "origin")
                origin = value;
        }
        std::string expected = "127.0.0.1:" + std::to_string(port);
        if (host != expected)
            throw std::runtime_error("Invalid local host.");
        if (!origin.empty() && origin != "http://" + expected)
            throw std::runtime_error("Cross-origin requests are not allowed.");
        if (length > 20 * 1024 * 1024)
            throw std::runtime_error("Upload exceeds the 20 MiB limit.");
        std::string body = request.substr(split + 4);
        while (body.size() < length) {
            int n = recv(client, buffer, sizeof(buffer), 0);
            if (n <= 0)
                throw std::runtime_error("Incomplete upload.");
            body.append(buffer, n);
        }
        body.resize(length);
        std::string content, type = "application/json";
        if (path.rfind("/api/", 0) == 0) {
            if (method != "POST" && path != "/api/health")
                throw std::runtime_error("Use POST for API operations.");
            content = api(path, body);
        } else {
            if (method != "GET")
                throw std::runtime_error("Use GET for application files.");
            std::map<std::string, std::pair<std::string, std::string>> allowed{
                {"/", {"web/index.html", "text/html; charset=utf-8"}},
                {"/app.js", {"web/app.js", "text/javascript; charset=utf-8"}},
                {"/style.css", {"web/style.css", "text/css"}},
                {"/enhancements.css", {"web/enhancements.css", "text/css"}},
                {"/sample.stl", {"data/sample.stl", "text/plain"}},
                {"/temperatures.csv", {"data/temperatures.csv", "text/csv"}}};
            if (!allowed.count(path))
                throw std::runtime_error("File not found.");
            content = read(root / allowed[path].first);
            type = allowed[path].second;
        }
        sendAll(client, "HTTP/1.1 200 OK\r\nContent-Type: " + type +
                            "\r\nContent-Length: " + std::to_string(content.size()) +
                            "\r\nConnection: close\r\nX-Content-Type-Options: "
                            "nosniff\r\nContent-Security-Policy: default-src 'self'; style-src "
                            "'self'; script-src 'self'; connect-src 'self'; img-src 'self' blob: "
                            "data:; frame-ancestors 'none'\r\n\r\n" +
                            content);
    } catch (const std::exception &e) {
        std::string body = "{\"error\":" + wb::quote(e.what()) + "}";
        sendAll(client, "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nConnection: "
                        "close\r\nContent-Length: " +
                            std::to_string(body.size()) + "\r\n\r\n" + body);
    }
    closeSocket(client);
}
void evidence(const fs::path &dir) {
    fs::create_directories(dir);
    write(dir / "thermal.json", study());
    std::ostringstream nodes, errors;
    nodes << "elements,x_m,temperature_C,exact_C\n";
    errors << "elements,midpoint_max_error_C\n";
    for (int n : {10, 20, 40, 80}) {
        wb::Rod r;
        r.elements = n;
        auto t = wb::solve(r);
        errors << n << ',' << std::setprecision(17) << t.midpointError << '\n';
        for (std::size_t i = 0; i < t.x.size(); ++i)
            nodes << n << ',' << std::setprecision(17) << t.x[i] << ',' << t.temperature[i] << ','
                  << wb::exact(r, t.x[i]) << '\n';
    }
    write(dir / "thermal_nodes.csv", nodes.str());
    write(dir / "convergence.csv", errors.str());
    auto b = wb::backprop();
    write(dir / "backprop.json", wb::backpropJson(b));
    std::ostringstream ls;
    ls << "update,loss\n0," << std::setprecision(17) << b.initialLoss << '\n';
    for (std::size_t i = 0; i < b.loss.size(); ++i)
        ls << i + 1 << ',' << b.loss[i] << '\n';
    write(dir / "loss.csv", ls.str());
    auto rows = wb::benchmark(2000, 5000);
    write(dir / "benchmark.json", wb::benchmarkJson(rows, 2000, 5000));
    std::ostringstream perf;
    perf << "workers,repetition,compute_s,median_s,speedup,efficiency,max_difference_C\n";
    for (auto &r : rows)
        for (std::size_t i = 0; i < r.samples.size(); ++i)
            perf << r.workers << ',' << i + 1 << ',' << std::setprecision(17) << r.samples[i] << ','
                 << r.median << ',' << r.speedup << ',' << r.efficiency << ',' << r.difference
                 << '\n';
    write(dir / "benchmark.csv", perf.str());
}
} // namespace
int main(int argc, char **argv) {
    try {
        if (argc >= 3 && std::string(argv[1]) == "--evidence") {
            evidence(argv[2]);
            return 0;
        }
        fs::path root = fs::absolute(argv[0]).parent_path();
#ifdef _WIN32
        wchar_t exe[32768];
        GetModuleFileNameW(nullptr, exe, 32768);
        root = fs::path(exe).parent_path();
        WSADATA data;
        if (WSAStartup(MAKEWORD(2, 2), &data))
            throw std::runtime_error("Windows socket initialization failed.");
#else
        signal(SIGPIPE, SIG_IGN);
#endif
        if (!fs::exists(root / "web/index.html"))
            throw std::runtime_error(
                "web/index.html is missing. Keep Launch and its web folder together.");
        Socket server = socket(AF_INET, SOCK_STREAM, 0);
        sockaddr_in address{};
        address.sin_family = AF_INET;
        address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
        unsigned port = 0;
        for (unsigned p = 8765; p < 8790; ++p) {
            address.sin_port = htons(p);
            if (bind(server, reinterpret_cast<sockaddr *>(&address), sizeof(address)) == 0) {
                port = p;
                break;
            }
        }
        if (!port)
            throw std::runtime_error(
                "Ports 8765-8789 are unavailable. Close another Workbench instance and retry.");
        if (listen(server, 16))
            throw std::runtime_error("Cannot listen on localhost.");
        std::string url = "http://127.0.0.1:" + std::to_string(port);
        std::cout << "Workbench ready: " << url << std::endl;
        bool open = true;
        for (int i = 1; i < argc; ++i)
            if (std::string(argv[i]) == "--no-browser")
                open = false;
        if (open) {
#ifdef _WIN32
            ShellExecuteA(nullptr, "open", url.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
#else
            std::string command = "open " + url;
            std::system(command.c_str());
#endif
        }
        std::mutex queueMutex;
        std::condition_variable ready;
        std::queue<Socket> clients;
        // Bound request concurrency independently of numerical worker counts.
        for (unsigned i = 0; i < 8; ++i) {
            std::thread([&] {
                for (;;) {
                    Socket client;
                    {
                        std::unique_lock<std::mutex> guard(queueMutex);
                        ready.wait(guard, [&] { return !clients.empty(); });
                        client = clients.front();
                        clients.pop();
                    }
                    handle(client, root, port);
                }
            }).detach();
        }
        while (true) {
            Socket client = accept(server, nullptr, nullptr);
#ifdef _WIN32
            if (client == INVALID_SOCKET)
                continue;
#else
            if (client < 0)
                continue;
#endif
            {
                std::lock_guard<std::mutex> guard(queueMutex);
                if (clients.size() >= 16) {
                    closeSocket(client);
                    continue;
                }
                clients.push(client);
            }
            ready.notify_one();
        }
    } catch (const std::exception &e) {
        std::cerr << e.what() << std::endl;
#ifdef _WIN32
        MessageBoxA(nullptr, e.what(), "Workbench launch error", MB_OK | MB_ICONERROR);
#endif
        return 1;
    }
}
