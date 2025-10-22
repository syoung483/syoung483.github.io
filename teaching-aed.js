// AED 使用教学：按步骤加载不同 glb 替换场景
let scene, camera, renderer, controls;
let currentModel = null;
let clock;
let mixer = null; // 用于播放 glb 内置动画

function initScene(){
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    const width = window.innerWidth - 380; // 右侧面板约 360 + 间距
    const height = window.innerHeight - 40;
    camera = new THREE.PerspectiveCamera(45, width/height, 1, 3000);
    camera.position.set(200, 120, 220);
    camera.lookAt(0,0,0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;

    document.getElementById('threeRef').appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    initLights();
    addGround();
    clock = new THREE.Clock();
    animate();

    window.addEventListener('resize', onResize);
}

function initLights(){
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(120,120,60);
    dir.castShadow = true;
    scene.add(dir);
}

function addGround(){
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(220,220),
        new THREE.MeshLambertMaterial({ color: 0x90EE90, transparent:true, opacity:.85 })
    );
    ground.rotation.x = -Math.PI/2;
    ground.position.y = -10;
    ground.receiveShadow = true;
    scene.add(ground);
}

function onResize(){
    const width = window.innerWidth - 380;
    const height = window.innerHeight - 40;
    camera.aspect = width/height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function animate(){
    requestAnimationFrame(animate);
    controls.update();
    if (mixer){
        const delta = clock.getDelta();
        mixer.update(delta);
    }
    renderer.render(scene, camera);
}

function showLoading(show){
    const el = document.getElementById('loading');
    if (!el) return;
    el.style.display = show ? 'block' : 'none';
}

// 将中文标题映射到 models 路径
function stepToPathCandidates(step){
    if (typeof step === 'number'){
        switch(step){
            case 1: return ['models/1开机.glb'];
            case 2: return ['models/2贴片.glb'];
            case 3: return ['models/3分析.glb'];
            case 4: return ['models/4放电.glb'];
            case 5: return ['models/5心肺与呼吸.glb', 'models/5心肺 + 呼吸.glb', 'models/5心肺+呼吸.glb'];
            default: return [];
        }
    }
    if (typeof step === 'string'){
        const base = 'models/' + step + '.glb';
        // 同时提供 + 两种形式
        if (base.includes(' + ')){
            return [base, base.replace(' + ', '+')];
        }
        return [base];
    }
    return [];
}

function clearCurrentModel(){
    if (!currentModel) return;
    scene.remove(currentModel);
    currentModel.traverse(child=>{
        if (child.isMesh){
            if (child.geometry) child.geometry.dispose();
            if (child.material){
                if (Array.isArray(child.material)) child.material.forEach(m=>m.dispose());
                else child.material.dispose();
            }
        }
    });
    currentModel = null;
    // 重置动画混合器
    if (mixer){
        mixer.stopAllAction();
        mixer.uncacheRoot(mixer.getRoot());
    }
    mixer = null;
}

function fitCameraTo(obj){
    if (!obj) return;
    const box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI/180);
    let cameraZ = Math.abs(maxDim/2/Math.tan(fov/2));
    cameraZ *= 0.7;
    camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
}

function loadGlb(path){
    showLoading(true);
    const loader = new THREE.GLTFLoader();
    const draco = new THREE.DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    draco.preload();
    loader.setDRACOLoader(draco);

    const url = encodeURI(path).replace(/\+/g, '%2B'); // 处理文件名中的空格和+
    loader.load(url, (gltf)=>{
        clearCurrentModel();
        currentModel = gltf.scene;
        currentModel.position.set(0,0,0);
        currentModel.scale.set(5,5,5);
        currentModel.traverse(child=>{
            if (child.isMesh){
                child.castShadow = true; child.receiveShadow = true;
                if (child.material){
                    child.material.metalness = 0.1;
                    child.material.roughness = 0.8;
                    child.material.envMapIntensity = 1.0;
                }
            }
        });
        scene.add(currentModel);

        // 如果有动画则播放
        if (gltf.animations && gltf.animations.length > 0){
            mixer = new THREE.AnimationMixer(currentModel);
            gltf.animations.forEach((clip)=>{
                const action = mixer.clipAction(clip);
                action.reset();
                action.setEffectiveTimeScale(1.0);
                action.play();
            });
        } else {
            mixer = null;
        }
        fitCameraTo(currentModel);
        showLoading(false);
    }, undefined, (err)=>{
        console.error('加载失败', url, err);
        showLoading(false);
        alert('模型加载失败：'+ path);
    });
}

function tryLoadCandidates(candidates){
    if (!candidates || candidates.length === 0){
        alert('未找到对应模型');
        return;
    }
    const [first, ...rest] = candidates;
    showLoading(true);
    const loader = new THREE.GLTFLoader();
    const draco = new THREE.DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    draco.preload();
    loader.setDRACOLoader(draco);

    const url = encodeURI(first).replace(/\+/g, '%2B');
    loader.load(url, (gltf)=>{
        clearCurrentModel();
        currentModel = gltf.scene;
        currentModel.position.set(0,0,0);
        currentModel.scale.set(5,5,5);
        currentModel.traverse(child=>{
            if (child.isMesh){
                child.castShadow = true; child.receiveShadow = true;
                if (child.material){
                    child.material.metalness = 0.1;
                    child.material.roughness = 0.8;
                    child.material.envMapIntensity = 1.0;
                }
            }
        });
        scene.add(currentModel);
        if (gltf.animations && gltf.animations.length > 0){
            mixer = new THREE.AnimationMixer(currentModel);
            gltf.animations.forEach(clip=>{
                const action = mixer.clipAction(clip);
                action.reset(); action.setEffectiveTimeScale(1.0); action.play();
            });
        } else {
            mixer = null;
        }
        fitCameraTo(currentModel);
        showLoading(false);
    }, undefined, (err)=>{
        console.warn('尝试失败，继续下一个候选:', first, err);
        if (rest.length > 0){
            tryLoadCandidates(rest);
        } else {
            showLoading(false);
            alert('模型加载失败：' + first);
        }
    });
}

// 对外暴露：点击按钮触发
window.playStep = function(step){
    const candidates = stepToPathCandidates(step);
    if (!candidates || candidates.length === 0){ alert('未找到对应模型'); return; }
    // 优先使用多候选逻辑，兼容特殊字符
    tryLoadCandidates(candidates);
}

window.addEventListener('load', ()=>{
    initScene();
    // 默认先加载第 1 步
    playStep(1);
});


