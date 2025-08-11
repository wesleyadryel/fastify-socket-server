export interface SocketData {
  userId?: string;
  authenticated?: boolean;
}

export interface ClientToServerEvents {
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (data: MessageData) => void;
}

export interface ServerToClientEvents {
  messageReceived: (data: MessageWithUser) => void;
  userJoined: (data: UserRoomEvent) => void;
  userLeft: (data: UserRoomEvent) => void;
}

export interface MessageData {
  content: string;
  roomId?: string;
  type?: 'text' | 'system' | 'notification';
}

export interface MessageWithUser extends MessageData {
  userId: string;
  timestamp: string;
}

export interface UserRoomEvent {
  userId: string;
  roomId: string;
}

// Types for socket data
// Events the client can send to the server
// Events the server can send to the client
// Message data types
