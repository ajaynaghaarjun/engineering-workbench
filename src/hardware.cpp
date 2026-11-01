#include "hardware.hpp"
#include "core.hpp"
#include <chrono>
#include <sstream>
#include <stdexcept>

namespace wb {
HardwareRegistry::HardwareRegistry() {
    devices_.emplace("microcontroller", Device{"STM32 Nucleo-F401RE",
                                               "USB virtual serial / target SWD",
                                               {"discovery", "connect", "disconnect", "telemetry",
                                                "temperature_sensor"}});
    devices_.emplace("fpga",
                     Device{"Digilent Arty A7-35T",
                            "USB UART / onboard JTAG",
                            {"discovery", "connect", "disconnect", "telemetry", "logic_counter"}});
    devices_.emplace("jtag", Device{"ST-LINK/V2 debug adapter",
                                    "USB debug / STM32 SWD",
                                    {"discovery", "connect", "disconnect", "telemetry",
                                     "target_reference", "debug_status"}});
}
void HardwareRegistry::record(const std::string &id, const std::string &action,
                              const std::string &outcome) {
    auto now = std::chrono::system_clock::now().time_since_epoch();
    events_.push_back({nextEvent_++,
                       std::chrono::duration_cast<std::chrono::milliseconds>(now).count(), id,
                       action, outcome});
    if (events_.size() > 100)
        events_.pop_front();
}
std::string HardwareRegistry::snapshot(const std::string &id, const Device &d, bool telemetry) {
    std::ostringstream s;
    s << "{\"simulated\":true,\"device\":" << quote(id) << ",\"title\":" << quote(d.title)
      << ",\"protocol\":" << quote(d.protocol)
      << ",\"connected\":" << (d.connected ? "true" : "false") << ",\"capabilities\":[";
    for (std::size_t i = 0; i < d.capabilities.size(); ++i) {
        if (i)
            s << ',';
        s << quote(d.capabilities[i]);
    }
    s << "],\"telemetry\":";
    if (!telemetry)
        s << "null";
    else {
        s << "{\"sequence\":" << d.telemetrySequence << ",\"status\":\"ready\"";
        if (id == "microcontroller")
            s << ",\"temperature_C\":32.5";
        else if (id == "fpga")
            s << ",\"logic_cycles\":" << d.telemetrySequence * 1024 << ",\"clock_MHz\":100";
        else
            s << ",\"target_reference_V\":3.3,\"debug_link\":\"SWD simulated\"";
        s << '}';
    }
    s << '}';
    return s.str();
}
std::string HardwareRegistry::discover() {
    std::lock_guard<std::mutex> lock(mutex_);
    std::string s = "{\"simulated\":true,\"devices\":[";
    bool comma = false;
    for (const auto &[id, d] : devices_) {
        if (comma)
            s += ',';
        comma = true;
        s += snapshot(id, d);
    }
    return s + "]}";
}
std::string HardwareRegistry::execute(const std::string &id, const std::string &action) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = devices_.find(id);
    if (it == devices_.end())
        throw std::runtime_error("Select microcontroller, fpga or jtag.");
    auto &d = it->second;
    if (action == "connect")
        d.connected = true;
    else if (action == "disconnect")
        d.connected = false;
    else if (action == "timeout") {
        d.connected = false;
        record(id, action, "timeout; disconnected");
        auto s = snapshot(id, d);
        s.pop_back();
        return s + ",\"error\":\"Simulated timeout. Reconnect to recover.\"}";
    } else if (action == "telemetry") {
        if (!d.connected) {
            record(id, action, "rejected: disconnected");
            throw std::runtime_error(
                "Device is disconnected. Connect before requesting telemetry.");
        }
        ++d.telemetrySequence;
    } else if (action != "inspect")
        throw std::runtime_error("Unknown device action.");
    record(id, action, "ok");
    return snapshot(id, d, action == "telemetry");
}
std::string HardwareRegistry::events() {
    std::lock_guard<std::mutex> lock(mutex_);
    std::ostringstream s;
    s << "{\"simulated\":true,\"capacity\":100,\"events\":[";
    for (std::size_t i = 0; i < events_.size(); ++i) {
        if (i)
            s << ',';
        const auto &e = events_[i];
        s << "{\"sequence\":" << e.sequence << ",\"epoch_ms\":" << e.epochMs
          << ",\"device\":" << quote(e.device) << ",\"action\":" << quote(e.action)
          << ",\"outcome\":" << quote(e.outcome) << '}';
    }
    s << "]}";
    return s.str();
}
} // namespace wb
