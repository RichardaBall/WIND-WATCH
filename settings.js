import * as THREE from 'three';

export function setupSettings(dayNightCycle, player) {
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
    container.style.display = 'none'; // Hidden by default

    const title = document.createElement('div');
    title.innerHTML = '<strong>Dev Settings</strong> (Press <strong>T</strong> to toggle)';
    title.style.marginBottom = '10px';
    container.appendChild(title);

    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.flexDirection = 'column';
    btnContainer.style.gap = '8px';
    container.appendChild(btnContainer);

    const toggleBtn = document.createElement('button');
    toggleBtn.innerText = 'Toggle Day / Night';
    toggleBtn.style.padding = '6px 12px';
    toggleBtn.style.background = '#1a365d';
    toggleBtn.style.color = '#ffffff';
    toggleBtn.style.border = '1px solid #4a90e2';
    toggleBtn.style.borderRadius = '4px';
    toggleBtn.style.cursor = 'pointer';
    btnContainer.appendChild(toggleBtn);

    const timelapseBtn = document.createElement('button');
    timelapseBtn.innerText = 'Timelapse: OFF (100x)';
    timelapseBtn.style.padding = '6px 12px';
    timelapseBtn.style.background = '#1a365d';
    timelapseBtn.style.color = '#ffffff';
    timelapseBtn.style.border = '1px solid #4a90e2';
    timelapseBtn.style.borderRadius = '4px';
    timelapseBtn.style.cursor = 'pointer';
    btnContainer.appendChild(timelapseBtn);

    const heliVisBtn = document.createElement('button');
    heliVisBtn.innerText = 'Heli Visibility: ON';
    heliVisBtn.style.padding = '6px 12px';
    heliVisBtn.style.background = '#1a365d';
    heliVisBtn.style.color = '#ffffff';
    heliVisBtn.style.border = '1px solid #4a90e2';
    heliVisBtn.style.borderRadius = '4px';
    heliVisBtn.style.cursor = 'pointer';
    btnContainer.appendChild(heliVisBtn);

    let isNight = false;
    toggleBtn.onclick = () => {
        isNight = !isNight;
        if (typeof dayNightCycle.setTimeOfDay === 'function') {
            dayNightCycle.setTimeOfDay(isNight ? 0.75 : 0.25);
        } else if (typeof dayNightCycle.toggleManualOverride === 'function') {
            dayNightCycle.toggleManualOverride();
        }
    };

    timelapseBtn.onclick = () => {
        let isActive = false;
        if (typeof dayNightCycle.toggleTimelapse === 'function') {
            isActive = dayNightCycle.toggleTimelapse();
        } else if (typeof dayNightCycle.setTimelapse === 'function') {
            isActive = timelapseBtn.innerText.includes('OFF');
            dayNightCycle.setTimelapse(isActive);
        }
        timelapseBtn.innerText = isActive ? 'Timelapse: ON (100x)' : 'Timelapse: OFF (100x)';
        timelapseBtn.style.background = isActive ? '#2b6cb0' : '#1a365d';
    };

    let heliVisible = true;
    heliVisBtn.onclick = () => {
        heliVisible = !heliVisible;
        if (player && typeof player.setVisibility === 'function') {
            player.setVisibility(heliVisible);
        }
        heliVisBtn.innerText = `Heli Visibility: ${heliVisible ? 'ON' : 'OFF'}`;
        heliVisBtn.style.background = heliVisible ? '#1a365d' : '#2b6cb0';
    };

    document.body.appendChild(container);

    let isVisible = false; // Initial state matches hidden display
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyT' && !e.repeat) {
            isVisible = !isVisible;
            container.style.display = isVisible ? 'block' : 'none';
        }
    });
}