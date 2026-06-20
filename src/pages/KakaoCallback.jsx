import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

const BASE_URL = "http://infragen.kro.kr/api/v1";

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
      const res = await fetch(`${BASE_URL}/auth/login/kakao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ authorizationCode: code }),
      });

      const data = await res.json();
      const isSuccess = data.isSuccess ?? data.is_success;

      if (!res.ok || !isSuccess) throw new Error(`로그인 실패: ${data.message || res.status}`);

      localStorage.setItem("accessToken", data.result.accessToken);
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