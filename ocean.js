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

    update(delta, playerPosition) {
        if (this.water.material.uniforms['time']) {
            this.water.material.uniforms['time'].value += delta * 0.3;
        }
        this.water.position.x = playerPosition.x;
        this.water.position.z = playerPosition.z;

        this.nightOverlay.position.x = playerPosition.x;
        this.nightOverlay.position.z = playerPosition.z;
    }
}