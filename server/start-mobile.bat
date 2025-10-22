@echo off
chcp 65001 >nul
title 应急AI识别服务器 - 手机访问版

echo.
echo ========================================
echo 🚀 应急AI识别服务器 - 手机访问版
echo ========================================
echo.

echo 📱 正在获取网络配置信息...
echo.

REM 获取IP地址
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP=%%i
    goto :found_ip
)

:found_ip
set IP=%IP: =%

echo 🌐 检测到的IP地址: %IP%
echo.

echo 📋 请确保：
echo    1. 手机和电脑连接同一个WiFi
echo    2. 防火墙允许端口3001
echo    3. 网络设置正确
echo.

echo 🎯 手机访问地址：
echo    主页: http://%IP%:3001
echo    图片识别: http://%IP%:3001/image-recognition.html
echo    3D模型: http://%IP%:3001/model-viewer.html
echo.

echo ⚠️  如果无法访问，请检查：
echo    - 防火墙设置
echo    - 网络连接
echo    - IP地址是否正确
echo.

echo 🚀 正在启动服务器...
echo.

npm start

pause 