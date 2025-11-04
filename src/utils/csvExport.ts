export function exportToCSV(data: {
    time: number,
    fps: number,
    cpu: number,
    gpu: number,
    cpuUsage: number,
    gpuUsage: number
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