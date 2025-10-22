// 百度AI API配置
const BAIDU_CONFIG = {
    appId: '119859712',
    apiKey: 'qGGnrsPZIvr6ki3QF4c81UgF',
    secretKey: 'jcbsqhosMsHoLeCTIiIYRdNH1StRNeZR',
    // 使用后端服务进行图片识别
    useBackendService: true, // 设置为true时使用后端服务
    useMockData: false // 设置为false时使用真实API
};

// 全局变量
let selectedImage = null;
let accessToken = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeUploadArea();
    initializeFileInput();
    
    // 初始化识别按钮状态
    const recognizeBtn = document.getElementById('recognizeBtn');
    recognizeBtn.disabled = true;
    recognizeBtn.textContent = '🔍 请先选择图片';
    
    // 不再需要获取百度AI access token，使用后端服务
    console.log('使用后端服务进行图片识别');
});

// 初始化上传区域
function initializeUploadArea() {
    const uploadArea = document.getElementById('uploadArea');
    
    // 拖拽事件
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });
}

// 初始化文件输入
function initializeFileInput() {
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });
}

// 处理文件选择
function handleFileSelect(file) {
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
        showError('请选择图片文件！');
        return;
    }
    
    // 验证文件大小（限制为5MB）
    if (file.size > 5 * 1024 * 1024) {
        showError('图片文件大小不能超过5MB！');
        return;
    }
    
    selectedImage = file;
    
    // 显示图片预览
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewImg = document.getElementById('previewImg');
        const previewImgSide = document.getElementById('previewImgSide');
        previewImg.src = e.target.result;
        previewImgSide.src = e.target.result;
        
        // 隐藏上传区域
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.classList.add('hidden');
        
        // 隐藏原来的图片预览
        document.getElementById('imagePreview').style.display = 'none';
        
        // 显示新的并排布局容器
        document.getElementById('imageAndResultsContainer').style.display = 'flex';
        
        // 启用识别按钮
        const recognizeBtn = document.getElementById('recognizeBtn');
        recognizeBtn.disabled = false;
        recognizeBtn.textContent = '🔍 开始识别';
        
        // 隐藏之前的结果和错误
        document.getElementById('resultSection').style.display = 'block';
        document.getElementById('errorSection').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

// 开始识别图片
async function recognizeImage() {
    if (!selectedImage) {
        showError('请先选择图片！');
        return;
    }
    
    // 显示加载状态
    showLoading(true);
    
    try {
        let result;
        
        if (BAIDU_CONFIG.useMockData) {
            // 使用模拟数据进行演示
            result = await mockImageRecognition();
        } else if (BAIDU_CONFIG.useBackendService) {
            // 使用后端服务
            result = await callBackendService();
        } else {
            // 使用真实百度AI API（前端直接调用）
            result = await callBaiduAPI();
        }
        
        // 显示识别结果
        showRecognitionResult(result);
        
    } catch (error) {
        console.error('识别失败:', error);
        showError('图片识别失败，请重试！');
    } finally {
        showLoading(false);
    }
}

// 模拟图片识别（用于演示）
async function mockImageRecognition() {
    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 模拟识别结果，按置信度降序排序
    const mockResults = [
        {
            name: 'AED除颤仪',
            score: 0.95,
            description: '自动体外除颤器，用于心脏骤停的紧急救治',
            modelLink: 'model-viewer.html'
        },
        {
            name: '灭火器',
            score: 0.87,
            description: '灭火器是一种可携式灭火工具。灭火器内放置化学物品，用以救灭火灾。灭火器是常见的消防器材之一，存放在公众场所或可能发生火灾的地方，不同种类的灭火器内装填的成分不一样，是专为不同的火灾起因而设。',
            modelLink: '#'
        },
        {
            name: '急救包',
            score: 0.76,
            description: '包含基本急救用品和工具的医疗包',
            modelLink: '#'
        }
    ].sort((a, b) => b.score - a.score); // 按置信度降序排序
    
    return {
        success: true,
        results: mockResults
    };
}

// 调用后端服务进行图片识别
async function callBackendService() {
    try {
        // 创建FormData对象，用于文件上传
        const formData = new FormData();
        formData.append('image', selectedImage);
        
        console.log('正在调用后端服务进行图片识别...');
        
        // 调用后端API
        const response = await fetch('/api/recognize', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`后端服务错误: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // 处理后端返回的结果
        return processBackendResult(data);
        
    } catch (error) {
        console.error('后端服务调用失败:', error);
        throw new Error(`后端服务调用失败: ${error.message}`);
    }
}

// 调用百度AI API（需要后端代理）
async function callBaiduAPI() {
    if (!accessToken) {
        throw new Error('Access Token未获取');
    }
    
    // 将图片转换为base64
    const base64Image = await imageToBase64(selectedImage);
    
    // 调用百度AI图像识别API
    const response = await fetch(`https://aip.baidubce.com/rest/2.0/image-classify/v1/advanced_general?access_token=${accessToken}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `image=${encodeURIComponent(base64Image)}`
    });
    
    if (!response.ok) {
        throw new Error('API调用失败');
    }
    
    const data = await response.json();
    
    // 处理百度AI返回的结果
    return processBaiduResult(data);
}

