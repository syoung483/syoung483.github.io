const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const crypto = require('crypto');
const { BAIDU_CONFIG, SERVER_CONFIG, SPARK_X1 } = require('./config');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('../')); // 服务前端文件

// 文件上传配置
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB限制
});

// 全局变量
let accessToken = null;
let tokenExpireTime = 0;

// 获取百度AI access token
async function getAccessToken() {
    const now = Date.now();
    
    // 如果token还有效，直接返回
    if (accessToken && now < tokenExpireTime) {
        return accessToken;
    }
    
    try {
        console.log('正在获取百度AI access token...');
        console.log('使用的API Key:', BAIDU_CONFIG.apiKey);
        console.log('使用的Secret Key:', BAIDU_CONFIG.secretKey ? '***' + BAIDU_CONFIG.secretKey.slice(-4) : '未设置');
        
        const response = await axios.post(
            'https://aip.baidubce.com/oauth/2.0/token',
            null,
            {
                params: {
                    grant_type: 'client_credentials',
                    client_id: BAIDU_CONFIG.apiKey,
                    client_secret: BAIDU_CONFIG.secretKey
                },
                timeout: 10000 // 10秒超时
            }
        );
        
        console.log('Token响应:', JSON.stringify(response.data, null, 2));
        
        accessToken = response.data.access_token;
        tokenExpireTime = now + (response.data.expires_in - 60) * 1000; // 提前60秒过期
        
        console.log('✅ Access Token获取成功');
        return accessToken;
        
    } catch (error) {
        console.error('❌ 获取Access Token失败:', error.message);
        if (error.response) {
            console.error('错误响应:', error.response.data);
        }
        throw new Error('获取API访问令牌失败');
    }
}

// 图片识别API接口
app.post('/api/recognize', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请上传图片文件' });
        }
        
        // 获取access token
        const token = await getAccessToken();
        
        // 将图片转换为base64
        const base64Image = req.file.buffer.toString('base64');
        
        console.log('正在调用百度AI API进行图片识别...');
        console.log('图片大小:', base64Image.length, '字符');
        
        // 使用标准的百度AI通用物体识别API v2版本（方式一）
        const apiUrl = `https://aip.baidubce.com/rest/2.0/image-classify/v2/advanced_general?access_token=${token}`;
        console.log('完整API URL:', apiUrl);
        
        // 构建请求体 - 使用标准的form-urlencoded格式，包含百科信息
        const requestBody = `image=${encodeURIComponent(base64Image)}&baike_num=3`;
        console.log('请求体长度:', requestBody.length);
        
        // 使用POST方法调用百度AI API（方式一）
        console.log('使用POST方法调用标准API...');
        console.log('请求头:', { 'Content-Type': 'application/x-www-form-urlencoded' });
        
        const response = await axios.post(
            apiUrl,
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 30000 // 30秒超时
            }
        );
        console.log('API调用成功');
        
        const data = response.data;
        console.log('百度AI API响应:', JSON.stringify(data, null, 2));
        
        if (data.error_code) {
            throw new Error(`百度AI API错误: ${data.error_msg} (错误代码: ${data.error_code})`);
        }
        
        // 处理标准API返回结果
        const results = data.result || [];
        console.log('原始识别结果:', results);
        
        const mappedResults = results
            .filter(item => item.score > 0.2) // 降低阈值到20%，增加识别机会
            .map(item => ({
                name: item.keyword,
                score: item.score,
                description: getDescription(item.keyword, item.root, item.baike_info),
                modelLink: getModelLink(item.keyword),
                type: '通用物体识别',
                baikeInfo: item.baike_info
            }))
            .slice(0, 8);
        
        console.log('处理后的结果:', mappedResults);
        
        console.log('✅ 识别完成，返回结果');
        
        res.json({
            success: true,
            results: mappedResults,
            mode: '真实API'
        });
        
    } catch (error) {
        console.error('❌ 识别失败:', error.message);
        res.status(500).json({
            error: '图片识别失败',
            message: error.message
        });
    }
});

