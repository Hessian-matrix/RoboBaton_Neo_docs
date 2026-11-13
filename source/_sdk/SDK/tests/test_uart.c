#include "neo_uart.h"
#include "vio_neo/mavlink_output.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static uint8_t *receive_byte;
static uint32_t ticks;
static int aborts;
static int receive_error;
uint32_t HAL_GetTick(void) { return ticks; }
HAL_StatusTypeDef HAL_UART_Receive_IT(UART_HandleTypeDef *uart, uint8_t *data, uint16_t size) {
    (void)uart;
    if (size != 1 || receive_error) return HAL_ERROR;
    receive_byte = data;
    return HAL_OK;
}
HAL_StatusTypeDef HAL_UART_AbortReceive(UART_HandleTypeDef *uart) { (void)uart; ++aborts; return HAL_OK; }
static void check(int value) { if (!value) { fputs("HAL/producer assertion failed\n", stderr); exit(1); } }
static void send(UART_HandleTypeDef *uart, const uint8_t *bytes, size_t length) {
    size_t index;
    for (index = 0; index < length; ++index) {
        *receive_byte = bytes[index];
        HAL_UART_RxCpltCallback(uart);
    }
}
int main(void) {
    UART_HandleTypeDef uart = {1};
    vio_neo_mavlink_config config;
    vio_neo_state_output state;
    neo_odometry_t output;
    uint8_t packet[245];
    double angular[3] = {0.1, 0.2, 0.3};
    size_t length;
    unsigned index;
    memset(&config, 0, sizeof(config));
    memset(&state, 0, sizeof(state));
    config.system_id = 1; config.component_id = 197;
    state.valid = 1; state.timestamp_ns = 123456789000;
    state.position_m[0] = 1.25f; state.position_m[1] = 2.0f; state.position_m[2] = 3.0f;
    state.velocity_m_s[0] = 4.0f; state.velocity_m_s[1] = 5.0f; state.velocity_m_s[2] = 6.0f;
    state.quaternion_wxyz[0] = 1.0f; state.reset_counter = 7;
    length = vio_neo_mavlink_encode(&config, 10, &state, angular, packet);
    check(length >= 242 && length <= 245);
    check(neo_uart_start(&uart) == HAL_OK);
    check(!neo_uart_latest(&output));
    send(&uart, packet, length);
    neo_uart_poll();
    check(neo_uart_latest(&output));
    check(output.time_usec == 123456789 && output.position[0] == 1.25f &&
          output.position[1] == -2.0f && output.position[2] == -3.0f &&
          output.linear_velocity[1] == -5.0f && output.reset_counter == 7 &&
          output.frame_id == 20 && output.child_frame_id == 12 && output.estimator_type == 3);
    ticks += 251;
    check(!neo_uart_latest(&output));
    config.system_id = 2;
    length = vio_neo_mavlink_encode(&config, 11, &state, angular, packet);
    send(&uart, packet, length); neo_uart_poll();
    check(!neo_uart_latest(&output));
    config.system_id = 1;
    length = vio_neo_mavlink_encode(&config, 12, &state, angular, packet);
    send(&uart, packet, 15); neo_uart_poll(); ticks += 21; neo_uart_poll();
    send(&uart, packet, length); neo_uart_poll();
    check(neo_uart_latest(&output));
    for (index = 0; index < 1100; ++index) send(&uart, packet, 1);
    neo_uart_poll();
    check(aborts == 1 && !neo_uart_latest(&output));
    send(&uart, packet, length); neo_uart_poll();
    check(neo_uart_latest(&output));
    HAL_UART_ErrorCallback(&uart); neo_uart_poll();
    check(aborts == 2 && !neo_uart_latest(&output));
    receive_error = 1;
    check(neo_uart_start(&uart) == HAL_ERROR);
    puts("Production MAVLink encoder -> HAL ring -> SDK decoder tests passed");
    return 0;
}
