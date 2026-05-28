import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import logo from "../assets/infragen_icon.png";

const BASE_URL = "https://infragen.kro.kr/api/v1";
const USE_MOCK = true; // 백엔드 완성되면 false로 변경

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", passwordConfirm: "", nickname: "" });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const newErrors = {};

    if (!form.email) newErrors.email = "이메일을 입력해주세요.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = "올바른 이메일 형식을 입력해주세요.";

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
      if (USE_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        setSubmitted(true);
        return;
      }

      const res = await fetch(`${BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          nickname: form.nickname,
        }),
      });

      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setErrors({ general: "회원가입에 실패했습니다. 다시 시도해주세요." });
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
            <InputField
              type="email"
              name="email"
              placeholder="example@email.com"
              value={form.email}
              onChange={handleChange}
              hasError={!!errors.email}
              autoComplete="email"
            />
            {errors.email && <FieldError>{errors.email}</FieldError>}
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

          <SubmitButton type="submit">가입하기</SubmitButton>
        </SignupForm>

        <LoginPrompt>
          이미 계정이 있으신가요?{" "}
          <LoginLink type="button" onClick={() => navigate("/login")}>로그인</LoginLink>
        </LoginPrompt>
      </Card>
    </Page>
  );
}

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
  font-weight: 500;
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
  margin-top: 6px;

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