// 获取百度AI access token
async function getAccessToken() {
    try {
        const response = await fetch(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_CONFIG.apiKey}&client_secret=${BAIDU_CONFIG.secretKey}`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error('获取Access Token失败');
        }
        
        const data = await response.json();
        accessToken = data.access_token;
        console.log('Access Token获取成功');
        
    } catch (error) {
        console.error('获取Access Token失败:', error);
        // 如果获取失败，回退到模拟模式
        BAIDU_CONFIG.useMockData = true;
    }
}

// 将图片转换为base64
function imageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64 = e.target.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 处理百度AI返回的结果
function processBaiduResult(data) {
    if (data.error_code) {
        throw new Error(`百度AI API错误: ${data.error_msg}`);
    }
    
    const results = data.result || [];
    
    // 过滤和映射结果，按置信度降序排序
    const mappedResults = results
        .filter(item => item.score > 0.5) // 只显示置信度大于50%的结果
        .map(item => ({
            name: item.keyword,
            score: item.score,
            description: item.root || '未知类别',
            modelLink: getModelLink(item.keyword)
        }))
        .sort((a, b) => b.score - a.score) // 按置信度降序排序
        .slice(0, 5); // 只显示前5个结果
    
    return {
        success: true,
        results: mappedResults
    };
}

// 处理后端返回的结果
function processBackendResult(data) {
    if (data.error) {
        throw new Error(`后端服务错误: ${data.error}`);
    }

    const results = data.results || [];

    // 过滤和映射结果，按置信度降序排序
    const mappedResults = results
        .filter(item => item.score > 0.5) // 只显示置信度大于50%的结果
        .map(item => ({
            name: item.name,
            score: item.score,
            description: item.description || '未知类别',
            modelLink: getModelLink(item.name) // 后端返回的name可能与百度AI不同
        }))
        .sort((a, b) => b.score - a.score) // 按置信度降序排序
        .slice(0, 5); // 只显示前5个结果

    return {
        success: true,
        results: mappedResults
    };
}

// 根据识别结果获取对应的3D模型链接
function getModelLink(keyword) {
    const keywordMap = {
        'AED': 'model-viewer.html',
        '除颤仪': 'model-viewer.html',
        '除颤器': 'model-viewer.html',
        '灭火器': '#',
        '消防栓': '#',
        '急救包': '#',
        '医疗': '#'
    };
    
    for (const [key, value] of Object.entries(keywordMap)) {
        if (keyword.includes(key)) {
            return value;
        }
    }
    
    return '#';
}

// 显示识别结果
function showRecognitionResult(data) {
    const resultSection = document.getElementById('resultSection');
    const resultContent = document.getElementById('resultContent');
    
    if (!data.success || !data.results || data.results.length === 0) {
        resultContent.innerHTML = '<p>未识别到相关设备，请尝试其他图片。</p>';
    } else {
        // 只显示置信度最高的结果
        const bestResult = data.results[0]; // 结果已经按置信度排序，第一个就是最高的
        
        // 保存当前最佳结果到全局变量，供展开/收起功能使用
        window.currentBestResult = bestResult;
        
        const scorePercent = Math.round(bestResult.score * 100);
        const typeBadge = bestResult.type ? `<span style="background: #007bff; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 10px;">${bestResult.type}</span>` : '';
        const modelButton = bestResult.modelLink !== '#' 
            ? `<button class="recognition-btn" onclick="window.location.href='${bestResult.modelLink}'" style="background: #007bff; margin-top: 10px;">🎯 查看3D模型</button>`
            : '<span style="color: #6c757d; font-size: 14px;">3D模型开发中</span>';
        
        // 智能截断描述文字
        const maxLength = 80; // 减少截断长度，确保有明显的截断效果
        let displayDescription = bestResult.description;
        let showExpandBtn = false;
        
        if (bestResult.description.length > maxLength) {
            // 在句号、逗号等标点符号处截断，避免截断单词
            const truncateIndex = bestResult.description.lastIndexOf('。', maxLength);
            const commaIndex = bestResult.description.lastIndexOf('，', maxLength);
            const periodIndex = bestResult.description.lastIndexOf('、', maxLength);
            
            const cutIndex = Math.max(truncateIndex, commaIndex, periodIndex);
            
            if (cutIndex > maxLength * 0.7) { // 如果找到合适的截断点
                displayDescription = bestResult.description.substring(0, cutIndex + 1) + '...';
            } else {
                displayDescription = bestResult.description.substring(0, maxLength) + '...';
            }
            showExpandBtn = true;
            
            // 调试信息
            console.log('描述长度:', bestResult.description.length);
            console.log('截断后长度:', displayDescription.length);
            console.log('显示展开按钮:', showExpandBtn);
            console.log('截断后的描述:', displayDescription);
        }
        
        // 添加百科链接（如果有的话）
        const baikeLink = bestResult.baikeInfo && bestResult.baikeInfo.baike_url 
            ? `<div style="margin: 8px 0;"><a href="${bestResult.baikeInfo.baike_url}" target="_blank" style="color: #007bff; text-decoration: none;">📚 查看百度百科</a></div>`
            : '';
        
        const html = `
            <div class="result-item">
                <div class="result-name">🎯 ${bestResult.name}${typeBadge}</div>
                <div class="result-score">置信度: ${scorePercent}%</div>
                <div class="description-container">
                    <div class="description-text" id="descriptionText">${displayDescription}</div>
                    ${showExpandBtn ? `<button class="expand-btn" onclick="toggleDescription()" id="expandBtn">📖 展开详情</button>` : ''}
                </div>
                ${baikeLink}
                ${modelButton}
            </div>
        `;
        
        // 调试信息
        console.log('描述长度:', bestResult.description.length);
        console.log('截断后长度:', displayDescription.length);
        console.log('显示展开按钮:', showExpandBtn);
        console.log('完整描述:', bestResult.description);
        console.log('截断后的描述:', displayDescription);
        
        // 如果描述很长，强制显示展开按钮
        if (bestResult.description.length > 50 && !showExpandBtn) {
            console.log('描述较长但未显示展开按钮，强制显示');
            showExpandBtn = true;
        }
        
        resultContent.innerHTML = html;
    }
    
    // 确保结果区域在并排布局中可见
    resultSection.style.display = 'block';
}

// 显示加载状态
function showLoading(show) {
    const loadingSection = document.getElementById('loadingSection');
    const recognizeBtn = document.getElementById('recognizeBtn');
    
    if (show) {
        loadingSection.style.display = 'block';
        recognizeBtn.disabled = true;
        recognizeBtn.textContent = '识别中...';
    } else {
        loadingSection.style.display = 'none';
        recognizeBtn.disabled = false;
        recognizeBtn.textContent = '🔍 开始识别';
    }
}

// 显示错误信息
function showError(message) {
    const errorSection = document.getElementById('errorSection');
    errorSection.innerHTML = `<div class="error-message">❌ ${message}</div>`;
    errorSection.style.display = 'block';
    
    // 3秒后自动隐藏错误信息
    setTimeout(() => {
        errorSection.style.display = 'none';
    }, 3000);
}

// 工具函数：防抖
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 展开/收起描述文字
function toggleDescription() {
    const descriptionText = document.getElementById('descriptionText');
    const expandBtn = document.getElementById('expandBtn');
    
    if (descriptionText.classList.contains('expanded')) {
        // 收起 - 显示截断的描述
        const bestResult = window.currentBestResult; // 存储当前最佳结果
        if (bestResult) {
            const maxLength = 80; // 与显示时的长度保持一致
            let displayDescription = bestResult.description;
            
            if (bestResult.description.length > maxLength) {
                const truncateIndex = bestResult.description.lastIndexOf('。', maxLength);
                const commaIndex = bestResult.description.lastIndexOf('，', maxLength);
                const periodIndex = bestResult.description.lastIndexOf('、', maxLength);
                
                const cutIndex = Math.max(truncateIndex, commaIndex, periodIndex);
                
                if (cutIndex > maxLength * 0.7) {
                    displayDescription = bestResult.description.substring(0, cutIndex + 1) + '...';
                } else {
                    displayDescription = bestResult.description.substring(0, maxLength) + '...';
                }
            }
            descriptionText.textContent = displayDescription;
        }
        
        descriptionText.classList.remove('expanded');
        expandBtn.textContent = '📖 展开详情';
        expandBtn.style.background = '#007bff';
        
        // 调试信息
        console.log('收起描述，显示截断版本');
    } else {
        // 展开 - 显示完整描述
        const bestResult = window.currentBestResult;
        if (bestResult) {
            descriptionText.textContent = bestResult.description;
            console.log('展开描述，显示完整版本:', bestResult.description);
        }
        
        descriptionText.classList.add('expanded');
        expandBtn.textContent = '📖 收起详情';
        expandBtn.style.background = '#6c757d';
    }
}

// 重新选择图片
function resetImageSelection() {
    // 清空选择的图片
    selectedImage = null;
    
    // 清空文件输入
    document.getElementById('fileInput').value = '';
    
    // 显示上传区域
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.classList.remove('hidden');
    
    // 隐藏原来的图片预览
    document.getElementById('imagePreview').style.display = 'none';
    
    // 隐藏新的并排布局容器
    document.getElementById('imageAndResultsContainer').style.display = 'none';
    
    // 重置识别按钮
    const recognizeBtn = document.getElementById('recognizeBtn');
    recognizeBtn.disabled = true;
    recognizeBtn.textContent = '🔍 请先选择图片';
    
    // 隐藏结果和错误
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('errorSection').style.display = 'none';
} 