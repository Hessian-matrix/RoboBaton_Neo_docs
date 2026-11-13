#include <robobaton/client.hpp>
#include <iostream>
#include <stdexcept>
#include <string>

int main(int argc, char** argv) {
    try {
        if (argc > 3) throw std::runtime_error("用法: neo_odometry [HTTP_ORIGIN] [COUNT]");
        const std::string origin = argc > 1 ? argv[1] : "http://192.168.11.1";
        std::size_t consumed = 0;
        const std::string count_text = argc > 2 ? argv[2] : "10";
        const auto count = std::stoul(count_text, &consumed);
        if (!count || consumed != count_text.size() || count_text[0] == '-')
            throw std::runtime_error("COUNT 必须为正整数");
        std::size_t received = 0;
        robobaton::observe_odometry(origin, [&](const std::string& json) {
            std::cout << json << std::endl;
            return ++received < count;
        });
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << std::endl;
        return 1;
    }
}
