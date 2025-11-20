export function createSphereVertices(segments = 10): number[] {
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

export function createConeVertices(segments = 20): number[] {
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

export function createBoxVertices(): number[] {
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