const Busboy = require('busboy');
const {
    recognizeWithZhipuBuffer,
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
        let mimeType = 'image/jpeg';

        busboy.on('file', (_fieldname, file, info) => {
            hasFile = true;
            mimeType = info && info.mimeType ? info.mimeType : mimeType;

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

            resolve({
                buffer: Buffer.concat(chunks),
                mimeType
            });
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
        const imageFile = await parseMultipartImage(event);
        const recognition = await recognizeWithZhipuBuffer(imageFile.buffer, imageFile.mimeType);

        return jsonResponse(200, {
            success: true,
            results: recognition.results,
            mode: `Zhipu ${recognition.model}`
        });
    } catch (error) {
        return jsonResponse(500, {
            error: '图片识别失败',
            message: error.message
        });
    }
};
