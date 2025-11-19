import { mat4, vec3 } from 'gl-matrix';

import { createStopButton, removeStopButton, createOverlay } from '../ui/benchmarkControls';

const WARMUP_TIME = 10_000;
const BENCHMARK_TIME = 30_000;
const DEFAULT_OBJECT_NUM = 15_000;

function createSphereVertices(segments = 10): number[] {
    const verts: number[] = [];
    for (let lat = 0; lat < segments; lat++) {
        for (let lon = 0; lon < segments; lon++) {
            const a = (lat / segments) * Math.PI;
            const b = ((lat + 1) / segments) * Math.PI;
            const c = (lon / segments) * Math.PI * 2;
            const d = ((lon + 1) / segments) * Math.PI * 2;

            const p1 = [Math.sin(a) * Math.cos(c), Math.cos(a), Math.sin(a) * Math.sin(c)];
            const p2 = [Math.sin(b) * Math.cos(c), Math.cos(b), Math.sin(b) * Math.sin(c)];
            const p3 = [Math.sin(b) * Math.cos(d), Math.cos(b), Math.sin(b) * Math.sin(d)];
            const p4 = [Math.sin(a) * Math.cos(d), Math.cos(a), Math.sin(a) * Math.sin(d)];

            verts.push(...p1, ...p2, ...p3);
            verts.push(...p1, ...p3, ...p4);
        }
    }

    for (let i = 0; i < verts.length; i++) verts[i] *= 0.1;

    return verts;
}

function createConeVertices(segments = 20): number[] {
    const verts: number[] = [];
    for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const b = ((i + 1) / segments) * Math.PI * 2;

        verts.push(
            0, 0.15, 0,
            0.1 * Math.cos(a), -0.15, 0.1 * Math.sin(a),
            0.1 * Math.cos(b), -0.15, 0.1 * Math.sin(b),
        );
    }
    return verts;
}

function createBoxVertices(): number[] {
    return [
        // front
        -0.1, -0.1, 0.1,
        0.1, -0.1, 0.1,
        0.1, 0.1, 0.1,
        -0.1, -0.1, 0.1,
        0.1, 0.1, 0.1,
        -0.1, 0.1, 0.1,

        // back
        -0.1, -0.1, -0.1,
        0.1, 0.1, -0.1,
        0.1, -0.1, -0.1,
        -0.1, -0.1, -0.1,
        -0.1, 0.1, -0.1,
        0.1, 0.1, -0.1,

        // left
        -0.1, -0.1, -0.1,
        -0.1, -0.1, 0.1,
        -0.1, 0.1, 0.1,
        -0.1, -0.1, -0.1,
        -0.1, 0.1, 0.1,
        -0.1, 0.1, -0.1,

        // right
        0.1, -0.1, -0.1,
        0.1, 0.1, 0.1,
        0.1, -0.1, 0.1,
        0.1, -0.1, -0.1,
        0.1, 0.1, -0.1,
        0.1, 0.1, 0.1,

        // top
        -0.1, 0.1, 0.1,
        0.1, 0.1, 0.1,
        0.1, 0.1, -0.1,
        -0.1, 0.1, 0.1,
        0.1, 0.1, -0.1,
        -0.1, 0.1, -0.1,

        // bottom
        -0.1, -0.1, 0.1,
        0.1, -0.1, -0.1,
        0.1, -0.1, 0.1,
        -0.1, -0.1, 0.1,
        -0.1, -0.1, -0.1,
        0.1, -0.1, -0.1,
    ];
}

