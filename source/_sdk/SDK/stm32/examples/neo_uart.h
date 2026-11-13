#ifndef NEO_UART_H
#define NEO_UART_H
#include "main.h"
#include "neo_mavlink.h"

HAL_StatusTypeDef neo_uart_start(UART_HandleTypeDef *uart);
void neo_uart_poll(void);
int neo_uart_latest(neo_odometry_t *output);
#endif
