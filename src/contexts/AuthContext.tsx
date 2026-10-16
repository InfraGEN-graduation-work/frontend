import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://infragen.p-e.kr/api/v1";
const TOKEN_REFRESH_LEAD_MS = 60000;
const TOKEN_REFRESH_MIN_DELAY_MS = 10000;
const MAX_TIMER_DELAY_MS = 2147483647;

const readTokenLifetimeMs = (token: string): number | null => {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    const exp = Number(payload?.exp);
    if (!Number.isFinite(exp)) return null;
    const iat = Number(payload?.iat);
    return Number.isFinite(iat) ? (exp - iat) * 1000 : exp * 1000 - Date.now();
  } catch (e) {
    return null;
  }
};

interface FetchConfig {
  silent?: boolean;
}

interface AuthContextType {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  fetchWithAuth: (url: string, options?: RequestInit, config?: FetchConfig) => Promise<Response>;
  logout: () => Promise<void>;
  isInitializing: boolean;
  isAutoSaveEnabled: boolean;
  setIsAutoSaveEnabled: (enabled: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(true);
  const accessTokenRef = useRef<string | null>(null);
  const reissueInFlight = useRef<Promise<string | null> | null>(null);
  const csrfTokenRef = useRef<string | null>(null);

  const setAccessToken = (token: string | null) => {
    accessTokenRef.current = token;
    setAccessTokenState(token);
  };

  const bootstrapCsrf = async () => {
    const csrfRes = await fetch(`${BASE_URL}/auth/csrf`, {
      method: 'GET',
      credentials: 'include'
    });
    const token = csrfRes.headers.get("X-XSRF-TOKEN");
    if (!token) console.warn("X-XSRF-TOKEN 응답 헤더를 읽지 못했습니다. 백엔드 CORS 설정의 Access-Control-Expose-Headers를 확인하세요.");
    csrfTokenRef.current = token || null;
    return csrfTokenRef.current;
  };

  const requestReissue = (csrfToken: string | null) => fetch(`${BASE_URL}/auth/reissue`, {
    method: 'POST',
    credentials: 'include',
    headers: csrfToken ? { "X-XSRF-TOKEN": csrfToken } : {}
  });

  const runReissue = async (quiet: boolean): Promise<string | null> => {
    try {
      let res = await requestReissue(csrfTokenRef.current ?? await bootstrapCsrf());

      if (res.status === 403) {
        const errorData = await res.clone().json().catch(() => ({}));
        if (errorData?.code === 'AUTH403_1') {
          res = await requestReissue(await bootstrapCsrf());
        }
      }

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (res.ok && (data.isSuccess ?? data.is_success)) {
          setAccessToken(data.result.accessToken);
          return data.result.accessToken;
        }
      }
    } catch (err) {
      console.error("Token reissue failed", err);
    }

    if (quiet) return null;
    setAccessToken(null);
    const path = window.location.pathname;
    if (path !== '/' && path !== '/login' && path !== '/signup' && path !== '/oauth/kakao/callback') {
      window.location.href = '/login';
    }
    return null;
  };

  const reissueToken = (quiet: boolean = false): Promise<string | null> => {
    if (!reissueInFlight.current) {
      reissueInFlight.current = runReissue(quiet).finally(() => { reissueInFlight.current = null; });
    }
    return reissueInFlight.current;
  };

  const fetchWithAuth = async (url: string, options: RequestInit = {}, config: FetchConfig = {}): Promise<Response> => {
    let currentToken = accessTokenRef.current;
    
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
      const latestToken = accessTokenRef.current;
      currentToken = latestToken && latestToken !== currentToken ? latestToken : await reissueToken();
      if (currentToken) {
        response = await makeRequest(currentToken);
      }
    }

    if (!response.ok && response.status !== 401 && !config.silent) {
      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.clone().json();
          const msg = errorData.code === 'COMMON400_1'
                      ? '입력한 내용 중 올바르지 않은 항목이 있습니다. 다시 확인해 주세요.'
                      : (errorData.result && typeof errorData.result === 'string') 
                        ? errorData.result 
                        : (errorData.message || '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
          if (!String(errorData.code || '').startsWith('COLLAB409')) {
            window.dispatchEvent(new CustomEvent('global-toast', { detail: msg }));
          }
        } else {
          window.dispatchEvent(new CustomEvent('global-toast', { detail: '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }));
        }
      } catch (e) {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }));
      }
    }

    return response;
  };

  const logout = async () => {
    const token = accessTokenRef.current;
    if (token) {
      try {
        const res = await fetch(`${BASE_URL}/members/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'include'
        });
        
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          window.dispatchEvent(new CustomEvent('global-toast', { detail: data.message || '로그아웃 실패' }));
          if (res.status === 403) return;
        }
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

  useEffect(() => {
    if (!accessToken) return;
    const lifetime = readTokenLifetimeMs(accessToken);
    if (lifetime === null || lifetime <= 0) return;
    const lead = Math.min(TOKEN_REFRESH_LEAD_MS, lifetime / 2);
    const delay = Math.min(Math.max(lifetime - lead, TOKEN_REFRESH_MIN_DELAY_MS), MAX_TIMER_DELAY_MS);
    const dueAt = Date.now() + delay;
    const refresh = () => {
      if (accessTokenRef.current === accessToken) reissueToken(true);
    };
    const timer = window.setTimeout(refresh, delay);
    const refreshIfDue = () => {
      if (document.visibilityState !== 'hidden' && Date.now() >= dueAt) refresh();
    };
    window.addEventListener('focus', refreshIfDue);
    document.addEventListener('visibilitychange', refreshIfDue);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refreshIfDue);
      document.removeEventListener('visibilitychange', refreshIfDue);
    };
  }, [accessToken]);

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