window.APP_CONFIG = window.APP_CONFIG || {
    // 如需单独公网后端，可在这里填写，例如：
    // backendBaseUrl: 'https://api.example.com'
    // 留空时：
    // 1. 本地 file:// 访问会走 http://localhost:3001
    // 2. localhost 页面会走 localhost:3001
    // 3. Netlify 等具备函数能力的线上站点会默认走当前域名下的 /api
    // 4. GitHub Pages 不支持同域后端，请显式填写 backendBaseUrl
    backendBaseUrl: ''
};

function normalizeBackendBaseUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
}

function getBackendBaseUrlOverride() {
    const params = new URLSearchParams(window.location.search);
    const queryOverride = normalizeBackendBaseUrl(params.get('backend'));
    if (queryOverride) {
        try {
            window.localStorage.setItem('backendBaseUrlOverride', queryOverride);
        } catch (_error) {
            // 忽略存储失败，继续使用本次 URL 参数
        }
        return queryOverride;
    }

    try {
        return normalizeBackendBaseUrl(window.localStorage.getItem('backendBaseUrlOverride'));
    } catch (_error) {
        return '';
    }
}

function getConfiguredBackendBaseUrl() {
    const override = getBackendBaseUrlOverride();
    if (override) {
        return override;
    }

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

    if (/github\.io$/i.test(hostname)) {
        return '';
    }

    return origin;
}
