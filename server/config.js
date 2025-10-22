// 百度AI API配置
const BAIDU_CONFIG = {
    appId: '119859712',
    apiKey: 'qGGnrsPZIvr6ki3QF4c81UgF',
    secretKey: 'jcbsqhosMsHoLeCTIiIYRdNH1StRNeZR'
};

// 星火X1 配置（请替换为你的真实凭据）
const SPARK_X1 = {
    appId: process.env.SPARK_X1_APP_ID || 'ab1d3d54',
    apiKey: process.env.SPARK_X1_API_KEY || '6a20180ef6391a80bea71fcbadd86c0c',
    apiSecret: process.env.SPARK_X1_API_SECRET || 'MjM5MzY1MDE5MmQyNGEwODFhOWE2Y2M2',
    host: 'spark-api.xf-yun.com',
    path: '/v1/x1',
    wss: 'wss://spark-api.xf-yun.com/v1/x1'
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