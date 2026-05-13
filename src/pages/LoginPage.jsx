import styled, { keyframes } from "styled-components";
import logo from "../assets/infragen_icon.png";

const KAKAO_REST_API_KEY = "cd41f03a061efffe67d9a79f67bc5b8b";
const REDIRECT_URI = "http://localhost:3000/oauth/kakao/callback";

const KAKAO_AUTH_URL =
  `https://kauth.kakao.com/oauth/authorize` +
  `?client_id=${KAKAO_REST_API_KEY}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code`;

export default function LoginPage() {
  const handleKakaoLogin = () => {
    window.location.href = KAKAO_AUTH_URL;
  };

  return (
    <Page>
      <Card>
        <LogoWrap>
          <img src={logo} alt="InfraGen" width="64" height="64" style={{ borderRadius: 16 }} />
        </LogoWrap>

        <BrandName>InfraGen</BrandName>

        <KakaoButton onClick={handleKakaoLogin}>
          <KakaoIcon />
          카카오계정으로 로그인
        </KakaoButton>

        <Divider>
          <Line />
          <DividerText>또는</DividerText>
          <Line />
        </Divider>

        <FindAccountButton onClick={() => {}}>
          계정찾기 →
        </FindAccountButton>
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

// css
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
  margin: 0 0 36px;
  letter-spacing: -0.4px;
`;

const KakaoButton = styled.button`
  width: 100%;
  height: 54px;
  background: #fee500;
  border: none;
  border-radius: 12px;
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
  margin-bottom: 28px;

  &:hover  { opacity: 0.9; }
  &:active { transform: scale(0.98); }
`;

const Divider = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
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

const FindAccountButton = styled.button`
  background: none;
  border: none;
  font-size: 14px;
  color: #555;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: #f5f5f5;
    color: #111;
  }
`;