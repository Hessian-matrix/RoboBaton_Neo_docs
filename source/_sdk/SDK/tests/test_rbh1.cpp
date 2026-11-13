#include <robobaton/client.hpp>
#include <algorithm>
#include <iostream>
#include <stdexcept>
#include <vector>

using Bytes = std::vector<std::uint8_t>;
void check(bool value) { if (!value) throw std::runtime_error("RBH1 assertion failed"); }
void number(Bytes& bytes, std::uint64_t value, unsigned size) {
    for (unsigned index = 0; index < size; ++index) bytes.push_back((value >> (8*index)) & 255);
}
Bytes packet(std::uint16_t channel, std::uint64_t sequence, const Bytes& payload,
             unsigned total, unsigned offset, unsigned flags) {
    Bytes bytes{'R','B','H','1'};
    number(bytes, 1, 2); number(bytes, 40, 2); number(bytes, channel, 2); number(bytes, 1, 2);
    number(bytes, flags, 4); number(bytes, sequence, 8); number(bytes, total, 4);
    number(bytes, offset, 4); number(bytes, payload.size(), 4); number(bytes, 0, 4);
    bytes.insert(bytes.end(), payload.begin(), payload.end());
    return bytes;
}
template<class Function> void rejected(Function callback) {
    bool failed = false;
    try { callback(); } catch (const std::runtime_error&) { failed = true; }
    check(failed);
}
int main() {
    try {
        for (unsigned stride = 1; stride < 50; ++stride) {
            std::vector<robobaton::Record> messages;
            robobaton::Decoder decoder([&](const robobaton::Record& value) { messages.push_back(value); });
            auto bytes = packet(2, 9007199254740993ULL, {'a','b'}, 4, 0, 1);
            auto control = packet(0, 1, {'x'}, 1, 0, 3);
            auto end = packet(2, 9007199254740993ULL, {'c','d'}, 4, 2, 2);
            bytes.insert(bytes.end(), control.begin(), control.end());
            bytes.insert(bytes.end(), end.begin(), end.end());
            for (std::size_t offset = 0; offset < bytes.size(); offset += stride)
                decoder.feed(bytes.data()+offset, std::min<std::size_t>(stride, bytes.size()-offset));
            decoder.finish();
            check(messages.size() == 2 && messages[1].payload == Bytes({'a','b','c','d'}) &&
                  messages[1].sequence == 9007199254740993ULL);
        }
        auto valid = packet(2, 1, {'a'}, 1, 0, 3);
        for (std::size_t length = 1; length < valid.size(); ++length) {
            robobaton::Decoder decoder([](const robobaton::Record&) {});
            decoder.feed(valid.data(), length);
            rejected([&] { decoder.finish(); });
        }
        for (unsigned field : {0U, 4U, 6U, 8U, 10U, 12U, 24U, 28U, 32U, 36U}) {
            auto bytes = valid;
            bytes[field] = 255;
            robobaton::Decoder decoder([](const robobaton::Record&) {});
            rejected([&] { decoder.feed(bytes.data(), bytes.size()); decoder.finish(); });
        }
        robobaton::Decoder duplicate([](const robobaton::Record&) {});
        duplicate.feed(valid.data(), valid.size());
        rejected([&] { duplicate.feed(valid.data(), valid.size()); });
        robobaton::Decoder totals([](const robobaton::Record&) {});
        auto first = packet(2, 1, {'a'}, 3, 0, 1);
        totals.feed(first.data(), first.size());
        auto changed = packet(2, 1, {'b'}, 2, 1, 2);
        rejected([&] { totals.feed(changed.data(), changed.size()); });
        std::cout << "RBH1 split/interleave/limits/truncation tests passed" << std::endl;
    } catch (const std::exception& error) {
        std::cerr << error.what() << std::endl;
        return 1;
    }
}