const wgslShader = `
    struct Uniforms {
        projection : mat4x4<f32>,
        view       : mat4x4<f32>,
        sceneRot   : mat4x4<f32>,
    };

    @group(0) @binding(0)
    var<uniform> u : Uniforms;

    struct VSInput {
        @location(0) position : vec3<f32>,
        @location(1) m0 : vec4<f32>,
        @location(2) m1 : vec4<f32>,
        @location(3) m2 : vec4<f32>,
        @location(4) m3 : vec4<f32>,
    };

    struct VSOutput {
        @builtin(position) Position : vec4<f32>,
        @location(0) normal : vec3<f32>,
    };

    @vertex
    fn vs_main(input : VSInput) -> VSOutput {
        var out : VSOutput;
        let model = mat4x4<f32>(input.m0, input.m1, input.m2, input.m3);
        let worldPos = u.sceneRot * model * vec4<f32>(input.position, 1.0);
        out.normal = normalize(input.position);
        out.Position = u.projection * u.view * worldPos;
        return out;
    }

    @fragment
    fn fs_main(input : VSOutput) -> @location(0) vec4<f32> {
        return vec4<f32>(abs(input.normal), 1.0);
    }
`;

type InstancedBatch = {
    vertexBuffer: GPUBuffer;
    instanceBuffer: GPUBuffer;
    vertexCount: number;
    instanceCount: number;
}

function createInstancedBatch(
    device: GPUDevice,
    vertices: number[],
    matrices: mat4[]
): InstancedBatch {
    const vertexData = new Float32Array(vertices);
    const vertexBuffer = device.createBuffer({
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    });

    new Float32Array(vertexBuffer.getMappedRange()).set(vertexData);
    vertexBuffer.unmap();

    const matData = new Float32Array(matrices.length * 16);
    for (let i = 0; i < matrices.length; i++) {
        matData.set(matrices[i], i * 16);
    }

    const instanceBuffer = device.createBuffer({
        size: matData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });
    new Float32Array(instanceBuffer.getMappedRange()).set(matData);
    instanceBuffer.unmap();

    return {
        vertexBuffer,
        instanceBuffer,
        vertexCount: vertices.length / 3,
        instanceCount: matrices.length
    };
}

export async function init1SceneWebGPUInstancedRaw(onComplete: () => void) {
    const oldCanvas = document.getElementById('my-canvas');

    if (oldCanvas && oldCanvas.parentNode) {
        oldCanvas.parentNode.removeChild(oldCanvas);
    }

    if (!navigator.gpu) {
        console.warn('WebGPU not supported.');
        onComplete();
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.id = 'my-canvas';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error('Faile to get GPU adapter');
        onComplete();
        return;
    }

    const requiredFeatures: GPUFeatureName[] = [];
    const hasTimestampQuery = adapter.features.has('timestamp-query');
    if (hasTimestampQuery) {
        requiredFeatures.push('timestamp-query');
    }

    const device = await adapter.requestDevice({
        requiredFeatures
    });

    const context = canvas.getContext('webgpu') as GPUCanvasContext;
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();


    context.configure({
        device,
        format: presentationFormat,
        alphaMode: 'opaque'
    });

    let depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });

    const shaderModule = device.createShaderModule({ code: wgslShader });

    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: [
                {
                    arrayStride: 3 * 4,
                    stepMode: 'vertex',
                    attributes: [
                        {
                            shaderLocation: 0,
                            offset: 0,
                            format: 'float32x3'
                        }
                    ]
                },
                {
                    arrayStride: 16 * 4,
                    stepMode: 'instance',
                    attributes: [
                        { shaderLocation: 1, offset: 0 * 16, format: 'float32x4' },
                        { shaderLocation: 2, offset: 4 * 4, format: 'float32x4' },
                        { shaderLocation: 3, offset: 8 * 4, format: 'float32x4' },
                        { shaderLocation: 4, offset: 12 * 4, format: 'float32x4' }
                    ]
                }
            ]
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [
                {
                    format: presentationFormat
                }
            ]
        },
        primitive: {
            topology: 'triangle-list',
            cullMode: 'back',
        },
        depthStencil: {
            format: 'depth24plus',
            depthWriteEnabled: true,
            depthCompare: 'less'
        }
    });

    
}