const Busboy = require('busboy');
const {
    getBaiduAccessToken,
    getDescription,
    getModelLink,
    handleOptions,
    jsonResponse
} = require('./_shared');

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function parseMultipartImage(event) {
    return new Promise((resolve, reject) => {
        const contentType = event.headers['content-type'] || event.headers['Content-Type'];
        if (!contentType || !contentType.includes('multipart/form-data')) {
            reject(new Error('请求必须是 multipart/form-data'));
            return;
        }

        const busboy = Busboy({
            headers: { 'content-type': contentType },
            limits: { files: 1, fileSize: MAX_FILE_SIZE }
        });

        const chunks = [];
        let hasFile = false;
        let fileTooLarge = false;

        busboy.on('file', (_fieldname, file) => {
            hasFile = true;

            file.on('data', (chunk) => {
                chunks.push(chunk);
            });

            file.on('limit', () => {
                fileTooLarge = true;
            });
        });

        busboy.on('finish', () => {
            if (!hasFile) {
                reject(new Error('请上传图片文件'));
                return;
            }

            if (fileTooLarge) {
                reject(new Error('图片文件大小不能超过5MB'));
                return;
            }

            resolve(Buffer.concat(chunks));
        });

        busboy.on('error', reject);

        const body = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8');
        busboy.end(body);
    });
}

exports.handler = async (event) => {
    const optionsResponse = handleOptions(event);
    if (optionsResponse) {
        return optionsResponse;
    }

    if (event.httpMethod !== 'POST') {
        return jsonResponse(405, { error: '仅支持 POST 请求' });
    }

    try {
        const imageBuffer = await parseMultipartImage(event);
        const token = await getBaiduAccessToken();
        const base64Image = imageBuffer.toString('base64');

        const apiUrl = `https://aip.baidubce.com/rest/2.0/image-classify/v2/advanced_general?access_token=${token}`;
        const requestBody = new URLSearchParams({
            image: base64Image,
            baike_num: '3'
        });

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: requestBody.toString()
        });

        const data = await response.json();
        if (!response.ok || data.error_code) {
            throw new Error(`百度AI API错误: ${data.error_msg || response.statusText}`);
        }

        const results = (data.result || [])
            .filter((item) => item.score > 0.2)
            .map((item) => ({
                name: item.keyword,
                score: item.score,
                description: getDescription(item.keyword, item.root, item.baike_info),
                modelLink: getModelLink(item.keyword),
                type: '通用物体识别',
                baikeInfo: item.baike_info
            }))
            .slice(0, 8);

        return jsonResponse(200, {
            success: true,
            results,
            mode: '真实API'
        });
    } catch (error) {
        return jsonResponse(500, {
            error: '图片识别失败',
            message: error.message
        });
    }
};
