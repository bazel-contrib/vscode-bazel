#ifndef LOGGER_HH
#define LOGGER_HH

#include <sstream>
#include <string>

class Logger
{
    public:
        Logger(std::ostream &str);
        ~Logger();

        void info(std::string msg);
        void warn(std::string msg);
        void err(std::string msg);
    private:
        std::ostream& log() const { return *_log; }
        mutable std::ostream* _log;
};

#endif