export function setupSettings(dayNightCycle) {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.background = 'rgba(0, 0, 0, 0.85)';
    container.style.padding = '12px 15px';
    container.style.borderRadius = '6px';
    container.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    container.style.color = '#ffffff';
    container.style.fontFamily = 'monospace';
    container.style.fontSize = '12px';
    container.style.zIndex = '100';

    const title = document.createElement('div');
    title.innerHTML = '<strong>Dev Settings</strong> (Press <strong>T</strong> to toggle)';
    title.style.marginBottom = '10px';
    container.appendChild(title);

    const toggleBtn = document.createElement('button');
    toggleBtn.innerText = 'Toggle Day / Night';
    toggleBtn.style.padding = '6px 12px';
    toggleBtn.style.background = '#1a365d';
    toggleBtn.style.color = '#ffffff';
    toggleBtn.style.border = '1px solid #4a90e2';
    toggleBtn.style.borderRadius = '4px';
    toggleBtn.style.cursor = 'pointer';
    container.appendChild(toggleBtn);

    let isNight = false;
    toggleBtn.onclick = () => {
        isNight = !isNight;
        dayNightCycle.setTimeOfDay(isNight ? 0.0 : 0.25);
    };

    document.body.appendChild(container);

    let isVisible = true;
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyT') {
            isVisible = !isVisible;
            container.style.display = isVisible ? 'block' : 'none';
        }
    });
}