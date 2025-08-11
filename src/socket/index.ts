import { Socket } from 'socket.io';
import { handleSendMessage, handleJoinRoom, handleLeaveRoom } from './events';

export function registerSocketHandlers(socket: Socket) {
  handleSendMessage(socket);
  handleJoinRoom(socket);
  handleLeaveRoom(socket);
}
