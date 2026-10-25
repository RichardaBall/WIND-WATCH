// settings.js
import * as THREE from 'three';

export function setupSettings(dayNightCycle, player, weatherSystem, missionManager) {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '60px';
    container.style.left = '20px';
    container.style.background = 'rgba(5, 12, 25, 0.95)';
    container.style.padding = '14px 16px';
    container.style.borderRadius = '8px';
    container.style.border = '1px solid rgba(100, 150, 200, 0.4)';
    container.style.color = '#ffffff';
    container.style.fontFamily = 'monospace';
    container.style.fontSize = '12px';
    container.style.zIndex = '100';
    container.style.display = 'none'; // Hidden by default
    container.style.backdropFilter = 'blur(6px)';
    container.style.boxShadow = '0 10px 25px rgba(0,0,0,0.7)';

    const title = document.createElement('div');
    title.innerHTML = '<strong>Settings</strong>';
    title.style.marginBottom = '12px';
    title.style.color = '#60a5fa';
    title.style.textAlign = 'center';
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

    // Weather Override Button (Cycles through all 6 weather states)
    const weatherBtn = document.createElement('button');
    weatherBtn.innerText = 'Weather: CLEAR';
    weatherBtn.style.padding = '6px 12px';
    weatherBtn.style.background = '#1a365d';
    weatherBtn.style.color = '#ffffff';
    weatherBtn.style.border = '1px solid #4a90e2';
    weatherBtn.style.borderRadius = '4px';
    weatherBtn.style.cursor = 'pointer';
    weatherBtn.onclick = () => {
        if (weatherSystem && typeof weatherSystem.setWeather === 'function') {
            const sequence = ['CLEAR', 'RAIN', 'FOG', 'RAIN_FOG', 'STORM', 'SNOW', 'SNOW_FOG'];
            const currentIndex = sequence.indexOf(weatherSystem.targetWeather);
            const nextIndex = (currentIndex + 1) % sequence.length;
            const next = sequence[nextIndex];
            
            weatherSystem.setWeather(next);
            weatherBtn.innerText = `Weather: ${next}`;
        }
    };
    btnContainer.appendChild(weatherBtn);

    // Skip Mission Button
    const testMissionBtn = document.createElement('button');
    testMissionBtn.innerText = 'Skip Mission';
    testMissionBtn.style.padding = '6px 12px';
    testMissionBtn.style.background = '#7c2d12';
    testMissionBtn.style.color = '#ffffff';
    testMissionBtn.style.border = '1px solid #f97316';
    testMissionBtn.style.borderRadius = '4px';
    testMissionBtn.style.cursor = 'pointer';
    testMissionBtn.onclick = () => {
        if (missionManager && typeof missionManager.completeActiveMission === 'function') {
            missionManager.completeActiveMission();
        }
    };
    btnContainer.appendChild(testMissionBtn);

    const controlsBtn = document.createElement('button');
    controlsBtn.innerText = 'Controls';
    controlsBtn.style.padding = '6px 12px';
    controlsBtn.style.background = '#1a365d';
    controlsBtn.style.color = '#ffffff';
    controlsBtn.style.border = '1px solid #4a90e2';
    controlsBtn.style.borderRadius = '4px';
    controlsBtn.style.cursor = 'pointer';
    btnContainer.appendChild(controlsBtn);

    // Controls Popup Window
    const controlsModal = document.createElement('div');
    controlsModal.style.cssText = `
        position: absolute;
        top: 140px;
        left: 215px;
        background: rgba(5, 12, 25, 0.95);
        border: 1px solid rgba(100, 150, 200, 0.4);
        padding: 14px 16px;
        border-radius: 8px;
        color: #ffffff;
        font-family: monospace;
        font-size: 12px;
        z-index: 1000;
        display: none;
        box-shadow: 0 10px 25px rgba(0,0,0,0.7);
        width: 280px;
        backdrop-filter: blur(6px);
    `;
    controlsModal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 6px;">
            <div style="width: 20px;"></div>
            <strong style="font-size: 13px; letter-spacing: 1px; color: #60a5fa; text-align: center; flex: 1;">GAME CONTROLS</strong>
            <button id="close-controls-modal" style="background: transparent; border: none; color: #ffffff; font-size: 14px; cursor: pointer; font-weight: bold; width: 20px;">&times;</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; color: #e2e8f0;">
            <div style="display: flex; justify-content: space-between;"><span style="color: #93c5fd;">Left Click & Drag</span><span>Set Destination</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: #93c5fd;">Mouse Wheel</span><span>Zoom Camera</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: #93c5fd;">E Key</span><span>Engine Start / Stop</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: #93c5fd;">G Key</span><span>Toggle Landing Gear</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: #93c5fd;">L Key</span><span>Cycle Searchlight</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: #93c5fd;">1 Key</span><span>Select Water Tool</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: #93c5fd;">2 Key</span><span>Select Winch Tool</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: #93c5fd;">Spacebar</span><span>Activate Tool</span></div>
        </div>
    `;
    document.body.appendChild(controlsModal);

    const closeControlsBtn = controlsModal.querySelector('#close-controls-modal');
    controlsBtn.onclick = () => {
        controlsModal.style.display = controlsModal.style.display === 'block' ? 'none' : 'block';
    };
    closeControlsBtn.onclick = () => {
        controlsModal.style.display = 'none';
    };

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

    let isVisible = false;

    const setVisible = (visible) => {
        isVisible = visible;
        container.style.display = isVisible ? 'block' : 'none';
        if (!isVisible) {
            controlsModal.style.display = 'none';
        }
        
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            if (isVisible) {
                settingsBtn.classList.add('active');
            } else {
                settingsBtn.classList.remove('active');
            }
        }
    };

    return {
        setVisible(visible) {
            setVisible(visible);
        },
        toggle() {
            setVisible(!isVisible);
            return isVisible;
        }
    };
}