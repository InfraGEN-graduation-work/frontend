import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import logo from "../assets/mainlogo.png";
import logo2 from "../assets/mainlogo-2.png";
import { useAuth } from "../contexts/AuthContext";

const KAKAO_REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY || "1d3c47d4d92cec1710ef19ae5625d985";
const REDIRECT_URI = import.meta.env.VITE_KAKAO_REDIRECT_URI || "https://infragen1.vercel.app/";
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://infragen.p-e.kr/api/v1";

const KAKAO_AUTH_URL =
  `https://kauth.kakao.com/oauth/authorize` +
  `?client_id=${KAKAO_REST_API_KEY}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code`;

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAccessToken } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState(null);

  const [showLogin, setShowLogin] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showFindAccount, setShowFindAccount] = useState(false);
  
  const [findEmail, setFindEmail] = useState("");
  const [findCode, setFindCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [findCountdown, setFindCountdown] = useState(0);
  const [findError, setFindError] = useState("");

  const params = new URLSearchParams(window.location.search);
  const kakaoCode = params.get("code");
  const kakaoError = params.get("error");
  const [isKakaoProcessing, setIsKakaoProcessing] = useState(!!kakaoCode);
  const hasExchanged = useRef(false);

  useEffect(() => {
    const handleGlobalToast = (e) => {
      setToastMessage(e.detail);
      setTimeout(() => setToastMessage(null), 3000);
    };
    window.addEventListener('global-toast', handleGlobalToast);
    return () => window.removeEventListener('global-toast', handleGlobalToast);
  }, []);

  useEffect(() => {
    let timer;
    if (findCountdown > 0) {
      timer = setInterval(() => {
        setFindCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [findCountdown]);

  useEffect(() => {
    if (kakaoError) {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '카카오 로그인 연동에 실패했습니다.' }));
      window.history.replaceState({}, "", "/");
      setIsKakaoProcessing(false);
      return;
    }

    if (kakaoCode && !hasExchanged.current) {
      hasExchanged.current = true;
      exchangeKakaoCode(kakaoCode);
    }
  }, [kakaoCode, kakaoError]);

  const exchangeKakaoCode = async (code) => {
    try {
      const res = await fetch(`${BASE_URL}/auth/login/kakao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ authorizationCode: code }),
      });

      const data = await res.json().catch(() => ({}));
      const isSuccess = data.isSuccess ?? data.is_success ?? res.ok;

      if (!res.ok || !isSuccess) throw new Error('SERVER_ERROR');

      setAccessToken(data.result.accessToken);
      navigate("/dashboard");
    } catch (err) {
      window.history.replaceState({}, "", "/");
      setIsKakaoProcessing(false);
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '예기치 않은 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }));
    }
  };

  const wheelTimeout = useRef(null);
  const touchStartY = useRef(0);

  const handleWheel = (e) => {
    if (wheelTimeout.current) return;

    if (e.deltaY > 30 && !showLogin) {
      setShowLogin(true);
      lockScroll();
    } 
    else if (e.deltaY < -30 && showLogin) {
      setShowLogin(false);
      lockScroll();
    }
  };

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    if (wheelTimeout.current) return;
    
    const touchEndY = e.touches[0].clientY;
    const diff = touchStartY.current - touchEndY;

    if (diff > 30 && !showLogin) {
      setShowLogin(true);
      lockScroll();
    } else if (diff < -30 && showLogin) {
      setShowLogin(false);
      lockScroll();
    }
  };

  const lockScroll = () => {
    wheelTimeout.current = setTimeout(() => {
      wheelTimeout.current = null;
    }, 1000); 
  };

  const handleKakaoLogin = () => {
    window.location.href = KAKAO_AUTH_URL;
  };

  const handleGuestLogin = async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('SERVER_ERROR');
      }

      const data = await res.json();
      const isSuccess = data.isSuccess ?? data.is_success;

      if (res.ok && isSuccess) {
        setAccessToken(data.result.accessToken);
        navigate("/dashboard");
      } else {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: data.message || "유효하지 않은 토큰입니다." }));
      }
    } catch (error) {
      console.error("Guest Login Failed:", error);
      window.dispatchEvent(new CustomEvent('global-toast', { detail: "예기치 않은 서버 오류가 발생했습니다." }));
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setError("");

    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", 
        body: JSON.stringify({ email, password }),
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('SERVER_ERROR');
      }

      const data = await res.json();
      const isSuccess = data.isSuccess ?? data.is_success;

      if (res.ok && isSuccess) {
        setAccessToken(data.result.accessToken);
        navigate("/dashboard");
      } else {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      }
    } catch (error) {
      console.error("Login Request Failed:", error);
      setError("예기치 않은 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const handleSendFindCode = async () => {
    if (!findEmail) {
      setFindError("이메일을 입력해주세요.");
      return;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(findEmail)) {
      setFindError("올바른 이메일 형식을 입력해주세요.");
      return;
    }
    setFindError("");

    try {
      const res = await fetch(`${BASE_URL}/auth/email/code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: findEmail }),
      });

      const data = await res.json().catch(() => ({}));
      const isSuccess = data.isSuccess ?? data.is_success ?? res.ok;

      if (res.ok && isSuccess) {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '인증번호가 발송되었습니다. 이메일을 확인해주세요.' }));
        setFindCountdown(60); 
      } else {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: data.message || '인증번호 발송에 실패했습니다.' }));
      }
    } catch (error) {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '서버 연동 오류가 발생했습니다.' }));
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!findEmail || !findCode || !newPassword || !newPasswordConfirm) {
      setFindError("모든 필드를 입력해주세요.");
      return;
    }
    if (newPassword.length < 8) {
      setFindError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setFindError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setFindError("");

    try {
      const res = await fetch(`${BASE_URL}/auth/password/reset`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: findEmail,
          verificationCode: findCode,
          newPassword: newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      const isSuccess = data.isSuccess ?? data.is_success ?? res.ok;

      if (res.ok && isSuccess) {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '비밀번호가 성공적으로 재설정되었습니다. 새 비밀번호로 로그인해주세요.' }));
        setFindEmail(""); setFindCode(""); setNewPassword(""); setNewPasswordConfirm("");
        setShowFindAccount(false);
        setShowEmailForm(true);
      } else {
        if (res.status === 404) {
           setFindError("현재 백엔드 서버에 비밀번호 재설정 API가 존재하지 않습니다.");
        } else {
           setFindError(data.message || "인증번호가 올바르지 않거나 재설정에 실패했습니다.");
        }
      }
    } catch (error) {
      setFindError("서버와 통신할 수 없습니다. 다시 시도해주세요.");
    }
  };

  if (isKakaoProcessing) {
    return (
      <KakaoProcessingPage>
        <KakaoProcessingMessage>카카오 로그인 처리 중...</KakaoProcessingMessage>
      </KakaoProcessingPage>
    );
  }

  return (
    <Container onWheel={handleWheel} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
      <Wrapper $showLogin={showLogin}>
        
        <LandingSection>
          <FloatingContent>
            <LandingLogo src={logo2} alt="InfraGen Logo" />
            <LandingTitle>InfraGen</LandingTitle>
            <LandingSubtitle>GUI 기반 인프라 아키텍처 설계 및 IaC 자동 생성 시각화 시스템</LandingSubtitle>
          </FloatingContent>
          
          <ScrollIndicator onClick={() => setShowLogin(true)}>
            <ChevronSvg viewBox="0 0 24 24">
              <polyline points="4 6 12 14 20 6" />
              <polyline points="4 12 12 20 20 12" />
            </ChevronSvg>
          </ScrollIndicator>
        </LandingSection>

        <LoginSection>
          <Card>
            {showFindAccount ? (
              <>
                <BackButton type="button" onClick={() => { setFindError(""); setShowFindAccount(false); }}>
                  ← 돌아가기
                </BackButton>

                <LogoWrap>
                  <img src={logo} alt="InfraGen" width="64" height="64" style={{ borderRadius: 16 }} />
                </LogoWrap>

                <BrandName style={{ fontSize: '20px', marginBottom: '8px' }}>비밀번호 재설정</BrandName>
                <p style={{ fontSize: '13px', color: '#888', marginBottom: '24px', textAlign: 'center' }}>
                  가입하신 이메일로 인증번호를 받아<br/>비밀번호를 재설정할 수 있습니다.
                </p>

                <LoginForm onSubmit={handleResetPassword}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <InputField
                      type="email"
                      placeholder="가입한 이메일"
                      value={findEmail}
                      onChange={(e) => { setFindEmail(e.target.value); setFindError(""); }}
                      style={{ flex: 1 }}
                    />
                    <SendCodeBtn 
                      type="button" 
                      onClick={handleSendFindCode} 
                      disabled={findCountdown > 0 || !findEmail}
                    >
                      {findCountdown > 0 ? `재발송 (${Math.floor(findCountdown / 60)}:${String(findCountdown % 60).padStart(2, '0')})` : '인증 발송'}
                    </SendCodeBtn>
                  </div>
                  
                  <InputField
                    type="text"
                    placeholder="인증번호 6자리"
                    maxLength={6}
                    value={findCode}
                    onChange={(e) => {
                      setFindCode(e.target.value.replace(/[^0-9]/g, ''));
                      setFindError("");
                    }}
                  />
                  
                  <InputField
                    type="password"
                    placeholder="새 비밀번호 (8자 이상)"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setFindError(""); }}
                  />
                  
                  <InputField
                    type="password"
                    placeholder="새 비밀번호 확인"
                    value={newPasswordConfirm}
                    onChange={(e) => { setNewPasswordConfirm(e.target.value); setFindError(""); }}
                  />
                  
                  {findError && <ErrorMsg>{findError}</ErrorMsg>}
                  
                  <LoginButton type="submit" style={{ marginTop: '10px' }}>비밀번호 변경하기</LoginButton>
                </LoginForm>
              </>
            ) : !showEmailForm ? (
              <>
                <LogoWrap>
                  <img src={logo} alt="InfraGen" width="64" height="64" style={{ borderRadius: 16 }} />
                </LogoWrap>

                <BrandName>InfraGen</BrandName>

                {error && <ErrorMsg style={{ marginBottom: '16px' }}>{error}</ErrorMsg>}

                <ButtonGroup>
                  <EmailButton type="button" onClick={() => { setError(""); setShowEmailForm(true); }}>
                    이메일로 로그인
                  </EmailButton>
                  <KakaoButton type="button" onClick={handleKakaoLogin}>
                    <KakaoIcon />
                    카카오계정으로 로그인
                  </KakaoButton>
                  <GuestButton type="button" onClick={handleGuestLogin}>
                    게스트로 시작하기
                  </GuestButton>
                </ButtonGroup>

                <TextRow>
                  <FindAccountButton type="button" onClick={() => { setError(""); setShowFindAccount(true); }}>계정 찾기</FindAccountButton>
                  <Dot />
                  <SignupLink type="button" onClick={() => navigate("/signup")}>회원가입</SignupLink>
                </TextRow>
              </>
            ) : (
              <>
                <BackButton type="button" onClick={() => { setError(""); setShowEmailForm(false); }}>
                  ← 뒤로 가기
                </BackButton>

                <LogoWrap>
                  <img src={logo} alt="InfraGen" width="64" height="64" style={{ borderRadius: 16 }} />
                </LogoWrap>

                <BrandName>이메일 로그인</BrandName>

                <LoginForm onSubmit={handleLogin}>
                  <InputField
                    type="email"
                    placeholder="이메일"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
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

                <TextRow style={{ marginTop: '16px', marginBottom: 0 }}>
                  <FindAccountButton type="button" onClick={() => { setError(""); setShowFindAccount(true); }}>계정 찾기</FindAccountButton>
                  <Dot />
                  <SignupLink type="button" onClick={() => navigate("/signup")}>회원가입</SignupLink>
                </TextRow>
              </>
            )}
          </Card>
        </LoginSection>

      </Wrapper>
      {toastMessage && <ToastNotification>{toastMessage}</ToastNotification>}
    </Container>
  );
}

