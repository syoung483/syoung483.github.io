const { buildSparkSignedUrl, handleOptions, jsonResponse } = require('./_shared');

exports.handler = async (event) => {
    const optionsResponse = handleOptions(event);
    if (optionsResponse) {
        return optionsResponse;
    }

    try {
        const result = buildSparkSignedUrl();
        return jsonResponse(200, {
            success: true,
            ...result
        });
    } catch (error) {
        return jsonResponse(500, {
            success: false,
            message: error.message
        });
    }
};
