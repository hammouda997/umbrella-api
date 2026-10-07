import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { CommsService } from './comms.service';

type SocketUser = {
  id: number;
  email: string;
  role: Role;
};

type AuthedSocket = Socket & { data: { user?: SocketUser } };

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3010')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  },
  namespace: '/comms',
})
export class CommsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(CommsGateway.name);
  private readonly online = new Map<number, Set<string>>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly comms: CommsService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (typeof client.handshake.headers.authorization === 'string'
          ? client.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : undefined);
      if (!token) {
        client.disconnect(true);
        return;
      }
      const payload = await this.jwt.verifyAsync<{
        sub: number;
        email: string;
        role: Role;
      }>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      const user: SocketUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      client.data.user = user;
      void client.join(`user:${user.id}`);
      const sockets = this.online.get(user.id) ?? new Set<string>();
      sockets.add(client.id);
      this.online.set(user.id, sockets);
      this.server.emit('presence', { userId: user.id, online: true });
    } catch (error) {
      this.logger.warn(`Socket auth failed: ${String(error)}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket) {
    const user = client.data.user;
    if (!user) return;
    const sockets = this.online.get(user.id);
    if (!sockets) return;
    sockets.delete(client.id);
    if (sockets.size === 0) {
      this.online.delete(user.id);
      this.server.emit('presence', { userId: user.id, online: false });
    }
  }

  emitToUser(userId: number, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitMessageNew(
    participantIds: number[],
    payload: { conversationId: number; message: unknown },
  ) {
    for (const id of participantIds) {
      this.emitToUser(id, 'message:new', payload);
    }
  }

  private requireUser(client: AuthedSocket): SocketUser {
    const user = client.data.user;
    if (!user) throw new Error('Unauthenticated');
    return user;
  }

  @SubscribeMessage('conversation:join')
  async joinConversation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId: number },
  ) {
    const user = this.requireUser(client);
    const ids = await this.comms.participantIds(body.conversationId);
    if (!ids.includes(user.id)) return { ok: false };
    void client.join(`conversation:${body.conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('typing')
  async typing(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId: number; typing: boolean },
  ) {
    const user = this.requireUser(client);
    const ids = await this.comms.participantIds(body.conversationId);
    if (!ids.includes(user.id)) return;
    for (const id of ids) {
      if (id === user.id) continue;
      this.emitToUser(id, 'typing', {
        conversationId: body.conversationId,
        userId: user.id,
        typing: body.typing,
      });
    }
  }

  @SubscribeMessage('call:offer')
  relayOffer(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    body: { callId: number; toUserId: number; sdp: unknown },
  ) {
    const user = this.requireUser(client);
    this.emitToUser(body.toUserId, 'call:offer', {
      callId: body.callId,
      fromUserId: user.id,
      sdp: body.sdp,
    });
  }

  @SubscribeMessage('call:answer')
  relayAnswer(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    body: { callId: number; toUserId: number; sdp: unknown },
  ) {
    const user = this.requireUser(client);
    this.emitToUser(body.toUserId, 'call:answer', {
      callId: body.callId,
      fromUserId: user.id,
      sdp: body.sdp,
    });
  }

  @SubscribeMessage('call:ice')
  relayIce(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    body: { callId: number; toUserId: number; candidate: unknown },
  ) {
    const user = this.requireUser(client);
    this.emitToUser(body.toUserId, 'call:ice', {
      callId: body.callId,
      fromUserId: user.id,
      candidate: body.candidate,
    });
  }

  @SubscribeMessage('call:hangup')
  relayHangup(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { callId: number; toUserId: number },
  ) {
    const user = this.requireUser(client);
    this.emitToUser(body.toUserId, 'call:hangup', {
      callId: body.callId,
      fromUserId: user.id,
    });
  }

  @SubscribeMessage('call:reject')
  relayReject(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { callId: number; toUserId: number },
  ) {
    const user = this.requireUser(client);
    this.emitToUser(body.toUserId, 'call:reject', {
      callId: body.callId,
      fromUserId: user.id,
    });
  }
}
