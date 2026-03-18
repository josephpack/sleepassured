import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  User,
  AuthResponse,
  login as apiLogin,
  signup as apiSignup,
  logout as apiLogout,
  refreshAccessToken,
  getCurrentUser,
  clearStoredRefreshToken,
  getLastRoute,
  clearLastRoute,
  LoginRequest,
  SignupRequest,
} from "@/features/auth/api/auth";
import { setAuthHandlers } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  signup: (data: SignupRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ACCESS_TOKEN_REFRESH_INTERVAL = 14 * 60 * 1000; // 14 minutes (1 min before expiry)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const handleUnauthorized = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    clearStoredRefreshToken();
    clearLastRoute();
    navigate("/login");
  }, [navigate]);

  // Refresh handler for the API client's 401 retry mechanism.
  // Returns the new access token on success, null on failure.
  const handleRefreshForApi = useCallback(async (): Promise<string | null> => {
    try {
      const { accessToken: newToken } = await refreshAccessToken();
      setAccessToken(newToken);
      return newToken;
    } catch {
      return null;
    }
  }, []);

  // Set up auth handlers for API client (token getter + unauthorized redirect + silent refresh)
  useEffect(() => {
    setAuthHandlers(() => accessToken, handleUnauthorized, handleRefreshForApi);
  }, [accessToken, handleUnauthorized, handleRefreshForApi]);

  // Refresh access token
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const { accessToken: newToken } = await refreshAccessToken();
      setAccessToken(newToken);
      return true;
    } catch {
      setUser(null);
      setAccessToken(null);
      clearStoredRefreshToken();
      return false;
    }
  }, []);

  // Initial auth check on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const refreshed = await refreshToken();
        if (refreshed) {
          const { user: currentUser } = await getCurrentUser();
          setUser(currentUser);

          // Restore last route on PWA relaunch (only if we're on the default start page)
          const savedRoute = getLastRoute();
          if (
            savedRoute &&
            savedRoute !== location.pathname &&
            (location.pathname === "/dashboard" || location.pathname === "/")
          ) {
            navigate(savedRoute, { replace: true });
          }
        }
      } catch {
        setUser(null);
        setAccessToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on mount
  }, []);

  // Set up token refresh interval
  useEffect(() => {
    if (!accessToken) return;

    const intervalId = setInterval(async () => {
      await refreshToken();
    }, ACCESS_TOKEN_REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [accessToken, refreshToken]);

  const handleAuthResponse = useCallback((response: AuthResponse) => {
    setUser(response.user);
    setAccessToken(response.accessToken);
  }, []);

  const login = useCallback(
    async (data: LoginRequest) => {
      const response = await apiLogin(data);
      handleAuthResponse(response);
    },
    [handleAuthResponse]
  );

  const signup = useCallback(
    async (data: SignupRequest) => {
      const response = await apiSignup(data);
      handleAuthResponse(response);
    },
    [handleAuthResponse]
  );

  const refreshUser = useCallback(async () => {
    const { user: currentUser } = await getCurrentUser();
    setUser(currentUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setAccessToken(null);
      clearStoredRefreshToken();
      clearLastRoute();
      navigate("/login");
    }
  }, [navigate]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