const rainbowAnim = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const floatAnim = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-16px); }
  100% { transform: translateY(0px); }
`;

const chevronFloatAnim = keyframes`
  0% { transform: translateY(0px); opacity: 0.7; }
  50% { transform: translateY(10px); opacity: 1; }
  100% { transform: translateY(0px); opacity: 0.7; }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const toastAnim = keyframes`
  0% { opacity: 0; transform: translate(-50%, 20px); }
  15% { opacity: 1; transform: translate(-50%, 0); }
  85% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, 20px); }
`;

const Container = styled.div`
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  font-family: "Pretendard", "Apple SD Gothic Neo", -apple-system, sans-serif;
`;

const Wrapper = styled.div`
  width: 100%;
  height: 200vh;
  display: flex;
  flex-direction: column;
  transform: translateY(${({ $showLogin }) => ($showLogin ? "-100vh" : "0")});
  transition: transform 0.9s cubic-bezier(0.645, 0.045, 0.355, 1);
`;

const LandingSection = styled.div`
  width: 100%;
  height: 100vh;
  background: linear-gradient(
    135deg,
    #ffafbd,
    #ffc3a0,
    #ffd1ff,
    #a1c4fd,
    #c2e9fb
  );
  background-size: 300% 300%;
  animation: ${rainbowAnim} 15s ease infinite;
  
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
`;

const FloatingContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: ${floatAnim} 3.5s ease-in-out infinite;
`;

const LandingLogo = styled.img`
  width: 130px;
  height: 130px;
  filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.2));
  margin-bottom: 8px; 
`;

const LandingTitle = styled.h1`
  font-size: 48px;
  font-weight: 800;
  color: white;
  margin: 0;
  letter-spacing: 1.5px;
  text-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
  font-family: "Inter", "Pretendard", sans-serif;
`;

const LandingSubtitle = styled.p`
  font-size: 16px;
  color: rgba(255, 255, 255, 0.95);
  margin: 8px 0 0; 
  font-weight: 600;
  letter-spacing: -0.3px;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  text-align: center;
  word-break: keep-all;
`;

const ScrollIndicator = styled.div`
  position: absolute;
  bottom: 40px;
  cursor: pointer;
  padding: 20px;
  animation: ${chevronFloatAnim} 2.5s ease-in-out infinite;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const ChevronSvg = styled.svg`
  width: 44px;
  height: 44px;
  fill: none;
  stroke: rgba(255, 255, 255, 0.9);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));
  transition: 0.2s;
  
  &:hover {
    stroke: white;
    transform: scale(1.1);
  }
`;

const LoginSection = styled.div`
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
`;

const Card = styled.div`
  width: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56px 32px 48px;
  animation: ${fadeIn} 0.4s ease both;
  position: relative;
`;

