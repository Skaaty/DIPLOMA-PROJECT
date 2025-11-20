import { mat4, vec3 } from 'gl-matrix';

import { createStopButton, removeStopButton, createOverlay } from '../ui/benchmarkControls';
import { createSphereVertices, createConeVertices, createBoxVertices } from '../utils/geometries';
import { exportToCSV } from '../utils/exportToCSV';
import type { FrameStats } from '../utils/exportToCSV';

let gl: WebGL2RenderingContext;
let program: WebGLProgram;

let uProjectionLoc: WebGLUniformLocation;
let uViewLoc: WebGLUniformLocation;
let uSceneRotLoc: WebGLUniformLocation;
let projectionMatrix: mat4;
let viewMatrix: mat4;

const WARMUP_TIME = 10_000;
const BENCHMARK_TIME = 30_000;
const OBJECT_NUM = 15_000;


const vs = `#version 300 es
    in vec3 position;
    in mat4 instanceModel;

    uniform mat4 uProjection;
    uniform mat4 uView;
    uniform mat4 uSceneRot;

    out vec3 vNormal;

    void main() {
        vec4 worldPos = uSceneRot * instanceModel * vec4(position, 1.0);
        vNormal = normalize(position);
        gl_Position = uProjection * uView * worldPos;
}`;

const fs = `#version 300 es
    precision highp float;

    in vec3 vNormal;
    out vec4 outColor;

    void main() {
        outColor = vec4(abs(vNormal), 1.0);
}`;

function compileShader(type: number, src: string): WebGLShader {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);

    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) || 'Shader compile error');
    }
    return sh;
}

function makeProgram(): WebGLProgram {
    const p = gl.createProgram()!;
    gl.attachShader(p, compileShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);

    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(p) || 'Program link error');
    }
    return p;
}

type InstancedBatch = {
    vao: WebGLVertexArrayObject;
    vertexCount: number;
    instanceCount: number;
};

function createInstancedBatch(vertices: number[], matrices: mat4[]): InstancedBatch {
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const vertArray = new Float32Array(vertices);
    gl.bufferData(gl.ARRAY_BUFFER, vertArray, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

    const matData = new Float32Array(matrices.length * 16);

    for (let i = 0; i < matrices.length; i++) {
        matData.set(matrices[i], i * 16);
    }

    const matVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, matVBO);
    gl.bufferData(gl.ARRAY_BUFFER, matData, gl.STATIC_DRAW);

    const baseLoc = gl.getAttribLocation(program, 'instanceModel');

    for (let i = 0; i < 4; i++) {
        const loc = baseLoc + i;
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(
            loc,
            4,
            gl.FLOAT,
            false,
            64,
            i * 16
        );
        gl.vertexAttribDivisor(loc, 1);
    }

    gl.bindVertexArray(null);

    return {
        vao,
        vertexCount: vertices.length / 3,
        instanceCount: matrices.length,
    };
}


export async function init1SceneWebGLInstancedRaw(onComplete: () => void) {
    const oldCanvas = document.getElementById('my-canvas');

    if (oldCanvas && oldCanvas.parentNode) {
        oldCanvas.parentNode.removeChild(oldCanvas);
    }

    const canvas = document.createElement('canvas');
    canvas.id = 'my-canvas';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    gl = canvas.getContext('webgl2', {
        antialias: true,
        alpha: true,
        depth: true,
        stencil: false,
        powerPreference: 'high-performance'
    }) as WebGL2RenderingContext;

    gl.enable(gl.DEPTH_TEST);

    program = makeProgram();
    gl.useProgram(program);

    uProjectionLoc = gl.getUniformLocation(program, 'uProjection')!;
    uViewLoc = gl.getUniformLocation(program, 'uView')!;
    uSceneRotLoc = gl.getUniformLocation(program, 'uSceneRot')!;

    projectionMatrix = mat4.create();
    mat4.perspective(
        projectionMatrix,
        75 * Math.PI / 180,
        canvas.width / canvas.height,
        0.1,
        200
    );
    gl.uniformMatrix4fv(uProjectionLoc, false, projectionMatrix);

    viewMatrix = mat4.create();
    const eye = vec3.fromValues(0, 17, 25);
    const tgt = vec3.fromValues(0, 0, 7);
    mat4.lookAt(viewMatrix, eye, tgt, vec3.fromValues(0, 1, 0));
    gl.uniformMatrix4fv(uViewLoc, false, viewMatrix);

    const input = document.getElementById("obj-count") as HTMLInputElement | null;
    const userNum = input ? parseInt(input.value) : NaN;
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

    const coneBatch = createInstancedBatch(createConeVertices(), coneM);
    const boxBatch = createInstancedBatch(createBoxVertices(), boxM);
    const sphereBatch = createInstancedBatch(createSphereVertices(), sphereM);
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

    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as any;
    type GPUQuery = { q: WebGLQuery, t: number };
    const gpuQueue: GPUQuery[] = [];

    function processGPU() {
        if (!ext) return;
        while (gpuQueue.length) {
            const info = gpuQueue[0];
            const available = gl.getQueryParameter(info.q, gl.QUERY_RESULT_AVAILABLE);
            if (!available) break;

            gpuQueue.shift();

            const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
            if (!disjoint) {
                const ns = gl.getQueryParameter(info.q, gl.QUERY_RESULT);
                lastGPU = ns / 1e6;
            }
            gl.deleteQuery(info.q);
        }
    }

    createStopButton(() => {
        running = false;
        capturing = false;

        clearTimeout(warmupTimeout);
        clearTimeout(finishTimeout);

        removeStopButton();
        onComplete();
    });

    const warmupTimeout = window.setTimeout(() => {
        capturing = true;
        captureStart = performance.now();
        console.info('Benchmark started (capturing Performance Data.');
    }, WARMUP_TIME);

    const finishTimeout = window.setTimeout(() => {
        running = false;
        capturing = false;
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

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        rot += 0.6 * (cpuFrameTime / 1000);
        const sceneRot = mat4.create();
        mat4.rotateY(sceneRot, sceneRot, rot);

        gl.uniformMatrix4fv(uSceneRotLoc, false, sceneRot);

        let q = null;
        if (ext) {
            q = gl.createQuery();
            gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        }

        for (const b of batches) {
            if (b.instanceCount === 0) continue;
            gl.bindVertexArray(b.vao);
            gl.drawArraysInstanced(gl.TRIANGLES, 0, b.vertexCount, b.instanceCount);
        }

        if (ext && q) {
            gl.endQuery(ext.TIME_ELAPSED_EXT);
            gpuQueue.push({ q, t: now });
        }

        processGPU();

        overlay.textContent =
            `FPS: ${currentFPS.toFixed(1)}\n` +
            `CPU: ${lastCPU.toFixed(3)} ms\n` +
            `GPU: ${lastGPU.toFixed(3)} ms\n` +
            `C: ${coneBatch.instanceCount} B: ${boxBatch.instanceCount} S: ${sphereBatch.instanceCount}\n` +
            (capturing ? "Capturing…" : "Warming…");

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

