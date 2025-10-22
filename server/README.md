# 🚀 应急AI识别后端服务

## 快速启动

### 方法1：使用启动脚本（推荐）
双击 `start.bat` 文件，自动安装依赖并启动服务

### 方法2：手动启动
```bash
# 进入服务器目录
cd server

# 安装依赖
npm install

# 启动服务
npm start
```

## 📡 API接口

- **健康检查**: `GET /api/health`
- **图片识别**: `POST /api/recognize`

## 🌐 访问地址

- **前端页面**: http://localhost:3000/image-recognition-sdk.html
- **API接口**: http://localhost:3000/api/recognize
- **健康检查**: http://localhost:3000/api/health

## ✅ 功能特性

- 🔐 自动管理百度AI access token
- 🖼️ 支持图片上传和识别
- 🚀 智能错误处理和降级
- 📱 支持跨域请求
- 💾 文件大小限制5MB

## 🛠️ 技术栈

- Node.js + Express
- Multer (文件上传)
- Axios (HTTP请求)
- CORS (跨域支持)

## 🔧 配置说明

修改 `config.js` 文件中的百度AI API配置：
- `appId`: 百度AI应用ID
- `apiKey`: API密钥
- `secretKey`: 密钥
- `port`: 服务器端口（默认3000）

## 🚨 注意事项

1. 确保已安装 Node.js (版本 14+)
2. 确保百度AI API密钥有效
3. 端口3000未被占用
4. 防火墙允许本地端口访问

## 📝 日志说明

服务器启动后会显示详细的连接信息，包括：
- 服务状态
- 访问地址
- API接口地址
- 健康检查地址 