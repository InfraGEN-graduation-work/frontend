import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import logo from "../assets/mainlogo.png";

const KAKAO_REST_API_KEY = "cd41f03a061efffe67d9a79f67bc5b8b";
const REDIRECT_URI = "http://localhost:3000/oauth/kakao/callback";
<<<<<<< HEAD

// 💡 http 주소 + 서버 연동 로직 유지
const BASE_URL = "http://infragen.kro.kr/api/v1";
=======
const BASE_URL = "https://infragen.kro.kr/api/v1";
const USE_MOCK = true; // 백엔드 완성되면 false로 변경
>>>>>>> e9d1a50109e7c50d519d53a0e37f636e3da4d0cf

const KAKAO_AUTH_URL =
  `https://kauth.kakao.com/oauth/authorize` +
  `?client_id=${KAKAO_REST_API_KEY}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code`;

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleKakaoLogin = () => {
    window.location.href = KAKAO_AUTH_URL;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setError("");

    try {
<<<<<<< HEAD
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      const isSuccess = data.isSuccess ?? data.is_success;

      if (res.ok && isSuccess) {
        localStorage.setItem("accessToken", data.result.accessToken);
        navigate("/dashboard");
      } else {
        const errorMessage = typeof data.result === 'string' ? data.result : data.message;
        setError(errorMessage || "이메일 또는 비밀번호가 올바르지 않습니다.");
      }
    } catch (error) {
      setError("서버와 통신할 수 없습니다.");
=======
      if (USE_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        localStorage.setItem("accessToken", "mock-access-token-12345");
        navigate("/dashboard");
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
      navigate("/dashboard");
    } catch {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
>>>>>>> e9d1a50109e7c50d519d53a0e37f636e3da4d0cf
    }
  };

  return (
    <Page>
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
    </Page>
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
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Page = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  font-family: "Pretendard", "Apple SD Gothic Neo", -apple-system, sans-serif;
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