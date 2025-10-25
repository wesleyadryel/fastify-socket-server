import { Socket } from 'socket.io';
import { handleSendMessage, handleJoinRoom, handleLeaveRoom, handleDynamicEvents } from './events';

export function registerSocketHandlers(socket: Socket) {
  handleSendMessage(socket);
  handleJoinRoom(socket);
  handleLeaveRoom(socket);
  handleDynamicEvents(socket);
}
