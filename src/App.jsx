import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import KakaoCallback from "./pages/KakaoCallback";
import SignupPage from "./pages/SignupPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/oauth/kakao/callback" element={<KakaoCallback />} />
        <Route path="/dashboard" element={<div>메인화면</div>} />
      </Routes>
    </BrowserRouter>
  );
}