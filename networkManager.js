import { io } from 'https://cdn.jsdelivr.net/npm/socket.io-client@4.7.2/dist/socket.io.esm.min.js';

export class NetworkManager {
    constructor(serverUrl = 'https://wind-watch-server.onrender.com') {
        this.socket = io(serverUrl);
        this.callbacks = {};

        this.initListeners();
    }

    on(event, callback) {
        this.callbacks[event] = callback;
    }

    initListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to internet co-op server!');
            if (this.callbacks['connect']) this.callbacks['connect']();
        });

        this.socket.on('current-players', (players) => {
            if (this.callbacks['current-players']) this.callbacks['current-players'](players);
        });

        this.socket.on('player-joined', (playerData) => {
            if (this.callbacks['player-joined']) this.callbacks['player-joined'](playerData);
        });

        this.socket.on('remote-player-update', (data) => {
            if (this.callbacks['remote-player-update']) this.callbacks['remote-player-update'](data);
        });

        this.socket.on('player-disconnected', (id) => {
            if (this.callbacks['player-disconnected']) this.callbacks['player-disconnected'](id);
        });

        this.socket.on('sync-mission', (missionData) => {
            if (this.callbacks['sync-mission']) this.callbacks['sync-mission'](missionData);
        });

        this.socket.on('mission-state-updated', (missionState) => {
            if (this.callbacks['mission-state-updated']) this.callbacks['mission-state-updated'](missionState);
        });

        this.socket.on('mission-completed', (data) => {
            if (this.callbacks['mission-completed']) this.callbacks['mission-completed'](data);
        });
    }

    emit(event, data) {
        this.socket.emit(event, data);
    }

    getSocketId() {
        return this.socket.id;
    }

    isConnected() {
        return this.socket.connected;
    }
}