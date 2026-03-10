window.APP_CONFIG = window.APP_CONFIG || {
    // 如需单独公网后端，可在这里填写，例如：
    // backendBaseUrl: 'https://api.example.com'
    // 留空时：
    // 1. 本地 file:// 访问会走 http://localhost:3001
    // 2. localhost 页面会走 localhost:3001
    // 3. Netlify 等线上站点会默认走当前域名下的 /api
    backendBaseUrl: ''
};

function normalizeBackendBaseUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
}

function getConfiguredBackendBaseUrl() {
    const configured = normalizeBackendBaseUrl(window.APP_CONFIG.backendBaseUrl);
    if (configured) {
        return configured;
    }

    const { protocol, hostname, port, origin } = window.location;

    if (protocol === 'file:') {
        return 'http://localhost:3001';
    }

    if (port === '3001') {
        return origin;
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//${hostname}:3001`;
    }

    return origin;
}
