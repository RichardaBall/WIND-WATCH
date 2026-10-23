import * as THREE from 'three';

export class MissionManager {
    constructor(scene, navRadar, windFarm) {
        this.scene = scene;
        this.navRadar = navRadar;
        this.windFarm = windFarm;
        this.missions = new Map();

        // Register permanent infrastructure landmarks on startup
        this.registerPermanentLandmarks();
    }

    registerPermanentLandmarks() {
        // Main Base (Blue)
        this.navRadar.addOrUpdateMarker('main_base', new THREE.Vector3(0, 0, 0), '#3498db', 'BASE');
        
        // Wind Farm (Green)
        if (this.windFarm) {
            this.navRadar.addOrUpdateMarker('wind_farm', this.windFarm, '#2ecc71', 'WIND');
        }
    }

    addMission(id, position, type, label) {
        this.missions.set(id, {
            position: position,
            type: type,
            label: label,
            completed: false
        });

        // Dynamic rescue missions use red alert color
        this.navRadar.addOrUpdateMarker(id, position, '#e74c3c', label);
        console.log(`Mission Spawned: [${id}] at (${Math.round(position.x)}, ${Math.round(position.z)})`);
    }

    completeMission(id) {
        if (this.missions.has(id)) {
            const mission = this.missions.get(id);
            mission.completed = true;
            this.navRadar.removeMarker(id);
            console.log(`Mission Completed: [${id}] 🎉`);
        }
    }

    update(delta, playerPosition) {
        for (const [id, mission] of this.missions.entries()) {
            if (mission.completed) continue;

            const dist = playerPosition.distanceTo(mission.position);
            if (dist < 10.0 && mission.type === 'TEST_RESCUE') {
                this.completeMission(id);
            }
        }
    }
}