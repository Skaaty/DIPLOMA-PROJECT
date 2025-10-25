import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';

const OBJECT_NUM = 10_000;
const TIME_DELAY = 6000;
const TIME_TOTAL = 24000;

function createMaterial(): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
        color: 0x049ef4,
        roughness: 0.5,
        metalness: 0.5,
        envMapIntensity: 1.0
    });
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

function initLights(scene: THREE.Scene): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;

    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;

    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xffaa33, 0.8, 100);
    pointLight.position.set(-8, 8, -8);
    scene.add(pointLight);
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
    const boxRadius = 15;

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