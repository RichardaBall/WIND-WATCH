// helipads.js
import * as THREE from 'three';

// The two helipads on the main base. Landing, refuelling, the landing aid, spawning and the pad boxes in
// mainbase.js all read this list, so moving a pad is one edit here. Never change these vectors in place.
export const BASE_HELIPADS = [
    new THREE.Vector3(8.41, 19.81, -6.54),
    new THREE.Vector3(-10.28, 27.29, 3.74)
];
