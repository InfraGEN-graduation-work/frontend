import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const BASE_URL = "http://infragen.kro.kr/api/v1";

interface AuthContextType {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
  logout: () => Promise<void>;
  isInitializing: boolean;
  isAutoSaveEnabled: boolean;
  setIsAutoSaveEnabled: (enabled: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(true);

  const reissueToken = async (): Promise<string | null> => {
    try {
      const res = await fetch(`${BASE_URL}/auth/reissue`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && (data.isSuccess ?? data.is_success)) {
        setAccessToken(data.result.accessToken);
        return data.result.accessToken;
      }
    } catch (err) {
      console.error("Token reissue failed", err);
    }
    
    setAccessToken(null);
    const path = window.location.pathname;
    if (path !== '/' && path !== '/login' && path !== '/signup' && path !== '/oauth/kakao/callback') {
      window.location.href = '/login';
    }
    return null;
  };

  const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    let currentToken = accessToken;
    
    if (!currentToken) {
      currentToken = await reissueToken();
    }

    const makeRequest = (tokenToUse: string) => {
      const headers = new Headers(options.headers || {});
      headers.set('Authorization', `Bearer ${tokenToUse}`);
      return fetch(url, { ...options, headers, credentials: 'include' });
    };

    if (!currentToken) {
      return fetch(url, { ...options, credentials: 'include' });
    }

    let response = await makeRequest(currentToken);
    
    if (response.status === 401) {
      currentToken = await reissueToken();
      if (currentToken) {
        response = await makeRequest(currentToken);
      }
    }

    if (!response.ok && response.status !== 401) {
      try {
        const errorData = await response.clone().json();
        const msg = (errorData.result && typeof errorData.result === 'string') 
                    ? errorData.result 
                    : (errorData.message || '서버 통신 중 오류가 발생했습니다.');
        window.dispatchEvent(new CustomEvent('global-toast', { detail: msg }));
      } catch (e) {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: `오류가 발생했습니다. (Status: ${response.status})` }));
      }
    }

    return response;
  };

  const logout = async () => {
    if (accessToken) {
      try {
        await fetch(`${BASE_URL}/members/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}` },
          credentials: 'include'
        });
      } catch (err) {
        console.error("Logout request failed", err);
      }
    }
    setAccessToken(null);
    window.location.href = '/login';
  };

  useEffect(() => {
    reissueToken().finally(() => setIsInitializing(false));
  }, []);

  return (
    <AuthContext.Provider value={{ 
      accessToken, setAccessToken, fetchWithAuth, logout, isInitializing,
      isAutoSaveEnabled, setIsAutoSaveEnabled
    }}>
      {!isInitializing && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};