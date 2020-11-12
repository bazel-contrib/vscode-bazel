#include "format_lower_case.hh"

std::string format_lower_case(std::string value)
{
    std::stringstream ss;

    std::locale loc;
    for (std::string::size_type i = 0; i < value.length(); ++i)
        ss << std::tolower(value[i], loc);

    return ss.str();
}
