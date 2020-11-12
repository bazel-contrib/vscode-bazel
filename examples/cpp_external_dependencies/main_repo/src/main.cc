#include <string>
#include <iostream>

// Import from the formatters library.
#include "formatter/format_lower_case.hh"
#include "formatter/format_upper_case.hh"

// Import from the logger library.
#include "logger/logger.hh"

int main() {
    std::cout << "Hello world" << std::endl;

    // The logger we imported from the external repo.
    Logger *logger = new Logger(std::cout);
    logger->info("I'm using the logger from the external repo");
    logger->warn("And there were no errors!");
    logger->err("Well, except this one...");

    std::cout << std::endl;

    // The formatters from the external repo.
    logger->info(format_upper_case("GoEs to UppEr Case"));
    logger->info(format_lower_case("GoEs to LoWER Case"));

    return 0;
}
