const crypto = require('crypto');

let baiduAccessToken = null;
let baiduTokenExpireTime = 0;
let legacyConfig = null;
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

function getLegacyConfig() {
    if (legacyConfig !== null) {
        return legacyConfig;
    }

    try {
        legacyConfig = require('../../server/config');
    } catch (_error) {
        legacyConfig = {};
    }

    return legacyConfig;
}

function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    };
}

function jsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...getCorsHeaders()
        },
        body: JSON.stringify(body)
    };
}

function handleOptions(event) {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: getCorsHeaders(),
            body: ''
        };
    }

    return null;
}

function getConfig() {
    const legacy = getLegacyConfig();
    const legacyBaidu = legacy.BAIDU_CONFIG || {};
    const legacySpark = legacy.SPARK_X1 || {};
    const legacyZhipu = legacy.ZHIPU_CONFIG || {};

    return {
        baidu: {
            appId: process.env.BAIDU_APP_ID || process.env.BAIDU_AI_APP_ID || legacyBaidu.appId || '',
            apiKey: process.env.BAIDU_API_KEY || legacyBaidu.apiKey || '',
            secretKey: process.env.BAIDU_SECRET_KEY || legacyBaidu.secretKey || ''
        },
        zhipu: {
            apiKey: process.env.ZHIPU_API_KEY || legacyZhipu.apiKey || '',
            model: process.env.ZHIPU_MODEL || legacyZhipu.model || 'glm-4v-flash'
        },
        spark: {
            appId: process.env.SPARK_X1_APP_ID || legacySpark.appId || '',
            apiKey: process.env.SPARK_X1_API_KEY || legacySpark.apiKey || '',
            apiSecret: process.env.SPARK_X1_API_SECRET || legacySpark.apiSecret || '',
            modelId: process.env.SPARK_X1_MODEL_ID || process.env.SPARK_X1_DOMAIN || legacySpark.modelId || 'x1',
            host: process.env.SPARK_X1_HOST || 'spark-api.xf-yun.com',
            path: process.env.SPARK_X1_PATH || '/v1/x1',
            wss: process.env.SPARK_X1_WSS || 'wss://spark-api.xf-yun.com/v1/x1'
        }
    };
}

async function getBaiduAccessToken() {
    const now = Date.now();
    if (baiduAccessToken && now < baiduTokenExpireTime) {
        return baiduAccessToken;
    }

    const { baidu } = getConfig();
    if (!baidu.apiKey || !baidu.secretKey) {
        throw new Error('未配置百度 AI 环境变量');
    }

    const tokenUrl = new URL('https://aip.baidubce.com/oauth/2.0/token');
    tokenUrl.searchParams.set('grant_type', 'client_credentials');
    tokenUrl.searchParams.set('client_id', baidu.apiKey);
    tokenUrl.searchParams.set('client_secret', baidu.secretKey);

    const response = await fetch(tokenUrl, { method: 'POST' });
    const data = await response.json();

    if (!response.ok || data.error) {
        throw new Error(data.error_description || data.error_msg || '获取百度 Access Token 失败');
    }

    baiduAccessToken = data.access_token;
    baiduTokenExpireTime = now + ((data.expires_in || 0) - 60) * 1000;
    return baiduAccessToken;
}

function getDescription(keyword, root, baikeInfo) {
    if (baikeInfo && baikeInfo.description) {
        return baikeInfo.description.length > 100
            ? `${baikeInfo.description.substring(0, 100)}...`
            : baikeInfo.description;
    }

    const descriptions = {
        'AED': '自动体外除颤器，用于心脏骤停的紧急救治',
        '除颤仪': '自动体外除颤器，用于心脏骤停的紧急救治',
        '除颤器': '自动体外除颤器，用于心脏骤停的紧急救治',
        '自动体外除颤器': '自动体外除颤器，用于心脏骤停的紧急救治',
        '心脏除颤器': '心脏除颤器，用于心脏骤停的紧急救治',
        '体外除颤器': '体外除颤器，用于心脏骤停的紧急救治',
        '除颤': '除颤设备，用于心脏骤停的紧急救治',
        '灭火器': '灭火器是一种可携式灭火工具。灭火器内放置化学物品，用以救灭火灾。',
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
    } catch (_error) {
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

async function recognizeWithZhipuBuffer(imageBuffer, mimeType = 'image/jpeg') {
    const { zhipu } = getConfig();
    if (!zhipu.apiKey) {
        throw new Error('未配置 ZHIPU_API_KEY');
    }

    const base64Image = imageBuffer.toString('base64');
    const response = await fetch(ZHIPU_API_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${zhipu.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: zhipu.model,
            temperature: 0.1,
            messages: [
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
            ]
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || data.message || '智谱识别请求失败');
    }

    const content = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : '';
    const results = parseZhipuRecognitionResult(content).slice(0, 8);

    if (results.length === 0) {
        throw new Error('智谱未返回有效识别结果');
    }

    return {
        model: zhipu.model,
        results
    };
}

function buildSparkSignedUrl() {
    const { spark } = getConfig();
    if (!spark.appId || !spark.apiKey || !spark.apiSecret) {
        throw new Error('未配置星火 X1 环境变量');
    }

    const date = new Date().toUTCString();
    const signatureOrigin = `host: ${spark.host}\n` +
        `date: ${date}\n` +
        `GET ${spark.path} HTTP/1.1`;

    const signatureSha = crypto
        .createHmac('sha256', spark.apiSecret)
        .update(signatureOrigin)
        .digest('base64');

    const authorizationOrigin = `api_key="${spark.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');

    return {
        url: `${spark.wss}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(spark.host)}`,
        appId: spark.appId,
        modelId: spark.modelId
    };
}

module.exports = {
    getConfig,
    getBaiduAccessToken,
    recognizeWithZhipuBuffer,
    getDescription,
    getModelLink,
    buildSparkSignedUrl,
    getCorsHeaders,
    handleOptions,
    jsonResponse
};
