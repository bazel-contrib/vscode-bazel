#include "logger.hh"

Logger::Logger(std::ostream &str)
{
    this->_log = &str;
}

void Logger::info(std::string msg)
{
    this->log() << "[Info]" << msg << std::endl;
}

void Logger::warn(std::string msg)
{
    this->log() << "[Warn]" << msg << std::endl;
}

void Logger::err(std::string msg)
{
    this->log() << "[Err]" << msg << std::endl;
}
