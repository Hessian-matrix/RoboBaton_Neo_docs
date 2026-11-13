#ifndef NEO_MAVLINK_H
#define NEO_MAVLINK_H
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    uint64_t time_usec;
    float position[3];
    float quaternion_wxyz[4];
    float linear_velocity[3];
    float angular_velocity[3];
    uint8_t system_id;
    uint8_t component_id;
    uint8_t frame_id;
    uint8_t child_frame_id;
    uint8_t reset_counter;
    uint8_t estimator_type;
    int8_t quality;
} neo_odometry_t;

typedef struct {
    uint8_t bytes[280];
    uint16_t used;
    uint16_t expected;
} neo_mavlink_parser_t;

void neo_mavlink_reset(neo_mavlink_parser_t *parser);
int neo_mavlink_feed(neo_mavlink_parser_t *parser, uint8_t byte, neo_odometry_t *output);

#ifdef __cplusplus
}
#endif
#endif
