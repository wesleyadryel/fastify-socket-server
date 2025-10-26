export interface Room {
  id: string;
  name: string;
  description?: string;
  allowSelfJoin: boolean;
  createdAt: string;
  updatedAt: string;
  members: string[];
  maxMembers?: number;
  isPrivate: boolean;
}

export interface RoomMember {
  userUuid: string;
  joinedAt: string;
  role: 'admin' | 'member';
}

export interface CreateRoomData {
  name: string;
  description?: string;
  allowSelfJoin: boolean;
  maxMembers?: number;
  isPrivate: boolean;
}

export interface UpdateRoomData {
  name?: string;
  description?: string;
  allowSelfJoin?: boolean;
  maxMembers?: number;
  isPrivate?: boolean;
}

export interface AddMemberData {
  roomId: string;
  userUuid: string;
}

export interface RemoveMemberData {
  roomId: string;
  userUuid: string;
}
