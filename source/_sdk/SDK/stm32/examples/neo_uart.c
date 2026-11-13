#include "neo_uart.h"

#ifndef NEO_SYSTEM_ID
#define NEO_SYSTEM_ID 1
#endif
#ifndef NEO_COMPONENT_ID
#define NEO_COMPONENT_ID 197
#endif

static UART_HandleTypeDef *neo_uart;
static uint8_t incoming;
static uint8_t ring[1024];
static volatile uint16_t head;
static volatile uint16_t tail;
static volatile uint8_t fault;
static volatile uint32_t last_byte_ms;
static neo_mavlink_parser_t parser;
static neo_odometry_t latest;
static uint32_t last_message_ms;
static uint8_t available;

HAL_StatusTypeDef neo_uart_start(UART_HandleTypeDef *uart) {
    neo_uart = uart;
    head = tail = 0;
    fault = available = 0;
    last_byte_ms = HAL_GetTick();
    neo_mavlink_reset(&parser);
    return HAL_UART_Receive_IT(neo_uart, &incoming, 1);
}

void HAL_UART_RxCpltCallback(UART_HandleTypeDef *uart) {
    uint16_t next;
    if (uart != neo_uart) return;
    next = (uint16_t)((head + 1) % sizeof(ring));
    if (next == tail) {
        fault = 1;
    } else {
        ring[head] = incoming;
        __DMB();
        head = next;
    }
    last_byte_ms = HAL_GetTick();
    if (HAL_UART_Receive_IT(neo_uart, &incoming, 1) != HAL_OK) fault = 1;
}

void HAL_UART_ErrorCallback(UART_HandleTypeDef *uart) {
    if (uart == neo_uart) fault = 1;
}

void neo_uart_poll(void) {
    neo_odometry_t message;
    if (fault) {
        uint32_t primask = __get_PRIMASK();
        __disable_irq();
        tail = head;
        fault = 0;
        __set_PRIMASK(primask);
        neo_mavlink_reset(&parser);
        available = 0;
        HAL_UART_AbortReceive(neo_uart);
        if (HAL_UART_Receive_IT(neo_uart, &incoming, 1) != HAL_OK) fault = 1;
        return;
    }
    while (tail != head) {
        uint8_t byte;
        __DMB();
        byte = ring[tail];
        __DMB();
        tail = (uint16_t)((tail + 1) % sizeof(ring));
        if (neo_mavlink_feed(&parser, byte, &message) &&
            message.system_id == NEO_SYSTEM_ID && message.component_id == NEO_COMPONENT_ID) {
            latest = message;
            last_message_ms = HAL_GetTick();
            available = 1;
        }
    }
    if ((uint32_t)(HAL_GetTick() - last_byte_ms) >= 20) neo_mavlink_reset(&parser);
}

int neo_uart_latest(neo_odometry_t *output) {
    if (!available || latest.quality == -1 || (uint32_t)(HAL_GetTick() - last_message_ms) > 250)
        return 0;
    *output = latest;
    return 1;
}
