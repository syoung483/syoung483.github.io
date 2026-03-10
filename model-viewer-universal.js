// 通用模型查看器 - 通过URL参数加载模型
let scene, camera, renderer, controls;
let currentModel;
let mixer;
let animations = [];
let clock;

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

// 初始化
function init() {
    console.log('开始初始化...');
    
    // 获取URL参数
    const urlParams = new URLSearchParams(window.location.search);
    const modelName = urlParams.get('model') || 'aed';
    
    // 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    
    // 创建相机
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
    camera.position.set(200, 100, 200);
    camera.lookAt(0, 0, 0);
    
    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    
    // 添加到DOM
    const container = document.getElementById('threeRef');
    container.appendChild(renderer.domElement);
    
    // 创建控制器
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    // 初始化光源
    initLights();
    
    // 添加地面
    addGround();
    
    // 创建时钟
    clock = new THREE.Clock();
    
    // 加载模型
    loadModel(modelName);
    
    // 开始动画循环
    animate();
    
    // 监听窗口大小变化
    window.addEventListener('resize', onWindowResize, false);
    
    console.log('初始化完成');
}

// 初始化光源
function initLights() {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // 方向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // 点光源
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(-100, 100, -100);
    scene.add(pointLight);
}

// 加载模型
function loadModel(modelName) {
    const config = modelConfig[modelName] || modelConfig['aed'];
    
    // 更新标题
    const titleEl = document.getElementById('modelTitle');
    if (titleEl) {
        titleEl.textContent = config.title;
    }
    
    console.log('开始加载模型:', config.paths);
    
    const loader = new THREE.GLTFLoader();
    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    dracoLoader.preload();
    loader.setDRACOLoader(dracoLoader);

    // 显示加载提示
    showLoading(true);

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
                    child.castShadow = true;
                    child.receiveShadow = true;

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

                animations.forEach((clip) => {
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
            showLoading(false);
            console.log('模型加载成功:', currentPath);
        },
        function (progress) {
            if (progress.total > 0) {
                const percentComplete = (progress.loaded / progress.total) * 100;
                console.log('加载进度: ' + percentComplete + '%');
            }
        },
        function (error) {
            console.warn('模型加载失败，尝试下一个路径:', currentPath, error);

            if (index + 1 < config.paths.length) {
                tryLoadModelPaths(loader, config, index + 1);
                return;
            }

            showLoading(false);
            alert('模型加载失败，请检查文件是否存在\n已尝试路径: ' + config.paths.join(' , '));
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
    ground.receiveShadow = true;
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
    
    cameraZ *= 0.6; // 更拉近一点
    
    camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
}

// 显示/隐藏加载提示
function showLoading(show) {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        if (show) {
            loadingDiv.classList.add('show');
        } else {
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
}

// 动画循环
function animate() {
    requestAnimationFrame(animate);
    
    // 更新控制器
    controls.update();
    
    // 更新动画混合器
    if (mixer) {
        const delta = clock.getDelta();
        mixer.update(delta);
    }
    
    // 渲染场景
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
