import type Stats from 'stats-gl';
import * as THREE from 'three';
import { MeshNormalNodeMaterial, WebGPURenderer } from 'three/webgpu';

function createMaterial(): MeshNormalNodeMaterial {
    const material = new MeshNormalNodeMaterial();
    return material;
}

function initGeometries(): THREE.BufferGeometry[] {
    const geometries = [
        new THREE.ConeGeometry(0.06, 0.06, 40),
        new THREE.BoxGeometry(0.06, 0.06, 0.06, 2, 2, 1),
        new THREE.SphereGeometry(0.06, 8, 6),
    ];
    return geometries;
}

// function initLights(scene: THREE.Scene): void {
//     const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
//     scene.add(ambientLight);

//     const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
//     directionalLight.position.set(10, 15, 10);
//     directionalLight.castShadow = true;

//     directionalLight.shadow.mapSize.width = 1024;
//     directionalLight.shadow.mapSize.height = 1024;
//     directionalLight.shadow.camera.near = 0.5;
//     directionalLight.shadow.camera.far = 50;
//     directionalLight.shadow.camera.left = -20;
//     directionalLight.shadow.camera.right = 20;
//     directionalLight.shadow.camera.top = 20;
//     directionalLight.shadow.camera.bottom = -20;

//     scene.add(directionalLight);

//     const pointLight = new THREE.PointLight(0xffaa33, 0.8, 100);
//     pointLight.position.set(-8, 8, -8);
//     scene.add(pointLight);
// }


function initMeshes(
    scene: THREE.Scene,
    geometries: THREE.BufferGeometry[],
    objNum: number
): void {
    const material = createMaterial();

    const geometryCount = objNum;
    const vertexCount = geometries.length * 512;
    const indexCount = geometries.length * 1024;
    const boxRadius = 10;

    const batchedMesh = new THREE.BatchedMesh(
        geometryCount,
        vertexCount,
        indexCount,
        material
    );

    const geometryIds: number[] = geometries.map((geo) =>
        batchedMesh.addGeometry(geo)
    );

    for (let i = 0; i < objNum; i++) {
        const geometryId = geometryIds[i % geometries.length];
        const instanceId = batchedMesh.addInstance(geometryId);

        const angle = (i * Math.PI * 2) / objNum;
        const pos = new THREE.Vector3(
            Math.cos(angle) * boxRadius,
            Math.random() * 5.5 + 3,
            Math.sin(angle) * boxRadius
        );

        const matrix = new THREE.Matrix4();
        matrix.makeTranslation(pos.x, pos.y, pos.z);
        batchedMesh.setMatrixAt(instanceId, matrix);
    }

    batchedMesh.frustumCulled = false;
    scene.add(batchedMesh);
}

function setupCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(1, 12, 14);
    camera.lookAt(0, 0, 0);
    return camera;
}

function setupScene() : THREE.Scene {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0d0c18');
    return scene;
}

function setupRenderer(canvas: HTMLCanvasElement, rendererType: string): WebGPURenderer {
    console.info(rendererType, 'selected');

    const selectWebGL = rendererType === 'webgl';

    const renderer = new WebGPURenderer({
        canvas: canvas,
        antialias: true,
        forceWebGL: selectWebGL,
        stencil: false,
        depth: false,
        alpha: true,
    });

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    return renderer;
}

let fps = 0.0;
async function animate(
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: WebGPURenderer,
    time: number,
    benchmarkData: number[],
    stats: Stats, 
): Promise<void> {
    const now = (performance || Date).now();

    if (now >= time + 1000) {
        fps = 10000 / (now - time);
        benchmarkData.push(fps);
    }

    stats.update();

    scene.traverse((obj) => {
        if (obj instanceof THREE.BatchedMesh) {
            obj.rotation.y += fps * 0.00005;
        }
    });

    await renderer.renderAsync(scene, camera);
}

const OBJECT_NUM = 10_000;
//const TIME_DELAY = 6000;
//const TIME_TOTAL = 24000;

export function loadScene1(rendererType: string, stats: Stats, benchmarkData: number[]): void {
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.id = 'my-canvas';
    document.body.appendChild(canvas);

    const scene = setupScene();
    const camera = setupCamera();
    const renderer = setupRenderer(canvas, rendererType);

    const geometries = initGeometries();
    const userInput = document.getElementById('obj-count') as HTMLInputElement | null;
    const userNum = userInput ? parseFloat(userInput.value) : NaN;

    let objNum = OBJECT_NUM;
    if (isNaN(userNum)) {
        console.log('Using default value:', OBJECT_NUM);
    } else {
        objNum = userNum;
    }

    initMeshes(scene, geometries, objNum);

    let shouldRender = false;
    //let delay = rendererType === 'webgl' ? TIME_DELAY : TIME_DELAY / 3;

    setTimeout(() => {
        console.info('benchmark started');

        shouldRender = true;

        renderer.renderAsync(scene, camera);

        const time = (performance || Date).now();
        renderer.setAnimationLoop(() => {
            if (shouldRender) {
                animate(scene, camera, renderer, time, benchmarkData, stats)
            }
        })
    })
}