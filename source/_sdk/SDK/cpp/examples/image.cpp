#include <robobaton/client.hpp>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>

int main(int argc, char** argv) {
    try {
        if (argc != 4) throw std::runtime_error("Usage: neo_image HTTP_ORIGIN OUTPUT_DIRECTORY COUNT");
        const std::string count_text = argv[3];
        std::size_t end = 0;
        const auto count = std::stoull(count_text, &end);
        if (count == 0 || count > 100000 || end != count_text.size() || count_text.front() == '-')
            throw std::runtime_error("COUNT must be between 1 and 100000");
        const std::filesystem::path directory(argv[2]);
        if (!std::filesystem::is_directory(directory))
            throw std::runtime_error("Create the output directory before starting");
        std::uint64_t received = 0;
        robobaton::observe_gray_jpeg(argv[1], [&](const robobaton::JpegFrame& frame) {
            const auto path = directory / (std::to_string(frame.sequence) + ".jpg");
            const auto sidecar = directory / (std::to_string(frame.sequence) + ".json");
            if (std::filesystem::exists(path) || std::filesystem::exists(sidecar))
                throw std::runtime_error("Output already exists; use a fresh directory");
            std::ofstream output(path, std::ios::binary);
            output.write(reinterpret_cast<const char*>(frame.data.data()), frame.data.size());
            output.close();
            std::ofstream metadata(sidecar);
            metadata << "{\"frame\":" << frame.metadata_json << ",\"config\":" << frame.config_json << "}\n";
            metadata.close();
            if (!output || !metadata) throw std::runtime_error("Cannot save image and metadata");
            std::cout << path.string() << '\n';
            return ++received < count;
        });
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
