/**
 * 記錄介面——刻意不綁任何 logger 實作（NestJS `Logger`、pino、winston 皆可橋接）。
 * 未提供時 client 完全不輸出訊息。
 */
export interface FusionLogger {
  debug?(message: string): void;
  warn(message: string): void;
  error?(message: string): void;
}
