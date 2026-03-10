// 通用模型查看器 - 通过URL参数加载模型
let scene, camera, renderer, controls;
let currentModel;
let mixer;
let animations = [];
let clock;

const runtimeConfig = createRuntimeConfig();
let loadingHintTimer = null;

// 模型配置
const modelConfig = {
    '场外报警2': {
        paths: ['场外报警2.glb', 'models/场外报警2.glb'],
        title: '🚨 场外报警设备',
        scale: 5
    },
    '灭火器': {
        paths: ['灭火器.glb', 'models/灭火器.glb'],
        title: '🧯 灭火器',
        scale: 5
    },
    '宿舍': {
        paths: ['宿舍.glb', 'models/宿舍.glb'],
        title: '🏠 宿舍模型',
        scale: 5
    },
    'aed': {
        paths: ['models/aed.glb', 'aed.glb'],
        title: '🏥 AED除颤仪',
        scale: 5
    }
};

function createRuntimeConfig() {
    const ua = navigator.userAgent || '';
    const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    const deviceMemory = Number(navigator.deviceMemory || 0);
    const cpuCores = Number(navigator.hardwareConcurrency || 0);
    const reduceQuality = isMobileUa || isTouchDevice || (deviceMemory > 0 && deviceMemory <= 4) || (cpuCores > 0 && cpuCores <= 4);

    return {
        isMobile: isMobileUa || isTouchDevice,
        reduceQuality,
        antialias: !reduceQuality,
        enableShadows: !reduceQuality,
        pixelRatioCap: reduceQuality ? 1.25 : 2,
        longLoadHintMs: reduceQuality ? 6000 : 8000
    };
}

// 初始化
function init() {
    console.log('开始初始化...', runtimeConfig);
    
    const urlParams = new URLSearchParams(window.location.search);
    const modelName = urlParams.get('model') || 'aed';
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
    camera.position.set(200, 100, 200);
    camera.lookAt(0, 0, 0);
    
    renderer = new THREE.WebGLRenderer({
        antialias: runtimeConfig.antialias,
        powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, runtimeConfig.pixelRatioCap));
    renderer.shadowMap.enabled = runtimeConfig.enableShadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    
    const container = document.getElementById('threeRef');
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);
    
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = !runtimeConfig.isMobile;
    
    initLights();
    addGround();
    
    clock = new THREE.Clock();
    loadModel(modelName);
    animate();
    
    window.addEventListener('resize', onWindowResize, false);
    
    console.log('初始化完成');
}

// 初始化光源
function initLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, runtimeConfig.reduceQuality ? 0.7 : 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = runtimeConfig.enableShadows;
    scene.add(directionalLight);
    
    if (!runtimeConfig.reduceQuality) {
        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        pointLight.position.set(-100, 100, -100);
        scene.add(pointLight);
    }
}

// 加载模型
function loadModel(modelName) {
    const config = modelConfig[modelName] || modelConfig.aed;
    
    const titleEl = document.getElementById('modelTitle');
    if (titleEl) {
        titleEl.textContent = config.title;
    }
    
    console.log('开始加载模型:', config.paths);
    
    const loader = new THREE.GLTFLoader();
    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    loader.setDRACOLoader(dracoLoader);

    showLoading(true, '正在加载模型资源...');
    startLongLoadHint();

    tryLoadModelPaths(loader, config, 0);
}