const BackButton = styled.button`
  position: absolute;
  top: 32px;
  left: 32px;
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

const LogoWrap = styled.div`
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
`;

const BrandName = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 28px;
  letter-spacing: -0.4px;
`;

const ButtonGroup = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
`;

const EmailButton = styled.button`
  width: 100%;
  height: 50px;
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

  &:hover  { opacity: 0.82; }
  &:active { transform: scale(0.98); }
`;

const KakaoButton = styled.button`
  width: 100%;
  height: 50px;
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

const GuestButton = styled.button`
  width: 100%;
  height: 50px;
  background: #f1f3f5;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  color: #4a5568;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: -0.2px;
  transition: opacity 0.15s, transform 0.1s, background 0.2s;
  font-family: inherit;

  &:hover  { background: #e2e8f0; }
  &:active { transform: scale(0.98); }
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
  height: 50px;
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

const SendCodeBtn = styled.button`
  flex-shrink: 0;
  width: 90px;
  height: 50px;
  background: ${(props) => (props.disabled ? '#e2e8f0' : '#1a1a1a')};
  color: ${(props) => (props.disabled ? '#a0aec0' : '#fff')};
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
  transition: 0.2s;
  font-family: inherit;

  &:active { transform: ${(props) => (props.disabled ? 'none' : 'scale(0.98)')}; }
`;

const ErrorMsg = styled.p`
  font-size: 12px;
  color: #e05858;
  margin: 0;
  padding-left: 2px;
  text-align: center;
`;

const LoginButton = styled.button`
  width: 100%;
  height: 50px;
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

const KakaoProcessingPage = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  font-family: "Pretendard", "Apple SD Gothic Neo", -apple-system, sans-serif;
`;

const KakaoProcessingMessage = styled.p`
  font-size: 15px;
  color: #aaaaaa;
`;

const ToastNotification = styled.div`
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #4a5568;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 9999;
  animation: ${toastAnim} 3s ease forwards;
  white-space: pre-wrap;
  word-break: break-all;
  text-align: center;
  max-width: 80vw;
`;