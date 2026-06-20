import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const USE_MOCK = false; // 백엔드 연결됨 (HTTP, 인증서 없음)

const mockLogin = () => ({
  accessToken: "mock-access-token-12345",
});

export default function KakaoCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | error
  const [errorDetail, setErrorDetail] = useState("");
  // StrictMode(개발 모드)에서 useEffect가 두 번 실행되는 것을 방지.
  // 카카오 인가 코드는 1회용이라, 두 번 보내면 두 번째 요청이 무조건 실패함.
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error) {
      fail(`카카오 인증 거부/오류: ${error}`);
      return;
    }

    if (code) {
      exchangeCode(code);
    } else {
      fail("URL에 인가 코드(code)가 없습니다.");
    }
  }, []);

  // [디버깅용] 실패 시 팝업을 바로 안 닫고 화면에 원인을 띄움
  const fail = (detail) => {
    console.error("카카오 로그인 처리 오류:", detail);
    setErrorDetail(detail);
    setStatus("error");
  };

  const reportSuccess = (accessToken) => {
    if (window.opener) {
      window.opener.postMessage({ type: "KAKAO_LOGIN_SUCCESS", accessToken }, window.location.origin);
      window.close();
    } else {
      localStorage.setItem("accessToken", accessToken);
      sessionStorage.setItem("justLoggedIn", "true");
      navigate("/dashboard");
    }
  };

  const closeAndReportError = () => {
    if (window.opener) {
      window.opener.postMessage({ type: "KAKAO_LOGIN_ERROR" }, window.location.origin);
      window.close();
    } else {
      navigate("/login");
    }
  };

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

        let bodyText = "";
        try {
          bodyText = await res.text();
        } catch {
          bodyText = "(응답 본문을 읽을 수 없음)";
        }

        if (!res.ok) {
          fail(`HTTP ${res.status} ${res.statusText}\n\n응답 본문:\n${bodyText}`);
          return;
        }

        let json;
        try {
          json = JSON.parse(bodyText);
        } catch {
          fail(`응답이 JSON 형식이 아닙니다.\n\n응답 본문:\n${bodyText}`);
          return;
        }

        const accessToken = json?.result?.accessToken;
        if (!accessToken) {
          fail(`응답에 result.accessToken이 없습니다.\n\n응답 본문:\n${bodyText}`);
          return;
        }

        data = { accessToken };
      }

      reportSuccess(data.accessToken);
    } catch (err) {
      fail(`네트워크/요청 오류: ${err?.message || String(err)}`);
    }
  };

  if (status === "error") {
    return (
      <Page>
        <ErrorBox>
          <ErrorTitle>카카오 로그인 처리 중 오류 발생</ErrorTitle>
          <ErrorDetail>{errorDetail}</ErrorDetail>
          <CloseBtn type="button" onClick={closeAndReportError}>확인 (닫기)</CloseBtn>
        </ErrorBox>
      </Page>
    );
  }

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
  padding: 24px;
  box-sizing: border-box;
`;

const Message = styled.p`
  font-size: 15px;
  color: #aaaaaa;
`;

const ErrorBox = styled.div`
  width: 100%;
  max-width: 480px;
  text-align: left;
`;

const ErrorTitle = styled.h3`
  color: #e05858;
  font-size: 16px;
  margin: 0 0 12px;
`;

const ErrorDetail = styled.pre`
  white-space: pre-wrap;
  word-break: break-all;
  background: #f7f7f7;
  border: 1px solid #eee;
  padding: 14px;
  border-radius: 8px;
  font-size: 12px;
  color: #333;
  max-height: 50vh;
  overflow-y: auto;
`;

const CloseBtn = styled.button`
  margin-top: 18px;
  padding: 10px 22px;
  border: none;
  border-radius: 8px;
  background: #1a1a1a;
  color: #fff;
  font-size: 14px;
  cursor: pointer;

  &:hover { opacity: 0.85; }
`;