import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

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
    console.log("받은 인가 코드:", code);
    navigate("/dashboard"); // 대시보드로 이동
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