// 根据关键词获取描述
function getDescription(keyword, root, baikeInfo) {
    // 优先使用百度百科信息
    if (baikeInfo && baikeInfo.description) {
        // 截取百科描述的前100个字符，避免过长
        const description = baikeInfo.description.length > 100 
            ? baikeInfo.description.substring(0, 100) + '...'
            : baikeInfo.description;
        return description;
    }
    
    // 如果没有百科信息，使用预设描述
    const descriptions = {
        'AED': '自动体外除颤器，用于心脏骤停的紧急救治',
        '除颤仪': '自动体外除颤器，用于心脏骤停的紧急救治',
        '除颤器': '自动体外除颤器，用于心脏骤停的紧急救治',
        '自动体外除颤器': '自动体外除颤器，用于心脏骤停的紧急救治',
        '心脏除颤器': '心脏除颤器，用于心脏骤停的紧急救治',
        '体外除颤器': '体外除颤器，用于心脏骤停的紧急救治',
        '除颤': '除颤设备，用于心脏骤停的紧急救治',
        '灭火器': '灭火器是一种可携式灭火工具。灭火器内放置化学物品，用以救灭火灾。灭火器是常见的消防器材之一，存放在公众场所或可能发生火灾的地方，不同种类的灭火器内装填的成分不一样，是专为不同的火灾起因而设。',
        '消防栓': '固定消防设施，提供消防用水',
        '急救包': '包含基本急救用品和工具的医疗包',
        '医疗': '医疗相关设备或用品',
        '设备': '机械设备或工具',
        '工具': '各种工具或设备'
    };
    
    for (const [key, desc] of Object.entries(descriptions)) {
        if (keyword.includes(key) || (root && root.includes(key))) {
            return desc;
        }
    }
    
    return root || '未知类别';
}

// 根据识别结果获取对应的3D模型链接
function getModelLink(keyword) {
    const keywordMap = {
        'AED': 'model-viewer.html',
        '除颤仪': 'model-viewer.html',
        '除颤器': 'model-viewer.html',
        '自动体外除颤器': 'model-viewer.html',
        '心脏除颤器': 'model-viewer.html',
        '体外除颤器': 'model-viewer.html',
        '除颤': 'model-viewer.html',
        '灭火器': '#',
        '消防栓': '#',
        '急救包': '#',
        '医疗': '#'
    };
    
    for (const [key, value] of Object.entries(keywordMap)) {
        if (keyword.includes(key)) {
            return value;
        }
    }
    
    return '#';
}

// 健康检查接口
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: '应急AI识别服务运行正常',
        timestamp: new Date().toISOString()
    });
});

// 测试百度AI API接口
app.get('/api/test-baidu', async (req, res) => {
    try {
        const token = await getAccessToken();
        res.json({
            status: 'ok',
            message: '百度AI API连接正常',
            hasToken: !!token,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: '百度AI API连接失败',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 生成星火X1的带签名WebSocket URL（有效期1分钟）
app.get('/api/spark-x1/sign', (req, res) => {
    try {
        const date = new Date().toUTCString();
        const host = SPARK_X1.host;
        const path = SPARK_X1.path;
        const algorithm = 'hmac-sha256';
        const headers = 'host date request-line';

        const signatureOrigin = `host: ${host}\n` +
            `date: ${date}\n` +
            `GET ${path} HTTP/1.1`;

        const signatureSha = crypto
            .createHmac('sha256', SPARK_X1.apiSecret)
            .update(signatureOrigin)
            .digest('base64');

        const authorizationOrigin = `api_key=\"${SPARK_X1.apiKey}\", algorithm=\"${algorithm}\", headers=\"${headers}\", signature=\"${signatureSha}\"`;
        const authorization = Buffer.from(authorizationOrigin).toString('base64');

        const wsUrl = `${SPARK_X1.wss}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(host)}`;

        res.json({
            success: true,
            url: wsUrl,
            appId: SPARK_X1.appId
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 启动服务器
app.listen(SERVER_CONFIG.port, '0.0.0.0', () => {
    console.log(`🚀 应急AI识别服务器已启动！`);
    console.log(`📍 本地访问: http://localhost:${SERVER_CONFIG.port}`);
    console.log(`🌐 局域网访问: http://[您的IP地址]:${SERVER_CONFIG.port}`);
    console.log(`🔗 前端地址: http://[您的IP地址]:${SERVER_CONFIG.port}/image-recognition.html`);
    console.log(`📡 API接口: http://[您的IP地址]:${SERVER_CONFIG.port}/api/recognize`);
    console.log(`💚 健康检查: http://[您的IP地址]:${SERVER_CONFIG.port}/api/health`);
    console.log(`🧪 百度AI测试: http://[您的IP地址]:${SERVER_CONFIG.port}/api/test-baidu`);
    console.log(`\n📱 手机访问说明:`);
    console.log(`1. 确保手机和电脑连接同一个WiFi`);
    console.log(`2. 将[您的IP地址]替换为实际的IP地址`);
    console.log(`3. 在手机浏览器中输入完整地址即可访问`);
}); 