function tryLoadModelPaths(loader, config, index) {
    const currentPath = config.paths[index];

    loader.load(
        currentPath,
        function (gltf) {
            if (currentModel) {
                scene.remove(currentModel);
                currentModel = null;
            }

            currentModel = gltf.scene;
            currentModel.position.set(0, 0, 0);
            currentModel.scale.set(config.scale, config.scale, config.scale);

            currentModel.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = runtimeConfig.enableShadows;
                    child.receiveShadow = runtimeConfig.enableShadows;

                    if (child.material) {
                        child.material.metalness = 0.1;
                        child.material.roughness = 0.8;
                        child.material.envMapIntensity = 1.0;
                    }
                }
            });

            if (gltf.animations && gltf.animations.length > 0) {
                console.log('发现动画:', gltf.animations.length, '个');
                mixer = new THREE.AnimationMixer(currentModel);
                animations = gltf.animations;

                animations.forEach(function (clip) {
                    const action = mixer.clipAction(clip);
                    action.setEffectiveTimeScale(0.5);
                    action.play();
                    console.log('播放动画:', clip.name, '速度: 50%');
                });
            } else {
                console.log('该模型没有动画');
                mixer = null;
            }

            scene.add(currentModel);
            fitCameraToModel();
            stopLongLoadHint();
            showLoading(false);
            console.log('模型加载成功:', currentPath);
        },
        function (progress) {
            updateLoadingProgress(progress.loaded, progress.total);
        },
        function (error) {
            console.warn('模型加载失败，尝试下一个路径:', currentPath, error);

            if (index + 1 < config.paths.length) {
                tryLoadModelPaths(loader, config, index + 1);
                return;
            }

            stopLongLoadHint();
            showLoading(false);
            alert('模型加载失败。\n可能原因：手机网络较慢、模型文件较大，或浏览器 WebGL 资源不足。\n已尝试路径: ' + config.paths.join(' , '));
        }
    );
}

// 添加地面
function addGround() {
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x90EE90,
        transparent: true,
        opacity: 0.8
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -10;
    ground.receiveShadow = runtimeConfig.enableShadows;
    scene.add(ground);
}

// 调整相机位置以适应模型
function fitCameraToModel() {
    if (!currentModel) return;
    
    const box = new THREE.Box3().setFromObject(currentModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    
    cameraZ *= 0.6;
    
    camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
}

function updateLoadingProgress(loaded, total) {
    if (total > 0) {
        const percentComplete = Math.min(100, (loaded / total) * 100);
        const loadedMb = (loaded / 1024 / 1024).toFixed(1);
        const totalMb = (total / 1024 / 1024).toFixed(1);
        showLoading(true, `正在加载模型... ${percentComplete.toFixed(0)}% (${loadedMb}/${totalMb} MB)`);
        console.log('加载进度: ' + percentComplete.toFixed(0) + '%');
        return;
    }

    const loadedMb = (loaded / 1024 / 1024).toFixed(1);
    showLoading(true, `正在加载模型... 已下载 ${loadedMb} MB`);
}

function startLongLoadHint() {
    stopLongLoadHint();
    loadingHintTimer = window.setTimeout(function () {
        showLoading(true, '模型较大，手机端首次加载可能需要 10 到 30 秒，请保持页面开启...');
    }, runtimeConfig.longLoadHintMs);
}

function stopLongLoadHint() {
    if (loadingHintTimer) {
        window.clearTimeout(loadingHintTimer);
        loadingHintTimer = null;
    }
}

// 显示/隐藏加载提示
function showLoading(show, message) {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        if (show) {
            if (message) {
                loadingDiv.textContent = message;
            }
            loadingDiv.classList.add('show');
        } else {
            loadingDiv.textContent = '正在加载模型...';
            loadingDiv.classList.remove('show');
        }
    }
}

// 窗口大小调整处理
function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, runtimeConfig.pixelRatioCap));
}

// 动画循环
function animate() {
    requestAnimationFrame(animate);
    
    controls.update();
    
    if (mixer) {
        const delta = clock.getDelta();
        mixer.update(delta);
    }
    
    renderer.render(scene, camera);
}

// 暂停/播放动画
function toggleAnimation() {
    if (mixer) {
        if (mixer.timeScale === 0) {
            mixer.timeScale = 1;
            console.log('恢复动画播放');
        } else {
            mixer.timeScale = 0;
            console.log('暂停动画');
        }
    }
}

// 改变动画速度
function changeSpeed(speed) {
    if (mixer) {
        mixer.timeScale = speed;
        console.log('动画速度设置为:', speed);
    }
}

// 页面加载完成后初始化
window.addEventListener('load', init);
