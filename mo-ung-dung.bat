@echo off
chcp 65001 >nul
echo ================================================
echo  Đang khởi động Ứng dụng Trợ lý lên lớp...
echo ================================================

start "" powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0server.ps1"
timeout /t 2 >nul
start "" "http://127.0.0.1:8765/dashboard.html"

echo.
echo ================================================
echo  Ứng dụng đang chạy tại:
echo   - 🏠 Dashboard:              http://127.0.0.1:8765/dashboard.html
echo   - ✏️  Soạn bài giảng:         http://127.0.0.1:8765/admin.html
echo   - 📅 Thời khóa biểu:         http://127.0.0.1:8765/tkb.html
echo   - 📋 Kế hoạch dạy (PPCT):    http://127.0.0.1:8765/ppct.html
echo   - 👥 Lớp & Học sinh:         http://127.0.0.1:8765/lop-hoc.html
echo   - 🚀 Vào lớp giảng dạy:      http://127.0.0.1:8765/classroom.html
echo ================================================
