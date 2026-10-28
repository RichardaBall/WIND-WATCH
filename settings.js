// settings.js
import * as THREE from 'three';

export function setupSettings(dayNightCycle, player, weatherSystem, missionManager, helicopterSystems, cloudSystem) {
    // Tutorial Overlay Container
    const tutorialOverlay = document.createElement('div');
    tutorialOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.85);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 20000;
        cursor: pointer;
    `;

    const tutorialImg = document.createElement('img');
    tutorialImg.src = 'tutorial.png';
    tutorialImg.style.cssText = `
        max-width: 90vw;
        max-height: 90vh;
        object-fit: contain;
        border: 2px solid rgba(100, 150, 200, 0.6);
        border-radius: 6px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.8);
    `;
    tutorialOverlay.appendChild(tutorialImg);
    document.body.appendChild(tutorialOverlay);

    let isVisible = false;

    const setVisible = (visible) => {
        isVisible = visible;
        tutorialOverlay.style.display = isVisible ? 'flex' : 'none';
        
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            if (isVisible) {
                settingsBtn.classList.add('active');
            } else {
                settingsBtn.classList.remove('active');
            }
        }
    };

    // Clicking anywhere on the tutorial overlay dismisses it and resets the settings button state
    tutorialOverlay.onclick = () => {
        setVisible(false);
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