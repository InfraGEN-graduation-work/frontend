// src/pages/SignupPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import logo from "../assets/mainlogo.png";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://infragen.p-e.kr/api/v1";

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", verificationCode: "", password: "", passwordConfirm: "", nickname: "" });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // 30초 카운트다운 타이머 상태
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const handleGlobalToast = (e) => {
      setToastMessage(e.detail);
      setTimeout(() => setToastMessage(null), 3000);
    };
    window.addEventListener('global-toast', handleGlobalToast);
    return () => window.removeEventListener('global-toast', handleGlobalToast);
  }, []);

  // 타이머 로직
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // 인증번호 입력 전용 핸들러 (숫자만, 최대 6자리)
  const handleCodeChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
    setForm((prev) => ({ ...prev, verificationCode: val }));
    setErrors((prev) => ({ ...prev, verificationCode: "" }));
  };

  // 인증번호 발송 API 호출
  const handleSendCode = async () => {
    if (!form.email) {
      setErrors((prev) => ({ ...prev, email: "이메일을 먼저 입력해주세요." }));
      return;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setErrors((prev) => ({ ...prev, email: "올바른 이메일 형식을 입력해주세요." }));
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/auth/email/code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });

      const data = await res.json().catch(() => ({}));
      const isSuccess = data.isSuccess ?? data.is_success ?? res.ok;

      if (res.ok && isSuccess) {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '인증번호가 발송되었습니다. 이메일을 확인해주세요.' }));
        setCountdown(30); // 30초 쿨타임 시작
      } else {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: data.message || '인증번호 발송에 실패했습니다.' }));
      }
    } catch (error) {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '서버 연동 오류가 발생했습니다.' }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!form.email) newErrors.email = "이메일을 입력해주세요.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = "올바른 이메일 형식을 입력해주세요.";

    if (!form.verificationCode) newErrors.verificationCode = "인증번호를 입력해주세요.";
    else if (form.verificationCode.length !== 6) newErrors.verificationCode = "6자리 인증번호를 정확히 입력해주세요.";

    if (!form.password) newErrors.password = "비밀번호를 입력해주세요.";
    else if (form.password.length < 8) newErrors.password = "비밀번호는 8자 이상이어야 합니다.";

    if (!form.passwordConfirm) newErrors.passwordConfirm = "비밀번호 확인을 입력해주세요.";
    else if (form.password !== form.passwordConfirm) newErrors.passwordConfirm = "비밀번호가 일치하지 않습니다.";

    if (!form.nickname) newErrors.nickname = "닉네임을 입력해주세요.";

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", 
        body: JSON.stringify({
          email: form.email,
          verificationCode: form.verificationCode, // 추가된 필드
          password: form.password,
          nickname: form.nickname,
        }),
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON Response:", text);
        throw new Error(`CORS 설정 문제이거나 서버 에러입니다. (Status: ${res.status})`);
      }

      const data = await res.json();
      const isSuccess = data.isSuccess ?? data.is_success;

      if (res.ok && isSuccess) {
        setSubmitted(true);
      } else {
        const errorMessage = typeof data.result === 'string' ? data.result : data.message;
        setErrors({ general: errorMessage || "회원가입에 실패하거나 인증번호가 올바르지 않습니다." });
      }
    } catch (error) {
      console.error("Signup Request Failed:", error);
      setErrors({ general: error.message || "서버와 통신할 수 없습니다. 다시 시도해주세요." });
    }
  };

  if (submitted) {
    return (
      <Page>
        <Card>
          <SuccessIcon>✓</SuccessIcon>
          <SuccessTitle>가입 완료!</SuccessTitle>
          <SuccessDesc>InfraGen에 오신 것을 환영합니다.<br />로그인 후 시작하세요.</SuccessDesc>
          <SubmitButton type="button" onClick={() => navigate("/login")}>
            로그인하러 가기
          </SubmitButton>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <Card>
        <BackButton type="button" onClick={() => navigate("/login")}>
          ← 로그인으로
        </BackButton>

        <LogoWrap>
          <img src={logo} alt="InfraGen" width="52" height="52" style={{ borderRadius: 13 }} />
        </LogoWrap>

        <Title>회원가입</Title>
        <Subtitle>InfraGen 계정을 만들어보세요</Subtitle>

        <SignupForm onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            <Label>이메일</Label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <InputField
                type="email"
                name="email"
                placeholder="example@email.com"
                value={form.email}
                onChange={handleChange}
                hasError={!!errors.email}
                autoComplete="email"
                style={{ flex: 1 }}
              />
              <SendCodeBtn 
                type="button" 
                onClick={handleSendCode} 
                disabled={countdown > 0 || !form.email}
              >
                {countdown > 0 ? `재발송 (${countdown}s)` : '인증 발송'}
              </SendCodeBtn>
            </div>
            {errors.email && <FieldError>{errors.email}</FieldError>}
          </FieldGroup>

          <FieldGroup>
            <Label>인증번호</Label>
            <InputField
              type="text"
              name="verificationCode"
              placeholder="이메일로 발송된 6자리 숫자 입력"
              value={form.verificationCode}
              onChange={handleCodeChange}
              hasError={!!errors.verificationCode}
              maxLength={6}
            />
            {errors.verificationCode && <FieldError>{errors.verificationCode}</FieldError>}
          </FieldGroup>

          <FieldGroup>
            <Label>비밀번호</Label>
            <InputField
              type="password"
              name="password"
              placeholder="8자 이상의 비밀번호"
              value={form.password}
              onChange={handleChange}
              hasError={!!errors.password}
              autoComplete="new-password"
            />
            {errors.password && <FieldError>{errors.password}</FieldError>}
          </FieldGroup>

          <FieldGroup>
            <Label>비밀번호 확인</Label>
            <InputField
              type="password"
              name="passwordConfirm"
              placeholder="비밀번호를 다시 입력"
              value={form.passwordConfirm}
              onChange={handleChange}
              hasError={!!errors.passwordConfirm}
              autoComplete="new-password"
            />
            {errors.passwordConfirm && <FieldError>{errors.passwordConfirm}</FieldError>}
          </FieldGroup>

          <FieldGroup>
            <Label>닉네임</Label>
            <InputField
              type="text"
              name="nickname"
              placeholder="서비스에서 사용할 닉네임"
              value={form.nickname}
              onChange={handleChange}
              hasError={!!errors.nickname}
              autoComplete="nickname"
            />
            {errors.nickname && <FieldError>{errors.nickname}</FieldError>}
          </FieldGroup>

          {errors.general && <FieldError>{errors.general}</FieldError>}

          <SubmitButton type="submit" style={{ marginTop: '12px' }}>가입하기</SubmitButton>
        </SignupForm>

        <LoginPrompt>
          이미 계정이 있으신가요?{" "}
          <LoginLink type="button" onClick={() => navigate("/login")}>로그인</LoginLink>
        </LoginPrompt>
      </Card>
      
      {toastMessage && <ToastNotification>{toastMessage}</ToastNotification>}
    </Page>
  );
}

