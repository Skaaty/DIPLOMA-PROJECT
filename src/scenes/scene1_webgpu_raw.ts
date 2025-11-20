import { mat4, vec3 } from 'gl-matrix';

import { createStopButton, removeStopButton, createOverlay, removeOverlay } from '../ui/benchmarkControls';
import { createSphereVertices, createConeVertices, createBoxVertices } from '../utils/geometries';
import { exportToCSV } from '../utils/exportToCSV';
import type { FrameStats } from '../utils/exportToCSV';

const WARMUP_TIME = 10_000;
const BENCHMARK_TIME = 30_000;
const OBJECT_NUM = 15_000;
const sampleCount = 4;


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

    const msaaColorTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        sampleCount,
        format: presentationFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        sampleCount,
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
                    arrayStride: 64,
                    stepMode: 'instance',
                    attributes: [
                        { shaderLocation: 1, offset: 0, format: 'float32x4' },
                        { shaderLocation: 2, offset: 16, format: 'float32x4' },
                        { shaderLocation: 3, offset: 32, format: 'float32x4' },
                        { shaderLocation: 4, offset: 48, format: 'float32x4' }
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
        multisample: {
            count: sampleCount,
        },
        primitive: {
            topology: 'triangle-list',
            cullMode: 'none',
        },
        depthStencil: {
            format: 'depth24plus',
            depthWriteEnabled: true,
            depthCompare: 'less'
        }
    });

    const uniformBufferSize = 3 * 16 * 4;
    const uniformBuffer = device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const uniformBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: uniformBuffer
                }
            }
        ]
    });

    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, 75 * Math.PI / 180, canvas.width / canvas.height, 0.1, 200);

    const viewMatrix = mat4.create();
    const eye = vec3.fromValues(0, 17, 25);
    const tgt = vec3.fromValues(0, 0, 7);
    mat4.lookAt(viewMatrix, eye, tgt, vec3.fromValues(0, 1, 0));

    const sceneRot = mat4.create();

    {
        const data = new Float32Array(16 * 3);
        data.set(projectionMatrix, 0);
        data.set(viewMatrix, 16);
        data.set(sceneRot, 32);
        device.queue.writeBuffer(uniformBuffer, 0, data.buffer);
    }

    const userInput = document.getElementById('obj-count') as HTMLInputElement | null;
    const userNum = userInput ? parseInt(userInput.value) : NaN;
    const objNum = isNaN(userNum) ? OBJECT_NUM : userNum;

    const coneM: mat4[] = [];
    const boxM: mat4[] = [];
    const sphereM: mat4[] = [];

    const major = 10;
    const minor = 4;

    for (let i = 0; i < objNum; i++) {
        const u = Math.random() * Math.PI * 2;
        const v = Math.random() * Math.PI * 2;

        const radialOffset = (Math.random() * 2 - 1) * 0.6;
        const effectiveMinorRadius = minor * (1 + radialOffset * 0.5);

        const x = (major + effectiveMinorRadius * Math.cos(v)) * Math.cos(u);
        const y = effectiveMinorRadius * Math.sin(v);
        const z = (major + effectiveMinorRadius * Math.cos(v)) * Math.sin(u);

        const m = mat4.create();
        mat4.fromTranslation(m, vec3.fromValues(x, y, z));

        const r = Math.random();
        if (r < 1 / 3) coneM.push(m);
        else if (r < 2 / 3) boxM.push(m);
        else sphereM.push(m);
    }

    const coneBatch = createInstancedBatch(device, createConeVertices(), coneM);
    const boxBatch = createInstancedBatch(device, createBoxVertices(), boxM);
    const sphereBatch = createInstancedBatch(device, createSphereVertices(), sphereM);
    const batches = [coneBatch, boxBatch, sphereBatch];

    const overlay = createOverlay();
    const frames: FrameStats[] = [];

    let running = true;
    let capturing = false;
    let captureStart = 0;

    let fpsAccum = 0;
    let fpsFrames = 0;
    let currentFPS = 0;

    let lastT = performance.now();
    let lastCPU = 0;
    let lastGPU = 0;

    let querySet: GPUQuerySet | null = null;
    let resolveBuffer: GPUBuffer | null = null;
    let resultBuffer: GPUBuffer | null = null;

    if (hasTimestampQuery) {
        querySet = device.createQuerySet({
            type: 'timestamp',
            count: 2
        });

        resolveBuffer = device.createBuffer({
            size: querySet.count * 8,
            usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
        });

        resultBuffer = device.createBuffer({
            size: resolveBuffer.size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
    }

    createStopButton(() => {
        running = false;
        capturing = false;

        clearTimeout(warmupTimeout);
        clearTimeout(finishTimeout);

        removeOverlay(overlay);
        removeStopButton();
        onComplete();
    });

    const warmupTimeout = window.setTimeout(() => {
        capturing = true;
        captureStart = performance.now();
        console.info('WebGPU benchmark started (capturing Performance Data).');
    }, WARMUP_TIME);

    const finishTimeout = window.setTimeout(() => {
        running = false;
        capturing = false;
        removeOverlay(overlay);
        removeStopButton();
        exportToCSV(frames);
        onComplete();
    }, WARMUP_TIME + BENCHMARK_TIME);

    let rot = 0;

    function render() {
        if (!running) return;

        const now = performance.now();
        const cpuFrameTime = now - lastT;
        lastT = now;
        lastCPU = cpuFrameTime;

        fpsAccum += cpuFrameTime;
        fpsFrames++;
        if (fpsAccum >= 1000) {
            currentFPS = (fpsFrames / fpsAccum) * 1000;
            fpsAccum = 0;
            fpsFrames = 0;
        }

        rot += 0.6 * (cpuFrameTime / 1000);
        mat4.identity(sceneRot);
        mat4.rotateY(sceneRot, sceneRot, rot);

        device.queue.writeBuffer(
            uniformBuffer,
            32 * 4, // offset: 2nd matrix (projection=0..15, view=16..31, sceneRot=32..47)
            new Float32Array(sceneRot).buffer
        );

        const colorTexture = context.getCurrentTexture();
        const colorView = colorTexture.createView();
        const msaaView = msaaColorTexture.createView();
        const depthView = depthTexture.createView();

        const commandEncoder = device.createCommandEncoder();

        const renderPassDesc: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: msaaView,
                    resolveTarget: colorView,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: 'clear',
                    storeOp: 'store'
                }
            ],
            depthStencilAttachment: {
                view: depthView,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        };

        if (querySet) {
            (renderPassDesc as GPURenderPassDescriptor).timestampWrites = {
                querySet: querySet,
                beginningOfPassWriteIndex: 0,
                endOfPassWriteIndex: 1
            };
        }

        const renderPass = commandEncoder.beginRenderPass(renderPassDesc);

        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, uniformBindGroup);

        for (const b of batches) {
            if (b.instanceCount === 0) continue;
            renderPass.setVertexBuffer(0, b.vertexBuffer);
            renderPass.setVertexBuffer(1, b.instanceBuffer);
            renderPass.draw(b.vertexCount, b.instanceCount, 0, 0);
        }

        renderPass.end();

        if (querySet && resolveBuffer && resultBuffer) {
            commandEncoder.resolveQuerySet(querySet, 0, querySet.count, resolveBuffer, 0);

            if (resultBuffer.mapState === 'unmapped') {
                commandEncoder.copyBufferToBuffer(
                    resolveBuffer, 0,
                    resultBuffer, 0,
                    resolveBuffer.size
                );
            }
        }

        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

        if (hasTimestampQuery && resultBuffer && resultBuffer.mapState === "unmapped") {
            resultBuffer.mapAsync(GPUMapMode.READ).then(() => {
                const times = new BigUint64Array(resultBuffer.getMappedRange());
                const start = times[0];
                const end = times[1];

                const deltaNs = end - start;
                lastGPU = Number(deltaNs) / 1e6;

                resultBuffer.unmap();
            }).catch(() => {

            })
        }

        overlay.textContent =
            `FPS: ${currentFPS.toFixed(1)}\n` +
            `CPU: ${lastCPU.toFixed(3)} ms\n` +
            `GPU: ${lastGPU.toFixed(3)} ms\n` +
            `C: ${coneBatch.instanceCount} B: ${boxBatch.instanceCount} S: ${sphereBatch.instanceCount}\n` +
            (capturing ? 'Capturing…' : 'Warming…');

        if (capturing) {
            frames.push({
                time: now - captureStart,
                fps: currentFPS,
                cpu: lastCPU,
                gpu: lastGPU
            });
        }
        requestAnimationFrame(render);
    }
    render();
}