const { getBaiduAccessToken, handleOptions, jsonResponse } = require('./_shared');

exports.handler = async (event) => {
    const optionsResponse = handleOptions(event);
    if (optionsResponse) {
        return optionsResponse;
    }

    try {
        const token = await getBaiduAccessToken();
        return jsonResponse(200, {
            status: 'ok',
            message: '百度 AI API 连接正常',
            hasToken: !!token,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return jsonResponse(500, {
            status: 'error',
            message: '百度 AI API 连接失败',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};
