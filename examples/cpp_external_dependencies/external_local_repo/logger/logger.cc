#include "logger.hh"

Logger::Logger(std::ostream &str)
{
    this->_log = &str;
}

void Logger::info(std::string msg)
{
    this->log() << "[Info]" << msg << "\n";
}

void Logger::warn(std::string msg)
{
    this->log() << "[Warn]" << msg << "\n";
}

void Logger::err(std::string msg)
{
    this->log() << "[Err]" << msg << "\n";
}
