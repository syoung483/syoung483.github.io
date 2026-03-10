// 百度AI API配置
const BAIDU_CONFIG = {
    appId: '119859712',
    apiKey: 'qGGnrsPZIvr6ki3QF4c81UgF',
    secretKey: 'jcbsqhosMsHoLeCTIiIYRdNH1StRNeZR'
};

// 星火X1 配置
// 说明：
// 1. 本地开发建议通过环境变量覆盖，避免将真实凭据硬编码到仓库
// 2. 当前项目使用星火 X1 旧版 WebSocket 路由，默认 domain 为 x1
const SPARK_X1 = {
    appId: process.env.SPARK_X1_APP_ID || 'ab1d3d54',
    apiKey: process.env.SPARK_X1_API_KEY || '6a20180ef6391a80bea71fcbadd86c0c',
    apiSecret: process.env.SPARK_X1_API_SECRET || 'MjM5MzY1MDE5MmQyNGEwODFhOWE2Y2M2',
    modelId: process.env.SPARK_X1_MODEL_ID || process.env.SPARK_X1_DOMAIN || 'x1',
    host: process.env.SPARK_X1_HOST || 'spark-api.xf-yun.com',
    path: process.env.SPARK_X1_PATH || '/v1/x1',
    wss: process.env.SPARK_X1_WSS || 'wss://spark-api.xf-yun.com/v1/x1'
};

// 服务器配置
const SERVER_CONFIG = {
    port: 3001,
    env: 'development'
};

module.exports = {
    BAIDU_CONFIG,
    SERVER_CONFIG,
    SPARK_X1
}; 