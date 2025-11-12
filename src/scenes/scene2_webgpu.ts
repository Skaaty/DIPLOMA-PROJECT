import * as THREE from 'three';
import type Stats from 'stats-gl';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { ssr } from "three/addons/tsl/display/SSRNode.js";
import { smaa } from "three/addons/tsl/display/SMAANode.js";
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { blendColor, metalness, pass, reflector, mrt, output, emissive, normalView, pmremTexture } from 'three/tsl';
import { WebGPURenderer, PostProcessing, } from 'three/webgpu';

import { exportToCSV, updateFrameStats } from '../utils/exportToCSV';
import hdrPath from '../assets/textures/bloem_olive_house_8k.hdr';
import modelPath from '../assets/models/IridescenceSuzanne.glb';
import { createStopButton, removeStopButton, setupCanvas } from '../ui/benchmarkControls';

let scene: THREE.Scene;
let camera: THREE.Camera;
let renderer: WebGPURenderer;
let light: THREE.DirectionalLight;
let pointLight1: THREE.PointLight;
let pointLight2: THREE.PointLight;
let model: THREE.Group | null = null;

const WARMUP_TIME = 5_000;
const BENCHMARK_TIME = 10_000;
const USE_POSTPROCESSING = true;

export async function initScene2Webgpu(stats: Stats, onComplete: () => void): Promise<void> {
    const canvas = setupCanvas();

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200)
    const orbitRadius = 6;
    let orbitAngle = 0;

    if (!navigator.gpu) {
        console.warn('WebGPU not supported.');
    }

    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) {
        throw new Error('Failed to get WebGPU context');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error('WebGPU adapter not available.');
    }

    const device = await adapter.requestDevice();
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device,
        format,
        alphaMode: 'opaque',
    });

    renderer = new WebGPURenderer({
        canvas,
        antialias: false,
        stencil: false,
        depth: true,
        alpha: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(window.devicePixelRatio * 2.0);
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(renderer.domElement);

    await renderer.init();

    await stats.init(renderer);

    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
        modelPath,
        (gltf) => {
            model = gltf.scene;
            model.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                }
            });

            model.scale.set(1.0, 1.0, 1.0);
            scene.add(model);
        },
        undefined,
        (err) => console.error('An error occurred while loading the glTF model', err)
    );

    const hdrLoader = new HDRLoader();
    //const pmrem = new THREE.PMREMGenerator(renderer);
    const hdrTexture = await hdrLoader.loadAsync(hdrPath);
    hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
    hdrTexture.colorSpace = THREE.LinearSRGBColorSpace;
    const pmremNode = pmremTexture(hdrTexture);
    scene.environmentNode = pmremNode;
    scene.backgroundNode = pmremNode;
    scene.environmentIntensity = 2.0;

    light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(10, 20, 10);
    light.castShadow = true;
    light.shadow.mapSize.set(4096, 4096);
    scene.add(light);

    pointLight1 = new THREE.PointLight(0xff8888, 30, 50);
    pointLight1.position.set(-10, 5, 5);
    pointLight1.castShadow = true;
    pointLight1.shadow.mapSize.set(2048, 2048); // 2K shadows
    scene.add(pointLight1);

    pointLight2 = new THREE.PointLight(0x8888ff, 30, 50);
    pointLight2.position.set(10, 5, -5);
    pointLight2.castShadow = true;
    pointLight2.shadow.mapSize.set(2048, 2048); // 2K shadows
    scene.add(pointLight2);

    scene.add(new THREE.AmbientLight(0x404040, 2.0));

    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x777777,
        metalness: 1.0,
        roughness: 0,
        envMap: hdrTexture,
    });
    const groundReflector = reflector({
        resolutionScale: 1,
        samples: 1,
        depth: true,
    });
    groundMaterial.colorNode = groundReflector;

    const ground = new THREE.Mesh(groundGeo, groundMaterial);
    ground.rotation.x = (-Math.PI / 2);
    ground.position.y = -3.0;

    ground.add(groundReflector.target);
    scene.add(ground);

    let postProcessing: PostProcessing;

    if (USE_POSTPROCESSING) {
        postProcessing = new PostProcessing(renderer);
        const scenePass = pass(scene, camera, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
        });

        scenePass.setMRT(
            mrt({
                output: output,
                normal: normalView,
                metalness: metalness,
                emissive: emissive,
            })
        )
        const scenePassColor = scenePass.getTextureNode('output');
        const scenePassNormal = scenePass.getTextureNode("normal");
        const scenePassDepth = scenePass.getTextureNode("depth");
        const scenePassMetalness = scenePass.getTextureNode("metalness");
        //const scenePassEmissive = scenePass.getTextureNode("emissive");
        const bloomPass1 = bloom(scenePassColor, 0.1, 0.1, 0.2);
        const bloomPass2 = bloom(scenePassColor, 0.1, 0.1, 0.2);

        const ssrPass = ssr(
            scenePassColor,
            scenePassDepth,
            scenePassNormal,
            scenePassMetalness,
            null,
            camera
        );
        ssrPass.resolutionScale = 1;
        ssrPass.maxDistance.value = 1;
        ssrPass.opacity.value = 1;
        ssrPass.thickness.value = 0.015;

        let outputNode = smaa(blendColor(scenePassColor.add(bloomPass1), ssrPass));
        outputNode = smaa(blendColor(scenePassColor.add(bloomPass2), ssrPass));
        postProcessing.outputNode = outputNode;

    }

    const clock = new THREE.Clock();
    const lastLogCount = 0;
    let capturing = false;
    let startTime = 0;
    let stoppedManually = false;

    async function stopBenchmark() {
        stoppedManually = true;
        capturing = false;
        console.info('Benchmark stopped manually.');

        await renderer.setAnimationLoop(null);
        removeStopButton();
        onComplete();
    }

    console.info('Warming up for 5 seconds.');
    createStopButton(stopBenchmark);

    const frameData: {
        time: number,
        fps: number,
        cpu: number,
        gpu: number,
    }[] = [];

    setTimeout(() => {
        capturing = true;
        startTime = performance.now();
        console.info('Benchmark started (capturing Performance Data.');
    }, WARMUP_TIME);

    setTimeout(async () => {
        if (stoppedManually) return;
        capturing = false;
        console.info('Benchmark finished.');

        await renderer.setAnimationLoop(null);
        removeStopButton();

        exportToCSV(frameData);

        onComplete();
    }, WARMUP_TIME + BENCHMARK_TIME);

    await renderer.setAnimationLoop(async () => {
        const delta = clock.getDelta();
        stats.begin();

        orbitAngle += delta * 0.4;
        const x = Math.sin(orbitAngle) * orbitRadius;
        const z = Math.cos(orbitAngle) * orbitRadius;
        camera.position.set(x, 1.5, z);
        camera.lookAt(0, 0.5, 0);

        light.position.set(Math.sin(orbitAngle) * 20, 20, Math.cos(orbitAngle) * 20);


        if (postProcessing) {
            postProcessing.render();
        } else {
            await renderer.render(scene, camera);
        }


        if (renderer instanceof WebGPURenderer) {
            await renderer.resolveTimestampsAsync(THREE.TimestampQuery.RENDER);
        }

        stats.end();
        stats.update();

        updateFrameStats(capturing, stats, lastLogCount, startTime, frameData);
    });
}

