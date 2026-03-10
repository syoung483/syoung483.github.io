const crypto = require('crypto');

let baiduAccessToken = null;
let baiduTokenExpireTime = 0;
let legacyConfig = null;

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

    return {
        baidu: {
            appId: process.env.BAIDU_APP_ID || process.env.BAIDU_AI_APP_ID || legacyBaidu.appId || '',
            apiKey: process.env.BAIDU_API_KEY || legacyBaidu.apiKey || '',
            secretKey: process.env.BAIDU_SECRET_KEY || legacyBaidu.secretKey || ''
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
        'AED': 'model-viewer.html',
        '除颤仪': 'model-viewer.html',
        '除颤器': 'model-viewer.html',
        '自动体外除颤器': 'model-viewer.html',
        '心脏除颤器': 'model-viewer.html',
        '体外除颤器': 'model-viewer.html',
        '除颤': 'model-viewer.html',
        '灭火器': 'model-viewer-universal.html?model=灭火器',
        '消防栓': '#',
        '急救包': '#',
        '报警': 'model-viewer-universal.html?model=场外报警2',
        '报警器': 'model-viewer-universal.html?model=场外报警2',
        '宿舍': 'model-viewer-universal.html?model=宿舍',
        '医疗': '#'
    };

    for (const [key, value] of Object.entries(keywordMap)) {
        if (keyword.includes(key)) {
            return value;
        }
    }

    return '#';
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
    getDescription,
    getModelLink,
    buildSparkSignedUrl,
    getCorsHeaders,
    handleOptions,
    jsonResponse
};
