const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer();
const io = new Server(server, {
    cors: { origin: "*" }
});

let activePlayers = {};

let worldState = {
    timeOfDay: 0.25,
    weather: 'CLEAR',
    cloudSeed: 123456
};

function generateRandomMission() {
    const types = ['LIFERAFT', 'WTG_FIRE'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    if (type === 'LIFERAFT') {
        return {
            type: 'LIFERAFT',
            x: (Math.random() - 0.5) * 400,
            z: (Math.random() - 0.5) * 400,
            variantIndex: Math.random() < 0.5 ? 0 : 1,
            isCompleted: false
        };
    } else {
        return {
            type: 'WTG_FIRE',
            turbineIndex: Math.floor(Math.random() * 5),
            isCompleted: false
        };
    }
}

let currentMission = generateRandomMission();

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
            activePlayers[socket.id] = { ...activePlayers[socket.id], ...data };
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
        console.log(`🏆 Mission [${currentMission.type}] completed globally. Rotating to next mission...`);
        
        setTimeout(() => {
            currentMission = generateRandomMission();
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