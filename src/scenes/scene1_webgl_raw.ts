import { mat4, vec3 } from 'gl-matrix';

type Mat4 = Float32Array;

let gl: WebGL2RenderingContext;
let program: WebGLProgram;

let uProjectionLoc: WebGLUniformLocation;
let uViewLoc: WebGLUniformLocation;
let uSceneRotLoc: WebGLUniformLocation;
let projectionMatrix: Mat4;
let viewMatrix: Mat4;

const WARMUP_TIME = 15_000;
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
         0.1,  0.1, 0.1,
        -0.1, -0.1, 0.1,
         0.1,  0.1, 0.1,
        -0.1,  0.1, 0.1,

        // back
        -0.1, -0.1, -0.1,
         0.1,  0.1, -0.1,
         0.1, -0.1, -0.1,
        -0.1, -0.1, -0.1,
        -0.1,  0.1, -0.1,
         0.1,  0.1, -0.1,

        // left
        -0.1, -0.1, -0.1,
        -0.1, -0.1,  0.1,
        -0.1,  0.1,  0.1,
        -0.1, -0.1, -0.1,
        -0.1,  0.1,  0.1,
        -0.1,  0.1, -0.1,

        // right
         0.1, -0.1, -0.1,
         0.1,  0.1,  0.1,
         0.1, -0.1,  0.1,
         0.1, -0.1, -0.1,
         0.1,  0.1, -0.1,
         0.1,  0.1,  0.1,

        // top
        -0.1,  0.1,  0.1,
         0.1,  0.1,  0.1,
         0.1,  0.1, -0.1,
        -0.1,  0.1,  0.1,
         0.1,  0.1, -0.1,
        -0.1,  0.1, -0.1,

        // bottom
        -0.1, -0.1,  0.1,
         0.1, -0.1, -0.1,
         0.1, -0.1,  0.1,
        -0.1, -0.1,  0.1,
        -0.1, -0.1, -0.1,
         0.1, -0.1, -0.1,
    ];
}

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
    
    if (!gl.getSamplerParameter(sh, gl.COMPILE_STATUS)) {
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


}