import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';

interface SocketMetadata {
  userEmail?: string;
  conversationIds: Set<string>;
}

export class WebSocketService {
  private io: SocketIOServer;
  private connectedClients: Map<string, Socket> = new Map();
  private socketMetadata: Map<string, SocketMetadata> = new Map();
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
    logger.info('WebSocket service initialized');
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      const clientId = socket.id;
      this.connectedClients.set(clientId, socket);
      this.socketMetadata.set(clientId, { conversationIds: new Set() });
      logger.info(`Client connected: ${clientId}`);

      socket.emit('connected', {
        message: 'Connected to Synkio WebSocket server',
        clientId,
        timestamp: new Date().toISOString()
      });

      socket.on('subscribe:conversation', (conversationId: string) => {
        const metadata = this.socketMetadata.get(clientId);
        if (metadata) {
          socket.join(`conversation:${conversationId}`);
          metadata.conversationIds.add(conversationId);
          logger.info(`Client ${clientId} subscribed to conversation ${conversationId}`);
          socket.emit('subscribed', {
            type: 'conversation',
            conversationId,
            timestamp: new Date().toISOString()
          });
        }
      });

      socket.on('unsubscribe:conversation', (conversationId: string) => {
        const metadata = this.socketMetadata.get(clientId);
        if (metadata) {
          socket.leave(`conversation:${conversationId}`);
          metadata.conversationIds.delete(conversationId);
          logger.info(`Client ${clientId} unsubscribed from conversation ${conversationId}`);
        }
      });

      socket.on('subscribe:user', (userEmail: string) => {
        const metadata = this.socketMetadata.get(clientId);
        if (metadata) {
          const normalizedEmail = userEmail.toLowerCase().trim();
          metadata.userEmail = normalizedEmail;
          
          if (!this.userSockets.has(normalizedEmail)) {
            this.userSockets.set(normalizedEmail, new Set());
          }
          this.userSockets.get(normalizedEmail)!.add(clientId);
          
          logger.info(`Client ${clientId} subscribed as user ${normalizedEmail}`);
          socket.emit('subscribed', {
            type: 'user',
            userEmail: normalizedEmail,
            timestamp: new Date().toISOString()
          });
        }
      });

      socket.on('ping', () => {
        socket.emit('pong', {
          timestamp: new Date().toISOString()
        });
      });

      socket.on('disconnect', (reason: string) => {
        const metadata = this.socketMetadata.get(clientId);
        if (metadata?.userEmail) {
          const userSockets = this.userSockets.get(metadata.userEmail);
          if (userSockets) {
            userSockets.delete(clientId);
            if (userSockets.size === 0) {
              this.userSockets.delete(metadata.userEmail);
            }
          }
        }
        this.connectedClients.delete(clientId);
        this.socketMetadata.delete(clientId);
        logger.info(`Client disconnected: ${clientId}, reason: ${reason}`);
      });

      socket.on('error', (error: Error) => {
        logger.error(`Socket error for ${clientId}:`, error);
      });
    });
  }

  notifyConversation(conversationId: string, event: string, data: any): void {
    this.io.to(`conversation:${conversationId}`).emit(event, {
      conversationId,
      ...data,
      timestamp: new Date().toISOString()
    });
    logger.info(`Notified conversation ${conversationId} with event: ${event}`);
  }

  notifyUser(userEmail: string, event: string, data: any): void {
    const normalizedEmail = userEmail.toLowerCase().trim();
    const socketIds = this.userSockets.get(normalizedEmail);
    
    if (socketIds && socketIds.size > 0) {
      socketIds.forEach(socketId => {
        const socket = this.connectedClients.get(socketId);
        if (socket) {
          socket.emit(event, {
            userEmail: normalizedEmail,
            ...data,
            timestamp: new Date().toISOString()
          });
        }
      });
      logger.info(`Notified user ${normalizedEmail} with event: ${event} (${socketIds.size} connections)`);
    }
  }

  notifyUsers(userEmails: string[], event: string, data: any): void {
    userEmails.forEach(email => this.notifyUser(email, event, data));
  }

  broadcast(event: string, data: any): void {
    this.io.emit(event, data);
    logger.info(`Broadcasted event: ${event} to ${this.connectedClients.size} clients`);
  }

  emitToClient(clientId: string, event: string, data: any): boolean {
    const socket = this.connectedClients.get(clientId);
    if (socket) {
      socket.emit(event, data);
      return true;
    }
    return false;
  }

  getConnectedClients(): number {
    return this.connectedClients.size;
  }

  getIO(): SocketIOServer {
    return this.io;
  }
}

