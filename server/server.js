require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const crypto = require('crypto');
const { SERVER_CONFIG, SPARK_X1, ZHIPU_CONFIG } = require('./config');

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

const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const ZHIPU_RECOGNITION_PROMPT = [
    '请识别这张图片中的主要物体、设备或场景，并给出尽可能具体、准确的名称。',
    '',
    '要求：',
    '1. 返回最可能的 5 个结果，按置信度从高到低排序',
    '2. 每个结果包含 name、confidence、description',
    '3. 如果识别的是设备，请尽量使用具体设备名称，不要只返回“工具”“机器”“装置”这类泛化名称',
    '4. 如果图片内容模糊或无法判断，可以返回较低置信度结果',
    '5. 只返回 JSON，不要输出其他文字',
    '',
    '返回格式：',
    '{',
    '  "results": [',
    '    {',
    '      "name": "",',
    '      "confidence": 0.0,',
    '      "description": ""',
    '    }',
    '  ]',
    '}'
].join('\n');

function getZhipuApiKey() {
    const apiKey = String(ZHIPU_CONFIG.apiKey || '').trim();
    if (!apiKey) {
        throw new Error('未配置 ZHIPU_API_KEY，请先在 server/.env 中填写智谱 API Key');
    }

    return apiKey;
}

function normalizeAssistantContent(content) {
    if (typeof content === 'string') {
        return content.trim();
    }

    if (Array.isArray(content)) {
        return content
            .map((item) => {
                if (typeof item === 'string') {
                    return item;
                }

                if (item && typeof item.text === 'string') {
                    return item.text;
                }

                return '';
            })
            .join('\n')
            .trim();
    }

    return String(content || '').trim();
}

function extractJsonPayload(text) {
    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch) {
        return fencedMatch[1].trim();
    }

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        return text.slice(firstBrace, lastBrace + 1);
    }

    return text;
}

function normalizeConfidence(value, fallback) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
        return Math.min(1, Math.max(0, numeric));
    }

    return fallback;
}

function parseZhipuRecognitionResult(content) {
    const normalizedContent = normalizeAssistantContent(content);
    const jsonPayload = extractJsonPayload(normalizedContent);

    let parsed;
    try {
        parsed = JSON.parse(jsonPayload);
    } catch (error) {
        throw new Error('智谱返回结果不是有效 JSON');
    }

    const rawResults = Array.isArray(parsed.results) ? parsed.results : [];
    return rawResults
        .map((item, index) => {
            const name = String(item && item.name ? item.name : '未知类别').trim();
            const description = String(item && item.description ? item.description : '暂无描述').trim();
            const fallbackScore = Math.max(0.1, 0.85 - index * 0.12);
            const score = normalizeConfidence(item && item.confidence, fallbackScore);

            return {
                name,
                score,
                description,
                modelLink: getModelLink(name),
                type: '智谱 GLM-4V-Flash'
            };
        })
        .filter((item) => item.name);
}

async function callZhipuChat(messages) {
    const response = await axios.post(
        ZHIPU_API_URL,
        {
            model: ZHIPU_CONFIG.model,
            messages,
            temperature: 0.1
        },
        {
            headers: {
                Authorization: `Bearer ${getZhipuApiKey()}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        }
    );

    return response.data;
}

async function recognizeWithZhipu(file) {
    const base64Image = file.buffer.toString('base64');
    const mimeType = file.mimetype || 'image/jpeg';

    console.log('正在调用智谱 GLM-4V-Flash 进行图片识别...');
    console.log('图片大小:', base64Image.length, '字符');

    const data = await callZhipuChat([
        {
            role: 'user',
            content: [
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:${mimeType};base64,${base64Image}`
                    }
                },
                {
                    type: 'text',
                    text: ZHIPU_RECOGNITION_PROMPT
                }
            ]
        }
    ]);

    const content = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : '';
    const results = parseZhipuRecognitionResult(content).slice(0, 8);

    if (results.length === 0) {
        throw new Error('智谱未返回有效识别结果');
    }

    console.log('智谱识别结果:', results);
    return results;
}

// 图片识别API接口
app.post('/api/recognize', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请上传图片文件' });
        }
        
        const results = await recognizeWithZhipu(req.file);
        console.log('✅ 智谱识别完成，返回结果');

        res.json({
            success: true,
            results,
            mode: 'Zhipu GLM-4V-Flash'
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

// 根据识别结果获取对应的使用教学链接
function getModelLink(keyword) {
    const keywordMap = {
        'AED': 'teaching-aed.html',
        '除颤仪': 'teaching-aed.html',
        '除颤器': 'teaching-aed.html',
        '自动体外除颤器': 'teaching-aed.html',
        '心脏除颤器': 'teaching-aed.html',
        '体外除颤器': 'teaching-aed.html',
        '除颤': 'teaching-aed.html',
        '灭火器': 'teaching-video.html?device=灭火器',
        '消防栓': '#',
        '急救包': '#',
        '报警': 'teaching-video.html?device=场外报警2',
        '报警器': 'teaching-video.html?device=场外报警2',
        '宿舍': 'teaching-video.html?device=宿舍',
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

// 测试智谱 API 接口
async function handleZhipuTest(_req, res) {
    try {
        const data = await callZhipuChat([
            {
                role: 'user',
                content: '请只回复 ok'
            }
        ]);

        res.json({
            status: 'ok',
            message: '智谱 AI API连接正常',
            model: ZHIPU_CONFIG.model,
            hasApiKey: Boolean(String(ZHIPU_CONFIG.apiKey || '').trim()),
            reply: normalizeAssistantContent(data && data.choices && data.choices[0] && data.choices[0].message
                ? data.choices[0].message.content
                : ''),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: '智谱 AI API连接失败',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

app.get('/api/test-zhipu', handleZhipuTest);
app.get('/api/test-baidu', handleZhipuTest);

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
            appId: SPARK_X1.appId,
            modelId: SPARK_X1.modelId
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
    console.log(`🧪 智谱AI测试: http://[您的IP地址]:${SERVER_CONFIG.port}/api/test-zhipu`);
    console.log(`\n📱 手机访问说明:`);
    console.log(`1. 确保手机和电脑连接同一个WiFi`);
    console.log(`2. 将[您的IP地址]替换为实际的IP地址`);
    console.log(`3. 在手机浏览器中输入完整地址即可访问`);
}); 