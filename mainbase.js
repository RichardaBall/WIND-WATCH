import * as THREE from 'three';

export class MainBase {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        this.group = new THREE.Group();
        this.group.position.set(0, 5, 0);
        scene.add(this.group);

        const textureLoader = new THREE.TextureLoader();
        const baseTexture = textureLoader.load('mainbase.png', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
        });

        this.material = new THREE.MeshStandardMaterial({
            map: baseTexture,
            transparent: true,
            alphaTest: 0.5,
            roughness: 0.4
        });

        const baseGeometry = new THREE.PlaneGeometry(24, 24);
        this.mesh = new THREE.Mesh(baseGeometry, this.material);
        this.group.add(this.mesh);

        // --- Final Saved Light Layout Configurations ---
        this.lightConfigs = {
            green: [
                { x: -2.1, y: -1.4, scale: 0.05 },
                { x: 2, y: -1.5, scale: 0.05 },
                { x: -1.7, y: 1.2, scale: 0.05 },
                { x: 2, y: 1.1, scale: 0.05 }
            ],
            red: [
                { x: 0, y: -5, scale: 0.05 },
                { x: 6, y: 0, scale: 0.05 },
                { x: -6, y: 0, scale: 0.05 },
                { x: 0, y: 3.2, scale: 0.05 },
                { x: -10.1, y: 12, scale: 0.05 },
                { x: -10.7, y: 11.2, scale: 0.05 }
            ],
            white: [
                { x: -5, y: 2.5, scale: 0 },
                { x: 3, y: 3.5, scale: 0 }
            ]
        };

        this.allLights = [];
        this.buildLightGroup('green', 0x00ff66);
        this.buildLightGroup('red', 0xff0033);
        this.buildLightGroup('white', 0xffffff);

        this.editorActive = false;
        this.initEditorUI();
    }

    buildLightGroup(category, colorHex) {
        this.lightConfigs[category].forEach((pos, idx) => {
            const markerGeo = new THREE.SphereGeometry(1, 16, 16);
            const markerMat = new THREE.MeshBasicMaterial({ color: colorHex });
            const marker = new THREE.Mesh(markerGeo, markerMat);
            marker.position.set(pos.x, pos.y, 0.2);
            marker.scale.set(pos.scale, pos.scale, pos.scale);
            this.group.add(marker);

            const pointLight = new THREE.PointLight(colorHex, 0.0, 15);
            pointLight.position.set(pos.x, pos.y, 0.2);
            this.group.add(pointLight);

            this.allLights.push({ category, index: idx, marker, pointLight });
        });
    }

    initEditorUI() {
        const uiContainer = document.createElement('div');
        uiContainer.id = 'light-editor-ui';
        uiContainer.style.cssText = `
            position: fixed;
            top: 80px;
            left: 20px;
            background: rgba(0, 0, 0, 0.92);
            border: 2px solid #4a90e2;
            padding: 15px;
            border-radius: 8px;
            color: #ffffff;
            font-family: monospace;
            font-size: 12px;
            z-index: 10000;
            display: none;
            flex-direction: column;
            gap: 12px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.9);
            width: 320px;
        `;

        let htmlContent = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:#4a90e2; font-size:14px;">LIGHT CONTROLS (Press P)</strong>
            </div>
            <span style="font-size:11px; color:#aaa;">Type exact X, Y, or Scale values to position lights perfectly on the base.</span>
        `;

        ['green', 'red', 'white'].forEach(cat => {
            htmlContent += `<div style="border-top:1px solid #333; padding-top:8px;"><b style="color:${cat === 'green' ? '#00ff66' : cat === 'red' ? '#ff3333' : '#fff'};">${cat.toUpperCase()} LIGHTS</b>`;
            this.lightConfigs[cat].forEach((cfg, idx) => {
                htmlContent += `
                    <div style="display:flex; gap:5px; margin-top:5px; align-items:center; font-size:11px;">
                        <span>#${idx}</span>
                        <span>X:</span><input type="number" step="0.1" value="${cfg.x}" data-cat="${cat}" data-idx="${idx}" data-prop="x" style="width:50px; background:#222; color:#fff; border:1px solid #555; padding:2px;">
                        <span>Y:</span><input type="number" step="0.1" value="${cfg.y}" data-cat="${cat}" data-idx="${idx}" data-prop="y" style="width:50px; background:#222; color:#fff; border:1px solid #555; padding:2px;">
                        <span>Sz:</span><input type="number" step="0.01" value="${cfg.scale}" data-cat="${cat}" data-idx="${idx}" data-prop="scale" style="width:45px; background:#222; color:#fff; border:1px solid #555; padding:2px;">
                    </div>
                `;
            });
            htmlContent += `</div>`;
        });

        htmlContent += `<button id="print-coords-btn" style="background:#2b6cb0; color:#fff; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold; margin-top:5px;">Print Coords to Console</button>`;

        uiContainer.innerHTML = htmlContent;
        document.body.appendChild(uiContainer);
        this.uiContainer = uiContainer;

        uiContainer.addEventListener('input', (e) => {
            const input = e.target;
            if (input.tagName === 'INPUT') {
                const cat = input.dataset.cat;
                const idx = parseInt(input.dataset.idx);
                const prop = input.dataset.prop;
                const val = parseFloat(input.value) || 0;

                this.lightConfigs[cat][idx][prop] = val;
                this.refreshLightTransforms();
            }
        });

        document.getElementById('print-coords-btn').onclick = () => {
            console.log("=== FINAL LIGHT CONFIGURATIONS ===");
            console.log(JSON.stringify(this.lightConfigs, null, 2));
            alert("Coordinates printed to browser console (Press F12 to view)!");
        };

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyP' && !e.repeat) {
                this.editorActive = !this.editorActive;
                uiContainer.style.display = this.editorActive ? 'flex' : 'none';
                console.log(this.editorActive ? "Light Editor ENABLED" : "Light Editor DISABLED");
            }
        });
    }

    refreshLightTransforms() {
        this.allLights.forEach(item => {
            const cfg = this.lightConfigs[item.category][item.index];
            item.marker.position.set(cfg.x, cfg.y, 0.2);
            item.marker.scale.set(cfg.scale, cfg.scale, cfg.scale);
            item.pointLight.position.set(cfg.x, cfg.y, 0.2);
        });
    }

    update(nightFactor, cameraQuaternion) {
        this.material.color.setRGB(1 - nightFactor * 0.4, 1 - nightFactor * 0.4, 1 - nightFactor * 0.3);

        const intensityMultiplier = this.editorActive ? 2.5 : nightFactor * 3.0;
        this.allLights.forEach(item => {
            item.pointLight.intensity = intensityMultiplier;
        });

        if (cameraQuaternion && !this.editorActive) {
            this.group.quaternion.copy(cameraQuaternion);
        }
    }
}