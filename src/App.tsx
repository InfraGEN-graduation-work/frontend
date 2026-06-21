import React from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import KakaoCallback from "./pages/KakaoCallback";
import SignupPage from "./pages/SignupPage";
import Home from "./pages/Home";
import MainPage from "./MainPage";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/oauth/kakao/callback" element={<KakaoCallback />} />
        <Route path="/dashboard" element={<Home />} />
        <Route path="/project/:projectId" element={<MainPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;