#!/bin/bash
# Script mở ứng dụng Trợ lý lên lớp
cd "/home/trong/Desktop/DỰ ÁN DẠY HỌC HÀNG NGÀY CHO "

# Tắt server cũ nếu có
pkill -f "http.server 8765" 2>/dev/null
sleep 1

# Khởi động server
python3 -m http.server 8765 &
SERVER_PID=$!
sleep 2

# Mở trình duyệt
xdg-open "http://127.0.0.1:8765/dashboard.html"

echo ""
echo "================================================"
echo " Ứng dụng Trợ lý lên lớp đang chạy!"
echo " Địa chỉ: http://127.0.0.1:8765/dashboard.html"
echo " Giữ cửa sổ này mở."
echo " Nhấn Ctrl+C để tắt."
echo "================================================"

wait $SERVER_PID
