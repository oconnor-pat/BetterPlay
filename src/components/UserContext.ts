import React from 'react';

export type UserData = {
  _id: string;
  username: string;
  email: string;
  profilePicUrl?: string;
  isAdmin?: boolean;
};

export interface UserContextType {
  userData: UserData | null;
  setUserData: React.Dispatch<React.SetStateAction<UserData | null>>;
  isAdmin: boolean;
  checkAdminStatus: () => Promise<void>;
}

const UserContext = React.createContext<UserContextType | undefined>(undefined);

export default UserContext;
