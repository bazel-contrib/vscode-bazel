#include "format_upper_case.hh"

std::string format_upper_case(std::string value)
{
    std::stringstream ss;

    std::locale loc;
    for (std::string::size_type i = 0; i < value.length(); ++i)
        ss << std::toupper(value[i], loc);

    return ss.str();
}
