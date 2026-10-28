// server.js
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer();
const io = new Server(server, { cors: { origin: "*" } });

let activePlayers = {};
let worldState = { timeOfDay: 0.25, weather: 'CLEAR', cloudSeed: 123456 };

// ============================================
// SERVER-AUTHORITATIVE MISSION SYSTEM
// ============================================

const MISSION_STAGE = {
    WAITING: 'WAITING',
    ACTIVE: 'ACTIVE',
    COMPLETING: 'COMPLETING',
    COMPLETED: 'COMPLETED'
};

const WTG_FIRE_STAGE = {
    EXTINGUISH_FIRE: 'EXTINGUISH_FIRE',
    FIRE_EXTINGUISHED: 'FIRE_EXTINGUISHED'
};

function generateRandomMission() {
    const missionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return {
        missionId,
        type: 'WTG_FIRE',
        turbineIndex: Math.floor(Math.random() * 15),
        stage: WTG_FIRE_STAGE.EXTINGUISH_FIRE,
        missionStage: MISSION_STAGE.ACTIVE,
        isExtinguished: false,
        isCompleted: false,
        progress: 0,
        extinguishedBy: null,
        createdAt: Date.now()
    };
}

let currentMission = generateRandomMission();
let missionRotationTimer = null;
console.log(`🎯 Initial server mission generated on startup: [${currentMission.type}] ID: ${currentMission.missionId} (Turbine: ${currentMission.turbineIndex})`);

function broadcastMissionState() {
    io.emit('mission-state-updated', JSON.parse(JSON.stringify(currentMission)));
}

function broadcastFullMissionSync() {
    io.emit('sync-mission', JSON.parse(JSON.stringify(currentMission)));
}

function validateMissionCompletion(missionData) {
    if (missionData.type === 'WTG_FIRE') {
        return missionData.isExtinguished === true && missionData.progress >= 1.0;
    }
    return false;
}

function finishMission(reason, socket) {
    if (currentMission.missionStage === MISSION_STAGE.COMPLETED ||
        currentMission.missionStage === MISSION_STAGE.COMPLETING) {
        return;
    }

    currentMission.missionStage = MISSION_STAGE.COMPLETING;
    currentMission.isCompleted = true;
    currentMission.progress = 1;
    currentMission.completedAt = Date.now();
    currentMission.completedBy = socket ? socket.id : 'SERVER';
    currentMission.completionReason = reason;
    currentMission.stage = WTG_FIRE_STAGE.FIRE_EXTINGUISHED;

    broadcastMissionState();
    io.emit('mission-completed', {
        ...JSON.parse(JSON.stringify(currentMission)),
        reason,
        completedBy: currentMission.completedBy
    });
    console.log(`Mission ${currentMission.missionId} completed (${reason}) by ${currentMission.completedBy}.`);

    if (missionRotationTimer) clearTimeout(missionRotationTimer);
    missionRotationTimer = setTimeout(() => {
        rotateToNextMission();
    }, 5000);
}

function rotateToNextMission() {
    currentMission = generateRandomMission();
    currentMission.missionStage = MISSION_STAGE.ACTIVE;
    broadcastFullMissionSync();
    console.log(`🚀 New server-generated mission spawned: ${currentMission.type} (${currentMission.missionId}) on turbine ${currentMission.turbineIndex}`);
}

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    activePlayers[socket.id] = {
        id: socket.id, x: 0, y: 6, z: 0, currentFrame: 5,
        rotorSpeed: 0, gearDown: true, qx: 0, qy: 0, qz: 0, qw: 1,
        winchState: 'STOWED', isDroppingWater: false,
        searchLightState: 'OFF', slX: 0, slY: 0, slZ: 0
    };

    socket.emit('current-players', activePlayers);
    socket.emit('sync-world', worldState);
    socket.emit('sync-mission', { ...currentMission });
    socket.broadcast.emit('player-joined', activePlayers[socket.id]);

    socket.on('player-update', (data = {}) => {
        if (activePlayers[socket.id]) {
            // Explicitly allow and update isDroppingWater state tracking
            const allowed = ['x', 'y', 'z', 'currentFrame', 'rotorSpeed', 'gearDown', 'qx', 'qy', 'qz', 'qw', 'winchState', 'isDroppingWater', 'searchLightState', 'slX', 'slY', 'slZ'];
            for (const key of allowed) {
                if (data[key] !== undefined) {
                    activePlayers[socket.id][key] = data[key];
                }
            }
        }
        // Broadcast the update containing isDroppingWater to all other connected clients
        socket.broadcast.emit('remote-player-update', { id: socket.id, ...data });
    });

    socket.on('wtg-fire-progress', (payload = {}) => {
        if (currentMission.type !== 'WTG_FIRE') return;
        if (currentMission.missionStage !== MISSION_STAGE.ACTIVE) return;
        if (currentMission.isExtinguished) return;

        const progress = Number(payload.progress);
        if (!Number.isFinite(progress)) return;

        const newProgress = Math.max(0, Math.min(1.0, progress));
        currentMission.progress = newProgress;

        if (newProgress >= 1.0 && !currentMission.isExtinguished) {
            currentMission.isExtinguished = true;
            currentMission.extinguishedBy = socket.id;
            currentMission.extinguishedAt = Date.now();
            currentMission.stage = WTG_FIRE_STAGE.FIRE_EXTINGUISHED;
            broadcastMissionState();
            finishMission('WTG_FIRE_EXTINGUISHED', socket);
            return;
        }

        broadcastMissionState();
    });

    socket.on('wtg-fire-extinguished', (payload = {}) => {
        if (currentMission.type !== 'WTG_FIRE') return;
        if (currentMission.missionStage !== MISSION_STAGE.ACTIVE) return;
        if (currentMission.isExtinguished) return;
        if (payload.missionId && payload.missionId !== currentMission.missionId) return;

        currentMission.isExtinguished = true;
        currentMission.progress = 1.0;
        currentMission.extinguishedBy = socket.id;
        currentMission.extinguishedAt = Date.now();
        currentMission.stage = WTG_FIRE_STAGE.FIRE_EXTINGUISHED;

        broadcastMissionState();
        finishMission('WTG_FIRE_EXTINGUISHED', socket);
    });

    socket.on('complete-mission', (payload = {}) => {
        if (currentMission.missionStage === MISSION_STAGE.COMPLETED ||
            currentMission.missionStage === MISSION_STAGE.COMPLETING) {
            return;
        }

        if (payload.missionId && payload.missionId !== currentMission.missionId) {
            return;
        }

        if (!validateMissionCompletion(currentMission)) {
            return;
        }

        finishMission('OBJECTIVE_COMPLETE', socket);
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete activePlayers[socket.id];
        io.emit('player-disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Co-op server running on port ${PORT}`));