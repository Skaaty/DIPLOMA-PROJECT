export function createStopButton(onClick: () => void): HTMLButtonElement {
    const buttonContainer = document.getElementById('button-container') as HTMLDivElement;
    if (!buttonContainer) {
        console.warn('Button container not found.');
        return undefined as unknown as HTMLButtonElement;
    }

    const existing = document.getElementById('stop-benchmark-btn');
    if (existing) existing.remove();

    const button = document.createElement('button');
    button.id = 'stop-benchmark-btn';
    button.textContent = 'Stop Benchmark';
    button.addEventListener('click', onClick);

    buttonContainer.appendChild(button);
    return button;
}

export function removeStopButton(): void {
    const button = document.getElementById('stop-benchmark-btn');
    if (button) {
        button.classList.add('fade-out');
        setTimeout(() => button.remove(), 400);
    }
}