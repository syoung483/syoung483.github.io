@echo off
echo 正在启动应急安全教育平台...
echo.
echo 服务器启动后，请在浏览器中访问：
echo http://127.0.0.1:3000
echo.
echo 按 Ctrl+C 可以停止服务器
echo.
npx http-server -p 3000 -c-1 .
pause
