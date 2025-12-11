import { logger } from '../utils/logger';
import { WebSocketService } from './WebSocketService';

let wsServiceInstance: WebSocketService | null = null;

export function setWebSocketService(service: WebSocketService): void {
  wsServiceInstance = service;
}

export function getWebSocketService(): WebSocketService | null {
  if (!wsServiceInstance) {
    logger.error('WebSocketService has not been initialized');
    return null;
  }
  return wsServiceInstance;
}

