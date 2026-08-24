@echo off
chcp 65001 >nul
cd /d "%~dp0backend\node"
echo ============================================
echo   个人物品库存清单 —— 共享后端启动器
echo ============================================
echo.
echo  后端同时托管前端页面，启动后：
echo.
echo    本机访问：  http://localhost:8080
echo    手机/同WiFi： 把 localhost 换成你电脑的局域网 IP
echo                （如 http://192.168.1.20:8080）
echo.
echo  默认账号：  admin / admin123   （首次启动自动创建）
echo  数据文件：  backend\node\data\inventory.json
echo.
echo  【让所有人都能访问】见 README.md 的"公网访问"一节。
echo.
echo  按 Ctrl+C 停止服务。
echo ============================================
echo.
node server.mjs
pause
