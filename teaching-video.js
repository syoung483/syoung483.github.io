const videoTeachingConfig = {
    '场外报警2': {
        badge: '场外报警设备教学',
        title: '场外报警设备使用教学',
        description: '此页面播放场外报警设备的使用教学视频，进入页面后点击即可观看演示。',
        panelTitle: '场外报警设备',
        panelText: '用于展示场外报警设备的教学流程视频，便于课堂讲解和现场演示。',
        tags: ['视频教学', '报警设备', '操作演示'],
        video: '场外.mp4',
        modelUrl: 'model-viewer-universal.html?model=场外报警2&back=usage-select.html',
        modelText: '查看场外报警模型'
    },
    '宿舍': {
        badge: '宿舍教学',
        title: '宿舍使用教学',
        description: '此页面播放宿舍场景的教学视频，点击播放后可直接查看演示内容。',
        panelTitle: '宿舍场景',
        panelText: '用于展示宿舍相关场景的教学视频，适合安全演练和设备说明。',
        tags: ['视频教学', '宿舍场景', '安全演示'],
        video: '宿舍.mp4',
        modelUrl: 'model-viewer-universal.html?model=宿舍&back=usage-select.html',
        modelText: '查看宿舍模型'
    },
    '灭火器': {
        badge: '灭火器教学',
        title: '灭火器使用教学',
        description: '此页面播放灭火器的使用教学视频，点击播放即可查看操作演示。',
        panelTitle: '灭火器',
        panelText: '用于展示灭火器的使用方法和演示内容，便于快速学习和教学展示。',
        tags: ['视频教学', '灭火器', '灭火演示'],
        video: '灭火器.mp4',
        modelUrl: 'model-viewer-universal.html?model=灭火器&back=usage-select.html',
        modelText: '查看灭火器模型'
    }
};

function getTeachingDeviceConfig() {
    const params = new URLSearchParams(window.location.search);
    const device = params.get('device') || '灭火器';
    return videoTeachingConfig[device] || videoTeachingConfig['灭火器'];
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value;
    }
}

function tryPlayVideo(video, overlay) {
    const playPromise = video.play();
    if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(() => {
            overlay.classList.add('hidden');
        }).catch(() => {
            overlay.classList.remove('hidden');
        });
        return;
    }

    overlay.classList.add('hidden');
}

function initTeachingVideoPage() {
    const config = getTeachingDeviceConfig();
    const video = document.getElementById('teachingVideo');
    const overlay = document.getElementById('videoOverlay');
    const playBtn = document.getElementById('playBtn');
    const playActionBtn = document.getElementById('playActionBtn');
    const modelLinkBtn = document.getElementById('modelLinkBtn');
    const tags = config.tags || [];

    document.title = config.title;
    setText('pageBadge', config.badge);
    setText('pageTitle', config.title);
    setText('pageDescription', config.description);
    setText('panelTitle', config.panelTitle);
    setText('panelText', config.panelText);
    setText('metaTag1', tags[0] || '视频教学');
    setText('metaTag2', tags[1] || '点击播放');
    setText('metaTag3', tags[2] || '支持全屏');
    setText('videoHint', '如果浏览器未自动播放，点击播放器中间或“重新播放”按钮即可开始。');

    modelLinkBtn.href = config.modelUrl;
    modelLinkBtn.textContent = config.modelText;

    video.src = encodeURI(config.video);

    const handlePlay = () => {
        video.currentTime = 0;
        tryPlayVideo(video, overlay);
    };

    playBtn.addEventListener('click', handlePlay);
    playActionBtn.addEventListener('click', handlePlay);
    video.addEventListener('play', () => overlay.classList.add('hidden'));
    video.addEventListener('pause', () => {
        if (video.currentTime < video.duration) {
            overlay.classList.remove('hidden');
        }
    });
    video.addEventListener('ended', () => overlay.classList.remove('hidden'));
}

window.addEventListener('DOMContentLoaded', initTeachingVideoPage);
