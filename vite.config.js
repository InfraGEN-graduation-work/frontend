import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // 기존 CRA처럼 3000번 포트를 쓰고 싶을 때 설정
  }
})