@echo off
cd /d "%~dp0"
echo ============================================
echo   个人物品库存清单 - 本地服务器
echo ============================================
echo.
echo  启动后，在浏览器打开： http://localhost:8000
echo  （手机/同WiFi电脑用本机局域网IP访问，如 http://192.168.1.x:8000）
echo.
echo  关闭这个窗口 = 停止服务
echo.
pause
where node >nul 2>nul
if %errorlevel%==0 (
  node server.mjs
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    python -m http.server 8000
  ) else (
    echo [错误] 未检测到 Node.js 或 Python，请先安装其中之一。
    pause
  )
)
