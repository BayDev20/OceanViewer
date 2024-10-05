let scene, camera, renderer, water, sun, sky, controls, starfield;
const moveSpeed = 1;
const keys = { w: false, a: false, s: false, d: false, q: false, e: false };

function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (key in keys) {
        keys[key] = true;
    }
}

function onKeyUp(event) {
    const key = event.key.toLowerCase();
    if (key in keys) {
        keys[key] = false;
    }
}

function init() {
    try {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 20000);
        camera.position.set(0, 100, 1000);
        camera.lookAt(new THREE.Vector3(0, 0, -1000));

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        // OrbitControls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.maxPolarAngle = Math.PI;
        controls.minDistance = 0;
        controls.maxDistance = Infinity;
        controls.enablePan = true;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.update();

        controls.isReady = true;

        // Sun
        sun = new THREE.Vector3();

        // Sky
        if (typeof THREE.Sky === 'undefined') {
            console.error('THREE.Sky is not defined. Make sure the Sky.js file is loaded correctly.');
            scene.background = new THREE.Color(0x87CEEB);
        } else {
            sky = new THREE.Sky();
            sky.scale.setScalar(10000);
            scene.add(sky);

            const skyUniforms = sky.material.uniforms;
            skyUniforms['turbidity'].value = 10;
            skyUniforms['rayleigh'].value = 2;
            skyUniforms['mieCoefficient'].value = 0.005;
            skyUniforms['mieDirectionalG'].value = 0.8;
        }

        // Water
        if (typeof THREE.Water === 'undefined') {
            console.error('THREE.Water is not defined. Make sure the Water.js file is loaded correctly.');
            const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
            const waterMaterial = new THREE.MeshBasicMaterial({ color: 0x0077be });
            water = new THREE.Mesh(waterGeometry, waterMaterial);
            water.rotation.x = -Math.PI / 2;
            scene.add(water);
        } else {
            const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
            water = new THREE.Water(
                waterGeometry,
                {
                    textureWidth: 512,
                    textureHeight: 512,
                    waterNormals: new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/waternormals.jpg', function(texture) {
                        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                    }),
                    sunDirection: new THREE.Vector3(),
                    sunColor: 0xffffff,
                    waterColor: 0x001e0f,
                    distortionScale: 3.7,
                    fog: false
                }
            );
            water.rotation.x = -Math.PI / 2;
            water.position.y = -10;
            scene.add(water);
        }

        scene.background = new THREE.Color(0x87CEEB);

        // Lights
        const ambientLight = new THREE.AmbientLight(0x404040);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);

        window.addEventListener('resize', onWindowResize);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        document.getElementById('sunPosition').addEventListener('input', updateSun);

        console.log('Initialization complete');

        createStarfield();

        updateSun();
        animate();
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

