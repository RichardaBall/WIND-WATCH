const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer();
const io = new Server(server, {
    cors: { origin: "*" }
});

let activePlayers = {};

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    activePlayers[socket.id] = {
        id: socket.id,
        x: 0, y: 6, z: 0,
        rot: 0,
        gearDown: true,
        winchState: 'STOWED'
    };

    socket.emit('current-players', activePlayers);
    socket.broadcast.emit('player-joined', activePlayers[socket.id]);

    socket.on('player-update', (data) => {
        if (activePlayers[socket.id]) {
            activePlayers[socket.id].x = data.x;
            activePlayers[socket.id].y = data.y;
            activePlayers[socket.id].z = data.z;
            activePlayers[socket.id].rot = data.rot;
            activePlayers[socket.id].gearDown = data.gearDown;
            activePlayers[socket.id].winchState = data.winchState;
        }
        socket.broadcast.emit('remote-player-update', {
            id: socket.id,
            ...data
        });
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