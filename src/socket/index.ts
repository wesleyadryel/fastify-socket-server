import { Socket } from 'socket.io';
import { handleJoinRoom, handleLeaveRoom, handleDynamicEvents, handleDisconnect } from './events';

export function registerSocketHandlers(socket: Socket) {
  handleJoinRoom(socket);
  handleLeaveRoom(socket);
  handleDynamicEvents(socket);
  handleDisconnect(socket);
}
