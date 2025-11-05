import type Stats from "stats-gl";

export function exportToCSV(data: {
    time: number,
    fps: number,
    cpu: number,
    gpu: number,
}[]) {
    const headers = ['Time (ms)', 'FPS', 'CPU (ms)', 'GPU (ms)'];
    const rows = data.map(d => [
        d.time.toFixed(2),
        d.fps.toFixed(2),
        d.cpu.toFixed(2),
        d.gpu.toFixed(2),
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'statsgl_benchmark.csv';
    a.click();
}

export function updateFrameStats(capturing: boolean, stats: Stats, lastLogCount: number, startTime: number, frameData: { time: number, fps: number, cpu: number, gpu: number,}[]) {
    if (capturing) {
        const logCount = stats.averageCpu.logs.length;
        if (logCount !== lastLogCount) {
            lastLogCount = logCount;
            const fps = stats.averageFps.logs.at(-1) ?? 0;
            const cpu = stats.averageCpu.logs.at(-1) ?? 0;
            const gpu = stats.averageGpu.logs.at(-1) ?? 0;

            frameData.push({
                time: performance.now() - startTime,
                fps,
                cpu,
                gpu,
            })
        }
    }
}