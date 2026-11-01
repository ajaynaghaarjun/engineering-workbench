#pragma once
#include <string>
#include <vector>
namespace wb {
struct VerificationCheck {
    std::string name, explanation;
    double error, tolerance;
    bool passed() const;
};
std::vector<VerificationCheck> verifyNumerics();
std::string verificationJson();
} // namespace wb
