const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer();
const io = new Server(server, {
    cors: { origin: "*" }
});

let activePlayers = {};

let worldState = {
    timeOfDay: 0.25,
    weather: 'CLEAR'
};

// Single shared mission state on the server
let currentMission = {
    type: 'LIFERAFT',
    x: (Math.random() - 0.5) * 400,
    z: (Math.random() - 0.5) * 400,
    isCompleted: false
};

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    activePlayers[socket.id] = {
        id: socket.id,
        x: 0, y: 6, z: 0,
        currentFrame: 5,
        rotorSpeed: 0,
        gearDown: true,
        qx: 0, qy: 0, qz: 0, qw: 1,
        winchState: 'STOWED',
        isDroppingWater: false,
        searchLightState: 'OFF'
    };

    socket.emit('current-players', activePlayers);
    socket.emit('sync-world', worldState);
    socket.emit('sync-mission', currentMission);
    socket.broadcast.emit('player-joined', activePlayers[socket.id]);

    socket.on('player-update', (data) => {
        if (activePlayers[socket.id]) {
            activePlayers[socket.id].x = data.x;
            activePlayers[socket.id].y = data.y;
            activePlayers[socket.id].z = data.z;
            activePlayers[socket.id].currentFrame = data.currentFrame;
            activePlayers[socket.id].rotorSpeed = data.rotorSpeed;
            activePlayers[socket.id].gearDown = data.gearDown;
            activePlayers[socket.id].qx = data.qx;
            activePlayers[socket.id].qy = data.qy;
            activePlayers[socket.id].qz = data.qz;
            activePlayers[socket.id].qw = data.qw;
            activePlayers[socket.id].winchState = data.winchState;
            activePlayers[socket.id].isDroppingWater = data.isDroppingWater;
            activePlayers[socket.id].searchLightState = data.searchLightState;
        }
        socket.broadcast.emit('remote-player-update', {
            id: socket.id,
            ...data
        });
    });

    socket.on('world-update', (data) => {
        if (data.timeOfDay !== undefined) worldState.timeOfDay = data.timeOfDay;
        if (data.weather !== undefined) worldState.weather = data.weather;
        socket.broadcast.emit('sync-world', worldState);
    });

    socket.on('complete-mission', () => {
        if (currentMission.isCompleted) return;
        currentMission.isCompleted = true;
        io.emit('mission-completed');
        
        setTimeout(() => {
            currentMission = {
                type: 'LIFERAFT',
                x: (Math.random() - 0.5) * 400,
                z: (Math.random() - 0.5) * 400,
                isCompleted: false
            };
            io.emit('sync-mission', currentMission);
        }, 3000);
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete activePlayers[socket.id];
        io.emit('player-disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Co-op server running on port ${PORT}`);
});