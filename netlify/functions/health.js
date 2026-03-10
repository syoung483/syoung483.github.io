const { handleOptions, jsonResponse } = require('./_shared');

exports.handler = async (event) => {
    const optionsResponse = handleOptions(event);
    if (optionsResponse) {
        return optionsResponse;
    }

    return jsonResponse(200, {
        status: 'ok',
        message: 'Netlify Functions 运行正常',
        timestamp: new Date().toISOString()
    });
};
