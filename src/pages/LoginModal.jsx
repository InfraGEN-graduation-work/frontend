import { useState } from "react";
import styled, { keyframes } from "styled-components";
import logo from "../assets/mainlogo.png";

const KAKAO_REST_API_KEY = "cd41f03a061efffe67d9a79f67bc5b8b";
const REDIRECT_URI = "http://localhost:5173/";
const BASE_URL = "http://infragen.kro.kr/api/v1";
const USE_MOCK = false; // 백엔드 연결됨 (HTTP, 인증서 없음)

const KAKAO_AUTH_URL =
  `https://kauth.kakao.com/oauth/authorize` +
  `?client_id=${KAKAO_REST_API_KEY}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code`;

/**
 * 로그인 팝업 모달
 * - onClose: 닫기 (배경 클릭 / X 버튼)
 * - onLoginSuccess: 로그인 성공 시 (토큰 저장은 내부에서 처리, 부모는 상태만 갱신)
 * - onSwitchToSignup: 회원가입 모달로 전환
 */
export default function LoginModal({ onClose, onLoginSuccess, onSwitchToSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleKakaoLogin = () => {
    // 카카오 인증은 외부 도메인(kakao.com)으로 가야 해서 같은 창에서는 불가능 →
    // 작은 팝업 창에서 처리하고, 끝나면 postMessage로 결과만 받아서 모달을 유지함
    const width = 480;
    const height = 720;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      KAKAO_AUTH_URL,
      "kakaoLogin",
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      setError("팝업이 차단되었습니다. 브라우저의 팝업 차단을 해제해주세요.");
      return;
    }

    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "KAKAO_LOGIN_SUCCESS") {
        localStorage.setItem("accessToken", event.data.accessToken);
        cleanup();
        onLoginSuccess();
      } else if (event.data?.type === "KAKAO_LOGIN_ERROR") {
        cleanup();
        setError("카카오 로그인에 실패했습니다. 다시 시도해주세요.");
      }
    };

    // 사용자가 팝업을 그냥 닫아버린 경우 리스너 정리
    const watchClosed = setInterval(() => {
      if (popup.closed) cleanup();
    }, 500);

    const cleanup = () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(watchClosed);
    };

    window.addEventListener("message", handleMessage);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setError("");

    try {
      if (USE_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        localStorage.setItem("accessToken", "mock-access-token-12345");
        onLoginSuccess();
        return;
      }

      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) throw new Error();

      const data = await res.json();
      localStorage.setItem("accessToken", data.result.accessToken);
      onLoginSuccess();
    } catch {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
    }
  };

  return (
    <Overlay onClick={onClose}>
      <Card onClick={(e) => e.stopPropagation()}>
        <CloseBtn type="button" onClick={onClose} aria-label="닫기">✕</CloseBtn>

        <LogoWrap>
          <img src={logo} alt="InfraGen" width="56" height="56" style={{ borderRadius: 14 }} />
        </LogoWrap>

        <BrandName>InfraGen</BrandName>

        <LoginForm onSubmit={handleLogin}>
          <InputField
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
          />
          <InputField
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <ErrorMsg>{error}</ErrorMsg>}
          <LoginButton type="submit">로그인</LoginButton>
        </LoginForm>

        <TextRow>
          <FindAccountButton type="button" onClick={() => {}}>계정 찾기</FindAccountButton>
          <Dot />
          <SignupLink type="button" onClick={onSwitchToSignup}>회원가입</SignupLink>
        </TextRow>

        <Divider>
          <Line />
          <DividerText>또는</DividerText>
          <Line />
        </Divider>

        <KakaoButton type="button" onClick={handleKakaoLogin}>
          <KakaoIcon />
          카카오계정으로 로그인
        </KakaoButton>
      </Card>
    </Overlay>
  );
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M12 3C7.029 3 3 6.358 3 10.5c0 2.67 1.67 5.016 4.2 6.426L6.3 20.1a.3.3 0 0 0 .432.336l4.2-2.814c.354.036.714.054 1.068.054 4.971 0 9-3.358 9-7.5S16.971 3 12 3z"
        fill="#191919"
      />
    </svg>
  );
}

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const popIn = keyframes`
  from { opacity: 0; transform: translateY(14px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10050;
  animation: ${fadeIn} 0.18s ease both;
`;

const Card = styled.div`
  position: relative;
  width: 360px;
  max-width: calc(100vw - 32px);
  background: #ffffff;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 32px 36px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
  font-family: "Pretendard", "Apple SD Gothic Neo", -apple-system, sans-serif;
  animation: ${popIn} 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
`;

const CloseBtn = styled.button`
  position: absolute;
  top: 14px;
  right: 14px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 50%;
  font-size: 14px;
  color: #aaaaaa;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: #f2f2f2;
    color: #333;
  }
`;

const LogoWrap = styled.div`
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
`;

const BrandName = styled.h1`
  font-size: 21px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 24px;
  letter-spacing: -0.4px;
`;

const LoginForm = styled.form`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
`;

const InputField = styled.input`
  width: 100%;
  height: 48px;
  padding: 0 16px;
  border: 1.5px solid #e8e8e8;
  border-radius: 10px;
  font-size: 14px;
  color: #1a1a1a;
  background: #fafafa;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
  font-family: inherit;

  &::placeholder { color: #b0b0b0; }
  &:focus {
    border-color: #7b6cf6;
    background: #fff;
  }
`;

const ErrorMsg = styled.p`
  font-size: 12px;
  color: #e05858;
  margin: 0;
  padding-left: 2px;
`;

const LoginButton = styled.button`
  width: 100%;
  height: 48px;
  background: #1a1a1a;
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: -0.2px;
  transition: opacity 0.15s, transform 0.1s;
  font-family: inherit;
  margin-top: 2px;

  &:hover  { opacity: 0.82; }
  &:active { transform: scale(0.98); }
`;

const TextRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 22px;
`;

const Dot = styled.span`
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #d0d0d0;
  display: inline-block;
`;

const FindAccountButton = styled.button`
  background: none;
  border: none;
  font-size: 13px;
  color: #888;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  transition: color 0.15s;

  &:hover { color: #333; }
`;

const SignupLink = styled.button`
  background: none;
  border: none;
  font-size: 13px;
  color: #7b6cf6;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  transition: color 0.15s;

  &:hover { color: #5a4fd4; }
`;

const Divider = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`;

const Line = styled.div`
  flex: 1;
  height: 1px;
  background: #e8e8e8;
`;

const DividerText = styled.span`
  font-size: 13px;
  color: #aaaaaa;
`;

const KakaoButton = styled.button`
  width: 100%;
  height: 48px;
  background: #fee500;
  border: none;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  color: #191919;
  letter-spacing: -0.2px;
  transition: opacity 0.15s, transform 0.1s;
  font-family: inherit;

  &:hover  { opacity: 0.9; }
  &:active { transform: scale(0.98); }
`;