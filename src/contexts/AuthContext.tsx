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
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(true); // 자동 저장 기본값: 켜짐

  // 리프레시 토큰(쿠키)을 이용해 엑세스 토큰 재발급
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
    
    // 갱신 실패 시 토큰 상태 초기화 및 강제 로그아웃 (퍼블릭 페이지 제외)
    setAccessToken(null);
    const path = window.location.pathname;
    if (path !== '/' && path !== '/login' && path !== '/signup' && path !== '/oauth/kakao/callback') {
      window.location.href = '/login';
    }
    return null;
  };

  // 401 에러 발생 시 자동 토큰 갱신 기능을 포함한 fetch 래퍼
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
    window.location.href = '/login'; // 로그아웃 시 명시적 이동
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