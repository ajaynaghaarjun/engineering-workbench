#pragma once
#include <deque>
#include <map>
#include <mutex>
#include <string>
#include <vector>

namespace wb {
// Mock-only adapters: no USB devices, drivers or target memory are accessed.
class HardwareRegistry {
  public:
    HardwareRegistry();
    std::string discover();
    std::string execute(const std::string &id, const std::string &action);
    std::string events();

  private:
    struct Device {
        std::string title, protocol;
        std::vector<std::string> capabilities;
        bool connected = false;
        unsigned long long telemetrySequence = 0;
    };
    struct Event {
        unsigned long long sequence;
        long long epochMs;
        std::string device, action, outcome;
    };
    std::map<std::string, Device> devices_;
    std::deque<Event> events_;
    unsigned long long nextEvent_ = 1;
    std::mutex mutex_;
    void record(const std::string &, const std::string &, const std::string &);
    std::string snapshot(const std::string &, const Device &, bool telemetry = false);
};
} // namespace wb
