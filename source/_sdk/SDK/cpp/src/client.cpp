#include <robobaton/client.hpp>
#include <curl/curl.h>
#include <json-c/json.h>
#include <algorithm>
#include <cctype>
#include <cstring>
#include <exception>
#include <memory>
#include <limits>
#include <stdexcept>
#include <utility>

namespace robobaton {
namespace {
std::uint64_t little(const std::uint8_t* bytes, std::size_t size) {
    std::uint64_t result = 0;
    for (std::size_t index = 0; index < size; ++index)
        result |= std::uint64_t(bytes[index]) << (8 * index);
    return result;
}
void require(bool condition, const char* message) {
    if (!condition) throw std::runtime_error(message);
}
using Json = std::unique_ptr<json_object, decltype(&json_object_put)>;
Json parse(const std::vector<std::uint8_t>& bytes) {
    std::unique_ptr<json_tokener, decltype(&json_tokener_free)> tok(json_tokener_new(), json_tokener_free);
    if (!tok) throw std::bad_alloc();
    json_tokener_set_flags(tok.get(), JSON_TOKENER_STRICT);
    Json value(json_tokener_parse_ex(tok.get(), reinterpret_cast<const char*>(bytes.data()),
                                    static_cast<int>(bytes.size())), json_object_put);
    require(json_tokener_get_error(tok.get()) == json_tokener_success && value &&
            json_object_is_type(value.get(), json_type_object), "Invalid JSON object");
    const auto consumed = static_cast<std::size_t>(tok->char_offset);
    require(std::all_of(bytes.begin() + consumed, bytes.end(), [](std::uint8_t byte) {
        return std::isspace(byte) != 0;
    }), "Trailing JSON data");
    return value;
}
json_object* field(json_object* object, const char* name) {
    json_object* result = nullptr;
    require(object && json_object_object_get_ex(object, name, &result), "Missing JSON field");
    return result;
}
bool equals(json_object* object, const char* value) {
    return object && json_object_is_type(object, json_type_string) &&
           std::string(json_object_get_string(object)) == value;
}
struct StreamComplete {};
void integer(json_object* object, std::int64_t expected) {
    require(object && json_object_is_type(object, json_type_int) &&
            json_object_get_int64(object) == expected, "Invalid image configuration");
}
void validate_image_config(json_object* config) {
    require(json_object_object_length(config) == 6 &&
            equals(field(config, "encoding"), "jpeg") &&
            equals(field(config, "pixel_format"), "mono8") &&
            equals(field(config, "frame_rate_mode"), "source"), "Invalid image configuration");
    integer(field(config, "width"), 544);
    integer(field(config, "height"), 640);
    integer(field(config, "quality"), 90);
}
JpegFrame image(const Record& record, const std::string& config) {
    const auto& bytes = record.payload;
    require(bytes.size() >= 9 && bytes.size() <= 1048576+512, "Invalid JPEG message size");
    const auto length = little(bytes.data(), 4);
    require(length >= 1 && length <= 508 && length+4 < bytes.size() &&
            bytes.size()-4-length <= 1048576, "Invalid JPEG prefix");
    std::vector<std::uint8_t> header(bytes.begin()+4, bytes.begin()+4+length);
    auto json = parse(header);
    auto source = field(json.get(), "header");
    auto sequence = field(source, "seq");
    require(json_object_object_length(json.get()) == 3 && json_object_object_length(source) == 2 &&
            json_object_is_type(sequence, json_type_string), "Invalid image header");
    const std::string seq = json_object_get_string(sequence);
    require(!seq.empty() && seq.size() <= 20 && seq.front() >= '1' && seq.front() <= '9' &&
            std::all_of(seq.begin(), seq.end(), [](char byte) { return byte >= '0' && byte <= '9'; }) &&
            (seq.size() < 20 || seq <= "18446744073709551615"), "Invalid image sequence");
    auto stamp = field(source, "stamp");
    if (stamp) {
        auto sec = field(stamp, "sec");
        auto ns = field(stamp, "nanosec");
        require(json_object_object_length(stamp) == 2 && json_object_is_type(sec, json_type_int) &&
                json_object_is_type(ns, json_type_int), "Invalid image timestamp");
        const auto seconds = json_object_get_int64(sec);
        const auto nanos = json_object_get_int64(ns);
        require(seconds >= 0 && nanos >= 0 && nanos < 1000000000 &&
                seconds <= (std::numeric_limits<std::int64_t>::max()-nanos)/1000000000,
                "Invalid image timestamp range");
    }
    require(!field(json.get(), "pts_us") &&
            json_object_is_type(field(json.get(), "random_access"), json_type_boolean) &&
            json_object_get_boolean(field(json.get(), "random_access")), "Invalid JPEG metadata");
    std::vector<std::uint8_t> data(bytes.begin()+4+length, bytes.end());
    require(data.size() >= 4 && data[0] == 255 && data[1] == 216 &&
            data[data.size()-2] == 255 && data.back() == 217, "Invalid JPEG markers");
    return JpegFrame{record.sequence, std::stoull(seq), std::string(header.begin(), header.end()), config, std::move(data)};
}
struct Transfer {
    Decoder decoder;
    std::exception_ptr error;
    bool stopped = false;
    bool metadata = false;
    bool accepted = false;
    bool content_type = false;
    std::string config;
    std::uint64_t previous_image = 0;
    Transfer(const JsonHandler& handler, const JpegHandler& jpeg_handler) : decoder([this, &handler, &jpeg_handler](const Record& record) {
        if (stopped) return;
        const bool jpeg = bool(jpeg_handler);
        require((record.channel == 0 && record.format == 1) ||
                (record.channel == (jpeg ? 6 : 2) && record.format == (jpeg ? 7 : 1)),
                "Unexpected channel/format");
        if (jpeg && record.channel == 6) {
            require(metadata, "Data before metadata");
            auto value = image(record, config);
            require(value.source_sequence > previous_image, "Image sequence reset");
            previous_image = value.source_sequence;
            if (!jpeg_handler(value)) throw StreamComplete{};
            return;
        }
        auto json = parse(record.payload);
        if (record.channel == 0) {
            auto type = field(json.get(), "type");
            if (equals(type, "metadata")) {
                require(!metadata, "Duplicate metadata");
                auto channels = field(field(json.get(), "stream"), "channels");
                require(json_object_is_type(channels, json_type_array) &&
                        json_object_array_length(channels) == 1, "Unexpected metadata channels");
                auto channel = json_object_array_get_idx(channels, 0);
                auto id = field(channel, "id");
                auto format = field(channel, "format");
                require(json_object_is_type(id, json_type_int) && json_object_get_int(id) == (jpeg ? 6 : 2) &&
                        json_object_is_type(format, json_type_int) && json_object_get_int(format) == (jpeg ? 7 : 1) &&
                        equals(field(channel, "name"), jpeg ? "gray_jpeg" : "odometry"), "Invalid metadata mapping");
                if (jpeg) {
                    auto value = field(json.get(), "config");
                    validate_image_config(value);
                    config = json_object_to_json_string_ext(value, JSON_C_TO_STRING_PLAIN);
                }
                metadata = true;
            } else {
                require(!equals(type, "error"), "Device stream error");
            }
        } else {
            require(metadata, "Data before metadata");
            field(json.get(), "header");
            field(json.get(), "pose");
            field(json.get(), "twist");
            if (!handler(std::string(record.payload.begin(), record.payload.end()))) throw StreamComplete{};
        }
    }) {}
};
std::size_t headers(char* bytes, std::size_t unit, std::size_t count, void* opaque) noexcept {
    auto& transfer = *static_cast<Transfer*>(opaque);
    try {
        std::string line(bytes, unit * count);
        std::transform(line.begin(), line.end(), line.begin(), [](unsigned char byte) {
            return static_cast<char>(std::tolower(byte));
        });
        if (line.rfind("http/", 0) == 0) {
            const auto space = line.find(' ');
            transfer.accepted = space != std::string::npos && line.substr(space + 1, 3) == "200";
            transfer.content_type = false;
        }
        if (line.rfind("content-type:", 0) == 0) {
            auto value = line.substr(13);
            value.erase(std::remove_if(value.begin(), value.end(), [](unsigned char byte) {
                return std::isspace(byte) != 0;
            }), value.end());
            transfer.content_type = value == "application/vnd.robobaton.stream";
        }
        return unit * count;
    } catch (...) {
        transfer.error = std::current_exception();
        return 0;
    }
}
std::size_t receive(char* bytes, std::size_t unit, std::size_t count, void* opaque) noexcept {
    auto& transfer = *static_cast<Transfer*>(opaque);
    try {
        require(transfer.accepted && transfer.content_type, "Unexpected HTTP status/Content-Type");
        transfer.decoder.feed(reinterpret_cast<std::uint8_t*>(bytes), unit * count);
        return transfer.stopped ? 0 : unit * count;
    } catch (const StreamComplete&) {
        transfer.stopped = true;
        return 0;
    } catch (...) {
        transfer.error = std::current_exception();
        return 0;
    }
}
struct CurlRuntime {
    CurlRuntime() { require(curl_global_init(CURL_GLOBAL_DEFAULT) == CURLE_OK, "curl_global_init failed"); }
    ~CurlRuntime() { curl_global_cleanup(); }
};
}
Decoder::Decoder(Handler handler) : handler_(std::move(handler)) {}
void Decoder::header() {
    require(std::memcmp(header_.data(), "RBH1", 4) == 0 && little(header_.data()+4, 2) == 1 &&
            little(header_.data()+6, 2) == 40 && little(header_.data()+36, 4) == 0, "Invalid RBH1 header");
    channel_ = little(header_.data()+8, 2);
    format_ = little(header_.data()+10, 2);
    flags_ = little(header_.data()+12, 4);
    sequence_ = little(header_.data()+16, 8);
    total_ = little(header_.data()+24, 4);
    offset_ = little(header_.data()+28, 4);
    size_ = little(header_.data()+32, 4);
    require(channel_ <= 32 && format_ >= 1 && format_ <= 9 && flags_ <= 3 &&
            total_ > 0 && total_ <= 2*1024*1024+8208 && size_ > 0 && size_ <= 65536 &&
            offset_ <= total_ && size_ <= total_ - offset_ &&
            bool(flags_ & 1) == (offset_ == 0) && bool(flags_ & 2) == (offset_+size_ == total_) &&
            (format_ != 1 || total_ <= 128*1024), "Invalid RBH1 limits");
    if (flags_ & 1) {
        require(!pending_.count(channel_) && sequence_ > previous_[channel_] &&
                allocated_ + total_ <= 16*1024*1024, "Duplicate sequence or memory limit");
        pending_.emplace(channel_, Record{channel_, format_, sequence_, {}});
        totals_[channel_] = total_;
        pending_.at(channel_).payload.reserve(total_);
        allocated_ += total_;
    }
    auto found = pending_.find(channel_);
    require(found != pending_.end() && found->second.sequence == sequence_ &&
            found->second.format == format_ && found->second.payload.size() == offset_ &&
            totals_.at(channel_) == total_, "Discontinuous fragment");
    fragment_.resize(size_);
    fragment_size_ = 0;
}
void Decoder::fragment() {
    auto& record = pending_.at(channel_);
    record.payload.insert(record.payload.end(), fragment_.begin(), fragment_.end());
    if (flags_ & 2) {
        require(record.payload.size() == total_, "Invalid message size");
        allocated_ -= total_;
        previous_[channel_] = sequence_;
        handler_(record);
        pending_.erase(channel_);
        totals_.erase(channel_);
    }
    header_size_ = 0;
    fragment_.clear();
}
void Decoder::feed(const std::uint8_t* data, std::size_t size) {
    while (size) {
        if (header_size_ < header_.size()) {
            const auto copied = std::min(size, header_.size() - header_size_);
            std::copy_n(data, copied, header_.begin() + header_size_);
            header_size_ += copied;
            data += copied;
            size -= copied;
            if (header_size_ == header_.size()) header();
        } else {
            const auto copied = std::min(size, fragment_.size() - fragment_size_);
            std::copy_n(data, copied, fragment_.begin() + fragment_size_);
            fragment_size_ += copied;
            data += copied;
            size -= copied;
            if (fragment_size_ == fragment_.size()) fragment();
        }
    }
}
void Decoder::finish() const {
    require(header_size_ == 0 && pending_.empty(), "Truncated RBH1 stream");
}
void observe(const std::string& origin, const JsonHandler& handler, const JpegHandler& jpeg_handler) {
    static CurlRuntime runtime;
    std::unique_ptr<CURLU, decltype(&curl_url_cleanup)> url(curl_url(), curl_url_cleanup);
    require(bool(url), "Cannot create URL parser");
    require(curl_url_set(url.get(), CURLUPART_URL, origin.c_str(), 0) == CURLUE_OK, "Invalid origin");
    auto part = [&](CURLUPart key) {
        char* raw = nullptr;
        const auto result = curl_url_get(url.get(), key, &raw, 0);
        std::unique_ptr<char, decltype(&curl_free)> owned(raw, curl_free);
        return result == CURLUE_OK && raw ? std::string(raw) : std::string();
    };
    require((part(CURLUPART_SCHEME) == "http" || part(CURLUPART_SCHEME) == "https") &&
            !part(CURLUPART_HOST).empty() && part(CURLUPART_USER).empty() &&
            part(CURLUPART_PASSWORD).empty() && part(CURLUPART_QUERY).empty() &&
            part(CURLUPART_FRAGMENT).empty() && (part(CURLUPART_PATH).empty() || part(CURLUPART_PATH) == "/"),
            "Use a plain HTTP(S) device origin");
    const auto endpoint = origin + (origin.back() == '/' ? "" : "/") +
                          "api/stream?channels=" + (jpeg_handler ? "gray_jpeg" : "odometry");
    std::unique_ptr<CURL, decltype(&curl_easy_cleanup)> curl(curl_easy_init(), curl_easy_cleanup);
    require(bool(curl), "Cannot create HTTP connection");
    Transfer transfer(handler, jpeg_handler);
    curl_easy_setopt(curl.get(), CURLOPT_URL, endpoint.c_str());
#if LIBCURL_VERSION_NUM >= 0x075500
    curl_easy_setopt(curl.get(), CURLOPT_PROTOCOLS_STR, "http,https");
#else
    curl_easy_setopt(curl.get(), CURLOPT_PROTOCOLS, CURLPROTO_HTTP | CURLPROTO_HTTPS);
#endif
    curl_easy_setopt(curl.get(), CURLOPT_FOLLOWLOCATION, 0L);
    curl_easy_setopt(curl.get(), CURLOPT_CONNECTTIMEOUT, 10L);
    curl_easy_setopt(curl.get(), CURLOPT_LOW_SPEED_LIMIT, 1L);
    curl_easy_setopt(curl.get(), CURLOPT_LOW_SPEED_TIME, 30L);
    curl_easy_setopt(curl.get(), CURLOPT_NOSIGNAL, 1L);
    curl_easy_setopt(curl.get(), CURLOPT_HEADERFUNCTION, headers);
    curl_easy_setopt(curl.get(), CURLOPT_HEADERDATA, &transfer);
    curl_easy_setopt(curl.get(), CURLOPT_WRITEFUNCTION, receive);
    curl_easy_setopt(curl.get(), CURLOPT_WRITEDATA, &transfer);
    const auto result = curl_easy_perform(curl.get());
    if (transfer.error) std::rethrow_exception(transfer.error);
    if (transfer.stopped) return;
    require(result == CURLE_OK, curl_easy_strerror(result));
    require(transfer.accepted && transfer.content_type && transfer.metadata, "Missing HTTP stream metadata");
    transfer.decoder.finish();
    throw std::runtime_error("Device stream ended; start a new session");
}
void observe_odometry(const std::string& origin, const JsonHandler& handler) {
    require(bool(handler), "A handler is required");
    observe(origin, handler, {});
}
void observe_gray_jpeg(const std::string& origin, const JpegHandler& handler) {
    require(bool(handler), "A handler is required");
    observe(origin, {}, handler);
}
}
