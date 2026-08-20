import React, { useState, useCallback, useEffect, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentUserProfile } from "@/lib/api";
import { AuthContext } from "./authContextDef";
import type { User } from "./authContextDef";

// Re-export types for backward compatibility
export type { UserRole, User, AuthContextType } from "./authContextDef";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const profile = await fetchCurrentUserProfile();
      if (profile) {
        setUser({
          user_id: profile.user_id,
          username: profile.username,
          role: profile.role,
          nama_lengkap: profile.nama_lengkap,
          kelas: profile.kelas,
          mapel: profile.mapel,
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // "Ingat saya" => izinkan persist di localStorage. Jika tidak diaktifkan, sesi
    // hanya berlaku selama tab hidup (gate via sessionStorage.active_session).
    const rememberMe = localStorage.getItem("remember_me") === "1";
    const activeSession = sessionStorage.getItem("active_session");

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && !activeSession && !rememberMe) {
        // Bukan tab aktif & tidak diingat -> paksa logout
        await supabase.auth.signOut();
        setUser(null);
        setLoading(false);
        return;
      }

      if (session?.user && (activeSession || rememberMe)) {
        // Tandai tab ini sebagai aktif agar konsisten dengan logika lama
        sessionStorage.setItem("active_session", "true");
        await loadProfile();
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          sessionStorage.setItem("active_session", "true");
        } else if (event === "SIGNED_OUT") {
          sessionStorage.removeItem("active_session");
          // JANGAN hapus remember_me / remembered_username di sini —
          // SIGNED_OUT bisa terpicu oleh refresh token gagal / sesi expired.
          // Pembersihan flag dilakukan eksplisit di fungsi logout().
          setUser(null);
        }
        setLoading(false);
      }
    );

    init();

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const login = useCallback(async (rawUsername: string, password: string, rememberMe: boolean = false) => {
    // Normalisasi fleksibel: hapus spasi, tanda baca/simbol, lowercase
    const username = rawUsername.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const email = `${username}@ceknilai.local`;
    let { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      // Fallback: Jika admin pertama kali belum terdaftar di Supabase Auth, otomatis daftarkan via API Auth
      if (username === "admin" && password === "admin123") {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: "admin", nama_lengkap: "Administrator" }
          }
        });
        if (!signUpError && signUpData.user) {
          data = signUpData as any;
          error = null;
        } else {
          return false;
        }
      } else {
        return false;
      }
    }

    if (!data?.user) return false;

    sessionStorage.setItem("active_session", "true");
    if (rememberMe) {
      localStorage.setItem("remember_me", "1");
      localStorage.setItem("remembered_username", rawUsername);
    } else {
      localStorage.removeItem("remember_me");
      localStorage.removeItem("remembered_username");
    }
    // Pass userId directly to skip redundant getSession call
    const profile = await fetchCurrentUserProfile(data.user.id);
    if (profile) {
      setUser({
        user_id: profile.user_id,
        username: profile.username,
        role: profile.role,
        nama_lengkap: profile.nama_lengkap,
        kelas: profile.kelas,
        mapel: profile.mapel,
      });
    }
    return true;
  }, []);

  const logout = useCallback(async () => {
    // Hapus flag sesi, tapi PERTAHANKAN remembered_username agar
    // form login bisa pre-fill saat user kembali login.
    localStorage.removeItem("remember_me");
    sessionStorage.removeItem("active_session");
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