function createStarfield() {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const size = 15000;

    for (let i = 0; i < 10000; i++) {
        const x = (Math.random() - 0.5) * size;
        const y = Math.random() * size * 0.5; // Concentrate stars above horizon
        const z = (Math.random() - 0.5) * size;
        vertices.push(x, y, z);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    const material = new THREE.PointsMaterial({
        size: 2,
        sizeAttenuation: true,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false
    });

    starfield = new THREE.Points(geometry, material);
    scene.add(starfield);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateSun() {
    const sunPosition = document.getElementById('sunPosition').value;
    const theta = (Math.PI * (sunPosition / 100 - 0.5));
    
    const phi = Math.PI * 0.25;
    sun.setFromSphericalCoords(1000, Math.PI / 2 - theta, phi);

    if (sky && sky.material) {
        sky.material.uniforms['sunPosition'].value.copy(sun);
    }
    if (water && water.material && water.material.uniforms) {
        water.material.uniforms['sunDirection'].value.copy(sun).normalize();
    }

    updateSceneBasedOnSunPosition(theta);
}

function updateSceneBasedOnSunPosition(theta) {
    const normalizedTheta = (Math.sin(theta) + 1) * 0.5;
    const skyBrightness = THREE.MathUtils.smoothstep(normalizedTheta, 0.1, 0.9);

    if (sky && sky.material) {
        const skyUniforms = sky.material.uniforms;
        skyUniforms['turbidity'].value = THREE.MathUtils.lerp(1, 20, normalizedTheta);
        skyUniforms['rayleigh'].value = THREE.MathUtils.lerp(0.5, 4, 1 - Math.abs(normalizedTheta - 0.5) * 2);
        skyUniforms['mieCoefficient'].value = THREE.MathUtils.lerp(0.005, 0.03, 1 - Math.abs(normalizedTheta - 0.5) * 2);
        skyUniforms['mieDirectionalG'].value = THREE.MathUtils.lerp(0.7, 0.98, 1 - Math.abs(normalizedTheta - 0.5) * 2);
    }

    const sunsetProgress = 1 - Math.abs(normalizedTheta - 0.5) * 2;
    const skyHue = THREE.MathUtils.lerp(0.55, 0.05, sunsetProgress);
    const skySaturation = THREE.MathUtils.lerp(0.2, 0.8, sunsetProgress);
    const skyLightness = THREE.MathUtils.lerp(0.2, 0.5, normalizedTheta);
    scene.background.setHSL(skyHue, skySaturation, skyLightness);

    // Update starfield visibility
    if (starfield) {
        starfield.material.opacity = THREE.MathUtils.lerp(0.8, 0, skyBrightness);
    }

    updateLighting(normalizedTheta, skyBrightness, sunsetProgress);
}

function animate() {
    requestAnimationFrame(animate);
    updateCamera();
    if (water && water.material && water.material.uniforms) {
        water.material.uniforms['time'].value += 1.0 / 60.0;
    }
    if (controls && controls.isReady) {
        controls.update();
    }
    renderer.render(scene, camera);
}

function updateLighting(normalizedTheta, skyBrightness, sunsetProgress) {
    scene.remove(scene.getObjectByName('ambientLight'));
    scene.remove(scene.getObjectByName('directionalLight'));

    // Ambient light
    const ambientIntensity = THREE.MathUtils.lerp(0.05, 0.3, skyBrightness);
    const ambientColor = new THREE.Color().setHSL(THREE.MathUtils.lerp(0.6, 0.05, sunsetProgress), 0.5, 0.5);
    const ambientLight = new THREE.AmbientLight(ambientColor, ambientIntensity);
    ambientLight.name = 'ambientLight';
    scene.add(ambientLight);

    // Directional light (sun)
    const directionalIntensity = THREE.MathUtils.lerp(0.1, 1.5, skyBrightness);
    const directionalColor = new THREE.Color().setHSL(THREE.MathUtils.lerp(0.1, 0.05, sunsetProgress), 1, 0.95);
    const directionalLight = new THREE.DirectionalLight(directionalColor, directionalIntensity);
    directionalLight.position.copy(sun);
    directionalLight.name = 'directionalLight';
    scene.add(directionalLight);

    // Update water color based on time of day
    if (water && water.material && water.material.uniforms) {
        const waterHue = THREE.MathUtils.lerp(0.6, 0.05, sunsetProgress);
        const waterSaturation = THREE.MathUtils.lerp(0.5, 0.8, sunsetProgress);
        const waterLightness = THREE.MathUtils.lerp(0.2, 0.6, skyBrightness);
        const waterColor = new THREE.Color().setHSL(waterHue, waterSaturation, waterLightness);
        water.material.uniforms['waterColor'].value.copy(waterColor);
    }

    // Update skybox color
    const skybox = scene.getObjectByName('skybox');
    if (skybox) {
        const skyboxColor = new THREE.Color().setHSL(THREE.MathUtils.lerp(0.67, 0.6, normalizedTheta), 0.5, skyBrightness);
        skybox.material.color.copy(skyboxColor);
    }
}

function updateCamera() {
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    camera.getWorldDirection(forward);
    right.crossVectors(up, forward).normalize();

    if (keys.w) camera.position.addScaledVector(forward, moveSpeed);
    if (keys.s) camera.position.addScaledVector(forward, -moveSpeed);
    if (keys.a) camera.position.addScaledVector(right, -moveSpeed);
    if (keys.d) camera.position.addScaledVector(right, moveSpeed);
    if (keys.q) camera.position.addScaledVector(up, -moveSpeed);
    if (keys.e) camera.position.addScaledVector(up, moveSpeed);

    if (controls && controls.isReady) {
        controls.target.copy(camera.position).addScaledVector(forward, 1);
    }
}

init(); // Call init() to start everything