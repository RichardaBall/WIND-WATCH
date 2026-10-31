import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';

export class OceanWater {
    constructor(scene, sunLight) {
        const waterGeometry = new THREE.PlaneGeometry(5000, 5000, 32, 32);
        const waterNormals = new THREE.TextureLoader().load(
            'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg',
            (texture) => {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(30, 30);
            }
        );

        // Pristine original day water configuration with optimized texture resolution
        this.water = new Water(waterGeometry, {
            textureWidth: 256,
            textureHeight: 256,
            waterNormals: waterNormals,
            sunDirection: sunLight.position.clone().normalize(),
            sunColor: 0x336699,
            waterColor: 0x001e36,
            distortionScale: 3.7,
            fog: scene.fog !== undefined
        });
        
        this.water.rotation.x = -Math.PI / 2;
        this.water.position.y = -2.0;
        // Replace the mirror reflection pass with the sky colour. Water renders the whole scene a second time every
        // frame for its reflection, and that nested render makes three.js re-evaluate every lit material's shader
        // each frame (lots of garbage, so GC stutter). From this top-down camera the water only mirrors the sky,
        // which is a single colour, so a 1x1 texture holding scene.background gives the same look.
        // Sun glitter and wave normals are part of the water shader and still work.
        this.scene = scene;
        this.skyReflection = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
        this.water.material.uniforms['mirrorSampler'].value = this.skyReflection;
        // Keep the one cheap part of Water's own onBeforeRender: the camera position used for fresnel and sun glitter
        this.water.onBeforeRender = (renderer, renderScene, camera) => {
            this.water.material.uniforms['eye'].value.setFromMatrixPosition(camera.matrixWorld);
        };
        scene.add(this.water);

        // Subtle dark overlay plane just above the water for smooth night dimming
        const overlayGeometry = new THREE.PlaneGeometry(5000, 5000);
        this.nightOverlayMaterial = new THREE.MeshBasicMaterial({
            color: 0x000208,
            transparent: true,
            opacity: 0.0, // Fully transparent during day
            depthWrite: false
        });
        this.nightOverlay = new THREE.Mesh(overlayGeometry, this.nightOverlayMaterial);
        this.nightOverlay.rotation.x = -Math.PI / 2;
        this.nightOverlay.position.y = -1.9; // Just above water surface
        scene.add(this.nightOverlay);
    }

    updateLighting(nightFactor) {
        // Smoothly fade in the dark overlay at night without breaking the water shader
        if (this.nightOverlayMaterial) {
            this.nightOverlayMaterial.opacity = nightFactor * 0.75;
        }
    }

    updateSkyReflection() {
        const sky = this.scene.background;
        if (!sky || !sky.isColor) return;
        // Linear values, as the original render target held them (it is not tone mapped or sRGB encoded)
        const data = this.skyReflection.image.data;
        const r = Math.round(sky.r * 255);
        const g = Math.round(sky.g * 255);
        const b = Math.round(sky.b * 255);
        if (data[0] !== r || data[1] !== g || data[2] !== b) {
            data[0] = r;
            data[1] = g;
            data[2] = b;
            this.skyReflection.needsUpdate = true;
        }
    }

    update(delta, playerPosition) {
        this.updateSkyReflection();
        if (this.water.material.uniforms['time']) {
            this.water.material.uniforms['time'].value += delta * 0.3;
        }
        this.water.position.x = playerPosition.x;
        this.water.position.z = playerPosition.z;

        this.nightOverlay.position.x = playerPosition.x;
        this.nightOverlay.position.z = playerPosition.z;
    }
}