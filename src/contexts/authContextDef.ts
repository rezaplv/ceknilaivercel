import { createContext } from "react";

export type UserRole = "ADMIN" | "GURU" | "SISWA";

export interface User {
  user_id: string;
  username: string;
  role: UserRole;
  nama_lengkap: string;
  kelas?: string[];
  mapel?: string[];
}

export interface AuthContextType {
  user: User | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);
