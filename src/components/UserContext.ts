import React from 'react';

type UserData = {
  _id: string;
};

interface UserContextType {
  userData: UserData | null;
  setUserData: React.Dispatch<React.SetStateAction<UserData | null>>;
}

const UserContext = React.createContext<UserContextType | undefined>(undefined);

export default UserContext;
