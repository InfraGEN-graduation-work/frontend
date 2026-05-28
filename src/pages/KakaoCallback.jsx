import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

const BASE_URL = "https://infragen.kro.kr/api/v1";
const USE_MOCK = true; // 백엔드 서버 완성되면 false로 변경

const mockLogin = () => ({
  accessToken: "mock-access-token-12345",
});

export default function KakaoCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code  = params.get("code");
    const error = params.get("error");

    if (error) {
      console.error("카카오 로그인 거부 또는 오류:", error);
      navigate("/login");
      return;
    }

    if (code) {
      exchangeCode(code);
    }
  }, []);

  const exchangeCode = async (code) => {
    try {
      let data;

      if (USE_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        data = mockLogin();
      } else {
        const res = await fetch(`${BASE_URL}/auth/login/kakao`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authorizationCode: code }),
        });

        if (!res.ok) throw new Error(`로그인 실패: ${res.status}`);

        const json = await res.json();
        data = { accessToken: json.result.accessToken };
        
      }

      localStorage.setItem("accessToken", data.accessToken);
      navigate("/dashboard");
    } catch (err) {
      console.error("카카오 로그인 처리 오류:", err);
      navigate("/login");
    }
  };

  return (
    <Page>
      <Message>로그인 처리 중...</Message>
    </Page>
  );
}

const Page = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  font-family: "Pretendard", "Apple SD Gothic Neo", -apple-system, sans-serif;
`;

const Message = styled.p`
  font-size: 15px;
  color: #aaaaaa;
`;