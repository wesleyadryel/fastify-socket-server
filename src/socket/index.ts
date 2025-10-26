import { Socket } from 'socket.io';
import { handleJoinRoom, handleLeaveRoom, handleDynamicEvents } from './events';

export function registerSocketHandlers(socket: Socket) {
  handleJoinRoom(socket);
  handleLeaveRoom(socket);
  handleDynamicEvents(socket);
}
