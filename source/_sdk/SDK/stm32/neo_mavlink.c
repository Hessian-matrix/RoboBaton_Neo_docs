#include "neo_mavlink.h"
#include <float.h>
#include <math.h>
#include <string.h>

#if FLT_RADIX != 2 || FLT_MANT_DIG != 24 || FLT_MAX_EXP != 128
#error IEEE754 binary32 float required
#endif

static uint16_t crc_byte(uint16_t crc, uint8_t byte) {
    uint8_t mixed = byte ^ (uint8_t)crc;
    mixed ^= (uint8_t)(mixed << 4);
    return (uint16_t)((crc >> 8) ^ ((uint16_t)mixed << 8) ^ ((uint16_t)mixed << 3) ^ (mixed >> 4));
}

static uint64_t little(const uint8_t *bytes, size_t size) {
    uint64_t value = 0;
    size_t index;
    for (index = 0; index < size; ++index) value |= (uint64_t)bytes[index] << (8 * index);
    return value;
}

static float read_float(const uint8_t *bytes) {
    uint32_t bits = (uint32_t)little(bytes, 4);
    float value;
    memcpy(&value, &bits, sizeof(value));
    return value;
}

void neo_mavlink_reset(neo_mavlink_parser_t *parser) {
    parser->used = 0;
    parser->expected = 0;
}

int neo_mavlink_feed(neo_mavlink_parser_t *parser, uint8_t byte, neo_odometry_t *output) {
    uint16_t crc = 0xffff;
    uint16_t index;
    uint8_t length;
    const uint8_t *payload;
    neo_odometry_t value;
    float norm = 0;
    if (parser->used == 0 && byte != 0xfd) return 0;
    parser->bytes[parser->used++] = byte;
    if (parser->used == 3) {
        parser->expected = (uint16_t)(12 + parser->bytes[1] + ((byte & 1) ? 13 : 0));
    }
    if (parser->expected == 0 || parser->used < parser->expected) return 0;
    length = parser->bytes[1];
    neo_mavlink_reset(parser);
    if (parser->bytes[2] != 0 || parser->bytes[3] != 0 || length < 230 || length > 233 ||
        little(parser->bytes + 7, 3) != 331) return 0;
    for (index = 1; index < (uint16_t)(10 + length); ++index)
        crc = crc_byte(crc, parser->bytes[index]);
    crc = crc_byte(crc, 91);
    if (crc != little(parser->bytes + 10 + length, 2)) return 0;
    payload = parser->bytes + 10;
    memset(&value, 0, sizeof(value));
    value.time_usec = little(payload, 8);
    value.system_id = parser->bytes[5];
    value.component_id = parser->bytes[6];
    value.frame_id = payload[228];
    value.child_frame_id = payload[229];
    value.reset_counter = length > 230 ? payload[230] : 0;
    value.estimator_type = length > 231 ? payload[231] : 0;
    value.quality = length > 232 ? (int8_t)payload[232] : 0;
    for (index = 0; index < 3; ++index) {
        value.position[index] = read_float(payload + 8 + 4 * index);
        value.linear_velocity[index] = read_float(payload + 36 + 4 * index);
        value.angular_velocity[index] = read_float(payload + 48 + 4 * index);
        if (!isfinite(value.position[index]) || !isfinite(value.linear_velocity[index]) ||
            !isfinite(value.angular_velocity[index])) return 0;
    }
    for (index = 0; index < 4; ++index) {
        value.quaternion_wxyz[index] = read_float(payload + 20 + 4 * index);
        if (!isfinite(value.quaternion_wxyz[index])) return 0;
        norm += value.quaternion_wxyz[index] * value.quaternion_wxyz[index];
    }
    if (!value.time_usec || fabsf(norm - 1.0f) > 0.001f || value.quality < -1 || value.quality > 100)
        return 0;
    *output = value;
    return 1;
}
