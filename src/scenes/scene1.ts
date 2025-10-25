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
    ) as THREE.Object3D & {
        addGeometry: (geometry: THREE.BufferGeometry) => number;
        addInstance: (geometryId: number) => number;
        setMatrixAt: (instanceId: number, matrix: THREE.Matrix4) => void;
    };

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

        const matrix = new THREE.Matrix4().makeTranslation(pos.x, pos.y, pos.z);
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

function setupScene(): THREE.Scene {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0d0c18');
    return scene;
}

function setupRenderer(canvas: HTMLCanvasElement, rendererType: string): WebGPURenderer {
    console.info(`${rendererType} selected`);
    const isWebGL = rendererType === 'webgl';

    const renderer = new WebGPURenderer({
        canvas,
        antialias: true,
        forceWebGL: isWebGL,
        stencil: false,
        depth: false,
        alpha: true,
    });

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    return renderer;
}

//const clock = new THREE.Clock();

// async function animate(
//     scene: THREE.Scene,
//     camera: THREE.Camera,
//     renderer: WebGPURenderer,
//     benchmarkData: number[],
//     stats: Stats, 
// ): Promise<void> {
//     renderer.clearAsync();
//     //const now = (performance || Date).now();

//     // if (now >= time + 1000) {
//     //     fps = 10000 / (now - time);
//     //     benchmarkData.push(fps);
//     // }
//     const delta = clock.getDelta();

//     stats.begin();

//     // scene.traverse((obj) => {
//     //     if (obj instanceof THREE.BatchedMesh) {
//     //         obj.rotation.y += fps * 0.00005;
//     //     }
//     // });

//     scene.traverse( obj => {
//         if (obj instanceof THREE.BatchedMesh) {
//             obj.rotation.y += delta * 0.5;
//         }
//     });

//     await renderer.renderAsync(scene, camera);

//     stats.end();
//     stats.update();

//     const fps = 1 / delta;
//     benchmarkData.push(fps);
// }

const OBJECT_NUM = 10_000;
const WARMUP_TIME = 5_000;
const BENCHMARK_TIME = 30_000;

export function loadScene1(
    rendererType: string,
    stats: Stats,
    benchmarkData: number[],
    onComplete: () => void
): void {
    const canvas = document.createElement('canvas');
    canvas.id = 'my-canvas';
    document.body.appendChild(canvas);

    const scene = setupScene();
    const camera = setupCamera();
    const renderer = setupRenderer(canvas, rendererType);
    const geometries = initGeometries();
    const userInput = document.getElementById('obj-count') as HTMLInputElement | null;
    const userNum = userInput ? parseFloat(userInput.value) : NaN;
    const objNum = isNaN(userNum) ? OBJECT_NUM : userNum;

    initMeshes(scene, geometries, objNum);

    const clock = new THREE.Clock();
    let capturing = false;
    let startTime = 0;

    console.info('Warming up for 5 seconds.');
    setTimeout(() => {
        capturing = true;
        startTime = performance.now();
        console.info('Benchmark started (Capturing Performance Data)')
    }, WARMUP_TIME);

    setTimeout(() => {
        capturing = false;
        console.info('Benchmark finished.');

        renderer.setAnimationLoop(null);
        scene.clear();
        renderer.dispose();

        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);

        onComplete();
    }, WARMUP_TIME + BENCHMARK_TIME);

    renderer.setAnimationLoop(() => {
        const delta = clock.getDelta();

        stats.begin();

        scene.traverse((object) => {
            if (object instanceof THREE.BatchedMesh) {
                object.rotation.y += delta * 0.5;
            }
        });

        renderer.render(scene, camera);

        stats.end();
        stats.update();

        if (capturing) {
            const fps = 1 / delta;
            benchmarkData.push(fps);
        }
    });
}