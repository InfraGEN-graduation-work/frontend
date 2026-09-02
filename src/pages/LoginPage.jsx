import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import logo from "../assets/mainlogo.png";
import logo2 from "../assets/mainlogo-2.png";
import { useAuth } from "../contexts/AuthContext";

const KAKAO_REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY;
const REDIRECT_URI = import.meta.env.VITE_KAKAO_REDIRECT_URI;

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

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

  const [showLogin, setShowLogin] = useState(false);

  // 리다이렉트 URI가 루트("/")라서, 카카오 인가 코드가 이 페이지로 그대로 들어옵니다.
  // code가 있으면 로그인 폼 대신 처리 중 화면을 보여줍니다.
  const params = new URLSearchParams(window.location.search);
  const kakaoCode = params.get("code");
  const kakaoError = params.get("error");
  const [isKakaoProcessing, setIsKakaoProcessing] = useState(!!kakaoCode);
  const hasExchanged = useRef(false);

  useEffect(() => {
    if (kakaoError) {
      console.error("카카오 로그인 거부 또는 오류:", kakaoError);
      window.history.replaceState({}, "", "/");
      return;
    }

    if (kakaoCode && !hasExchanged.current) {
      hasExchanged.current = true;
      exchangeKakaoCode(kakaoCode);
    }
  }, []);

  const exchangeKakaoCode = async (code) => {
    try {
      const res = await fetch(`${BASE_URL}/auth/login/kakao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ authorizationCode: code }),
      });

      const data = await res.json();
      const isSuccess = data.isSuccess ?? data.is_success;

      if (!res.ok || !isSuccess) throw new Error(`로그인 실패: ${data.message || res.status}`);

      setAccessToken(data.result.accessToken);
      navigate("/dashboard");
    } catch (err) {
      console.error("카카오 로그인 처리 오류:", err);
      window.history.replaceState({}, "", "/");
      setIsKakaoProcessing(false);
      setError("카카오 로그인에 실패했습니다.");
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

  if (isKakaoProcessing) {
    return (
      <KakaoProcessingPage>
        <KakaoProcessingMessage>로그인 처리 중...</KakaoProcessingMessage>
      </KakaoProcessingPage>
    );
  }

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

      const data = await res.json();
      const isSuccess = data.isSuccess ?? data.is_success;

      if (res.ok && isSuccess) {
        setAccessToken(data.result.accessToken);
        navigate("/dashboard");
      } else {
        const errorMessage = typeof data.result === 'string' ? data.result : data.message;
        setError(errorMessage || "이메일 또는 비밀번호가 올바르지 않습니다.");
      }
    } catch (error) {
      setError("서버와 통신할 수 없습니다.");
    }
  };

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
            <LogoWrap>

              <img src={logo} alt="InfraGen" width="64" height="64" style={{ borderRadius: 16 }} />
            </LogoWrap>

            <BrandName>InfraGen</BrandName>

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

            <TextRow>
              <FindAccountButton type="button" onClick={() => {}}>계정 찾기</FindAccountButton>
              <Dot />
              <SignupLink type="button" onClick={() => navigate("/signup")}>회원가입</SignupLink>
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
        </LoginSection>

      </Wrapper>
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

const ErrorMsg = styled.p`
  font-size: 12px;
  color: #e05858;
  margin: 0;
  padding-left: 2px;
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
  margin-bottom: 24px;
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