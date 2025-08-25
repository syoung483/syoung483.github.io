// 全局变量
let scene, camera, renderer, controls;
let aedModel;
let mixer;
let animations = [];
let clock;

// 初始化
function init() {
    console.log('开始初始化...');
    
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
    
    // 加载模型
    initModel();
    
    // 添加地面
    addGround();
    
    // 创建时钟
    clock = new THREE.Clock();
    
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

// 初始化模型
function initModel() {
    console.log('开始加载AED模型...');
    
    const loader = new THREE.GLTFLoader();
    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    dracoLoader.preload();
    loader.setDRACOLoader(dracoLoader);

    // 显示加载提示
    showLoading(true);

    // 加载AED模型
    loader.load(
        'models/aed.glb',
        function (gltf) {
            aedModel = gltf.scene;
            
            // 设置模型位置和缩放
            aedModel.position.set(0, 0, 0);
            aedModel.scale.set(5, 5, 5); // 放大5倍
            
            // 启用阴影
            aedModel.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    // 设置材质属性
                    if (child.material) {
                        child.material.metalness = 0.1;
                        child.material.roughness = 0.8;
                        child.material.envMapIntensity = 1.0;
                    }
                }
            });
            
            // 检查并设置动画
            if (gltf.animations && gltf.animations.length > 0) {
                console.log('发现动画:', gltf.animations.length, '个');
                mixer = new THREE.AnimationMixer(aedModel);
                animations = gltf.animations;
                
                // 播放所有动画（降低速度）
                animations.forEach((clip, index) => {
                    const action = mixer.clipAction(clip);
                    action.setEffectiveTimeScale(0.5); // 降低动画速度到50%
                    action.play();
                    console.log('播放动画:', clip.name, '速度: 50%');
                });
            } else {
                console.log('该模型没有动画');
            }
            
            // 将模型添加到场景
            scene.add(aedModel);
            
            // 调整相机位置以适应模型
            fitCameraToModel();
            
            // 隐藏加载提示
            showLoading(false);
            
            console.log('AED模型加载成功！');
        },
        function (progress) {
            // 加载进度
            const percentComplete = (progress.loaded / progress.total) * 100;
            console.log('加载进度: ' + percentComplete + '%');
        },
        function (error) {
            console.error('加载AED模型时出错:', error);
            console.error('尝试加载的路径:', './models/aed.glb');
            showLoading(false);
            alert('模型加载失败，请检查文件路径是否正确\n错误信息: ' + error.message);
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
    if (!aedModel) return;
    
    const box = new THREE.Box3().setFromObject(aedModel);
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
