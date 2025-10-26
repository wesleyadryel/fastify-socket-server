export interface Room {
  id: string;
  name: string;
  description?: string;
  allowSelfJoin: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  members: string[];
  maxMembers?: number;
  isPrivate: boolean;
}

export interface RoomMember {
  userId: string;
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
  userId: string;
}

export interface RemoveMemberData {
  roomId: string;
  userId: string;
}
