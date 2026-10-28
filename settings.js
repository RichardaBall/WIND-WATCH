// settings.js
import * as THREE from 'three';

export function setupSettings(dayNightCycle, player, weatherSystem, missionManager, helicopterSystems, cloudSystem) {
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

    // Unlimited Fuel Button
    const fuelBtn = document.createElement('button');
    fuelBtn.innerText = 'Unlimited Fuel: OFF';
    fuelBtn.style.padding = '6px 12px';
    fuelBtn.style.background = '#1a365d';
    fuelBtn.style.color = '#ffffff';
    fuelBtn.style.border = '1px solid #4a90e2';
    fuelBtn.style.borderRadius = '4px';
    fuelBtn.style.cursor = 'pointer';
    let unlimitedFuelActive = false;
    fuelBtn.onclick = () => {
        unlimitedFuelActive = !unlimitedFuelActive;
        if (helicopterSystems && typeof helicopterSystems.setUnlimitedFuel === 'function') {
            helicopterSystems.setUnlimitedFuel(unlimitedFuelActive);
        }
        fuelBtn.innerText = `Unlimited Fuel: ${unlimitedFuelActive ? 'ON' : 'OFF'}`;
        fuelBtn.style.background = unlimitedFuelActive ? '#2b6cb0' : '#1a365d';
    };
    btnContainer.appendChild(fuelBtn);

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
            <div style="display: flex; justify-content: space-between;"><span style="color: #93c5fd;">1 Key</span><span>Water Drop Tool</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: #93c5fd;">2 Key</span><span>Water Fill Tool</span></div>
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