// ========== Styled Components ========== //

const toastAnim = keyframes`
  0% { opacity: 0; transform: translate(-50%, 20px); }
  15% { opacity: 1; transform: translate(-50%, 0); }
  85% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, 20px); }
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

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const popIn = keyframes`
  0%   { transform: scale(0.6); opacity: 0; }
  70%  { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
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
  width: 380px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 36px 44px;
  animation: ${fadeIn} 0.4s ease both;
  position: relative;
`;

const BackButton = styled.button`
  position: absolute;
  top: 40px;
  left: 36px;
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
  width: 68px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
`;

const Title = styled.h1`
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 6px;
  letter-spacing: -0.4px;
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: #999;
  margin: 0 0 28px;
`;

const SignupForm = styled.form`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 20px;
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const Label = styled.label`
  font-size: 13px;
  font-weight: 600;
  color: #555;
`;

const InputField = styled.input`
  width: 100%;
  height: 48px;
  padding: 0 14px;
  border: 1.5px solid ${({ hasError }) => (hasError ? "#e05858" : "#e8e8e8")};
  border-radius: 10px;
  font-size: 14px;
  color: #1a1a1a;
  background: ${({ hasError }) => (hasError ? "#fff8f8" : "#fafafa")};
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
  font-family: inherit;

  &::placeholder { color: #b8b8b8; }
  &:focus {
    border-color: ${({ hasError }) => (hasError ? "#e05858" : "#7b6cf6")};
    background: #fff;
  }
`;

const SendCodeBtn = styled.button`
  flex-shrink: 0;
  width: 90px;
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

const FieldError = styled.p`
  font-size: 12px;
  color: #e05858;
  margin: 0;
  padding-left: 2px;
`;

const SubmitButton = styled.button`
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

const LoginPrompt = styled.p`
  font-size: 13px;
  color: #999;
  margin: 0;
`;

const LoginLink = styled.button`
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

const SuccessIcon = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7b6cf6, #a78bfa);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  color: #fff;
  margin-bottom: 20px;
  animation: ${popIn} 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
`;

const SuccessTitle = styled.h2`
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 10px;
  letter-spacing: -0.4px;
`;

const SuccessDesc = styled.p`
  font-size: 14px;
  color: #888;
  text-align: center;
  line-height: 1.6;
  margin: 0 0 32px;
`;