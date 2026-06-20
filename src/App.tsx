import React from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import KakaoCallback from "./pages/KakaoCallback";
import SignupPage from "./pages/SignupPage";
import MainPage from "./MainPage";

// 루트(/)로 들어왔을 때, 카카오 인증 콜백(팝업에서 돌아온 것)인지
// 그냥 평소 사이트 접속인지 구분해서 다른 화면을 보여줌.
// (백엔드 redirect_uri가 경로 없이 루트만 가리키고 있어서, 콜백 처리를
//  전용 경로 대신 루트에서 같이 처리하도록 함)
const RootRoute: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const isKakaoCallback = params.has('code') || params.has('error');
  return isKakaoCallback ? <KakaoCallback /> : <MainPage />;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/oauth/kakao/callback" element={<KakaoCallback />} />
        <Route path="/dashboard" element={<MainPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;