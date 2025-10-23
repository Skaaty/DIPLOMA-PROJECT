import './style.css';

const apiSelector = document.getElementById('api-selector') as HTMLSelectElement;
const sceneSelector = document.getElementById('scene-selector') as HTMLSelectElement;
const confirmButton = document.getElementById('confirm-button') as HTMLButtonElement;

const benchmarkData = [];

confirmButton?.addEventListener('click', () => {
  const selectedScene = sceneSelector.value;

})