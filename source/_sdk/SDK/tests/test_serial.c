#include "neo_mavlink.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void check(int value) { if (!value) { fputs("serial assertion failed\n", stderr); exit(1); } }
static void put_float(uint8_t *bytes, float value) {
    uint32_t bits;
    unsigned index;
    memcpy(&bits, &value, 4);
    for (index = 0; index < 4; ++index) bytes[index] = (uint8_t)(bits >> (8 * index));
}
static size_t seal(uint8_t *bytes) {
    uint16_t crc = 0xffff;
    size_t index;
    unsigned length = bytes[1];
    for (index = 1; index <= length + 10; ++index) {
        unsigned bit;
        uint8_t byte = index == length + 10 ? 91 : bytes[index];
        crc ^= byte;
        for (bit = 0; bit < 8; ++bit) crc = (uint16_t)((crc >> 1) ^ ((crc & 1) ? 0x8408 : 0));
    }
    bytes[length + 10] = crc & 255;
    bytes[length + 11] = crc >> 8;
    return length + 12;
}
static size_t make_packet(uint8_t *bytes, unsigned length) {
    memset(bytes, 0, 280);
    bytes[0] = 0xfd; bytes[1] = (uint8_t)length; bytes[4] = 1;
    bytes[5] = 1; bytes[6] = 197; bytes[7] = 75; bytes[8] = 1;
    bytes[10] = 1;
    put_float(bytes + 18, 1.25f);
    put_float(bytes + 30, 1.0f);
    bytes[238] = 20; bytes[239] = 12;
    if (length > 230) bytes[240] = 7;
    if (length > 231) bytes[241] = 2;
    if (length > 232) bytes[242] = 80;
    return seal(bytes);
}
static int feed(neo_mavlink_parser_t *parser, const uint8_t *bytes, size_t length, neo_odometry_t *output) {
    size_t index;
    int received = 0;
    for (index = 0; index < length; ++index) received += neo_mavlink_feed(parser, bytes[index], output);
    return received;
}
int main(void) {
    neo_mavlink_parser_t parser;
    neo_odometry_t output;
    uint8_t bytes[280];
    size_t length, cut;
    unsigned payload;
    neo_mavlink_reset(&parser);
    for (payload = 230; payload <= 233; ++payload) {
        length = make_packet(bytes, payload);
        check(feed(&parser, bytes, length, &output) == 1);
        check(output.time_usec == 1 && output.position[0] == 1.25f &&
              output.quaternion_wxyz[0] == 1.0f && output.frame_id == 20 &&
              output.child_frame_id == 12 && output.system_id == 1 && output.component_id == 197);
        check(output.quality == (payload == 233 ? 80 : 0));
        check(output.reset_counter == (payload > 230 ? 7 : 0));
    }
    length = make_packet(bytes, 233);
    for (cut = 1; cut < length; ++cut) {
        neo_mavlink_reset(&parser);
        check(feed(&parser, bytes, cut, &output) == 0);
        neo_mavlink_reset(&parser);
        check(feed(&parser, bytes, length, &output) == 1);
    }
    bytes[40] ^= 1;
    check(feed(&parser, bytes, length, &output) == 0);
    length = make_packet(bytes, 233);
    bytes[2] = 1;
    check(feed(&parser, bytes, length + 13, &output) == 0);
    length = make_packet(bytes, 233);
    check(feed(&parser, bytes, length, &output) == 1);
    bytes[7] = 0;
    check(feed(&parser, bytes, length, &output) == 0);
    length = make_packet(bytes, 233);
    bytes[18] = 0; bytes[19] = 0; bytes[20] = 0xc0; bytes[21] = 0x7f;
    seal(bytes);
    check(feed(&parser, bytes, length, &output) == 0);
    length = make_packet(bytes, 233);
    put_float(bytes + 30, 0.5f); seal(bytes);
    check(feed(&parser, bytes, length, &output) == 0);
    length = make_packet(bytes, 233);
    bytes[242] = 101; seal(bytes);
    check(feed(&parser, bytes, length, &output) == 0);
    neo_mavlink_reset(&parser);
    memset(bytes, 0x55, sizeof(bytes));
    check(feed(&parser, bytes, sizeof(bytes), &output) == 0);
    length = make_packet(bytes, 233);
    check(feed(&parser, bytes, length, &output) == 1);
    puts("MAVLink CRC/length/extensions/truncation/recovery tests passed");
    return 0;
}
