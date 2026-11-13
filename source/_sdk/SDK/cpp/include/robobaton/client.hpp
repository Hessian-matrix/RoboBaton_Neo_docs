#pragma once
#include <array>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <map>
#include <string>
#include <vector>

namespace robobaton {
struct Record {
    std::uint16_t channel;
    std::uint16_t format;
    std::uint64_t sequence;
    std::vector<std::uint8_t> payload;
};
class Decoder {
public:
    using Handler = std::function<void(const Record&)>;
    explicit Decoder(Handler handler);
    void feed(const std::uint8_t* data, std::size_t size);
    void finish() const;
private:
    void header();
    void fragment();
    Handler handler_;
    std::array<std::uint8_t, 40> header_{};
    std::size_t header_size_ = 0;
    std::vector<std::uint8_t> fragment_;
    std::size_t fragment_size_ = 0;
    std::uint16_t channel_ = 0, format_ = 0;
    std::uint32_t flags_ = 0, total_ = 0, offset_ = 0, size_ = 0;
    std::uint64_t sequence_ = 0;
    std::map<std::uint16_t, Record> pending_;
    std::map<std::uint16_t, std::uint32_t> totals_;
    std::map<std::uint16_t, std::uint64_t> previous_;
    std::size_t allocated_ = 0;
};
using JsonHandler = std::function<bool(const std::string&)>;
void observe_odometry(const std::string& origin, const JsonHandler& handler);
struct JpegFrame {
    std::uint64_t sequence;
    std::uint64_t source_sequence;
    std::string metadata_json;
    std::string config_json;
    std::vector<std::uint8_t> data;
};
using JpegHandler = std::function<bool(const JpegFrame&)>;
void observe_gray_jpeg(const std::string& origin, const JpegHandler& handler);
}
