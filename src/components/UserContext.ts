import React from 'react';

export type ManagedVenue = {
  placeId: string;
  name: string;
  photoUrl?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

export type UserData = {
  _id: string;
  username: string;
  email: string;
  name?: string;
  profilePicUrl?: string;
  isAdmin?: boolean;
  accountType?: 'user' | 'venue';
  managedVenue?: ManagedVenue | null;
};

export interface UserContextType {
  userData: UserData | null;
  setUserData: React.Dispatch<React.SetStateAction<UserData | null>>;
  isAdmin: boolean;
  checkAdminStatus: () => Promise<void>;
}

const UserContext = React.createContext<UserContextType | undefined>(undefined);

export default UserContext;
