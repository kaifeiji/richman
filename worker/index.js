export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/family' || request.headers.get('Upgrade') !== 'websocket') {
      return new Response('WebSocket required', { status: 426 });
    }
    const roomName = url.searchParams.get('room')?.trim();
    if (!roomName) return new Response('Room name required', { status: 400 });
    const roomId = env.RICHMAN_ROOM.idFromName(roomName.toLowerCase());
    return env.RICHMAN_ROOM.get(roomId).fetch(request);
  },
};

export class RichmanRoom {
  constructor(state) {
    this.state = state;
    this.clients = new Map();
    this.players = new Map();
    this.started = false;
    this.game = null;
  }

  fetch(request) {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const url = new URL(request.url);
    const name = url.searchParams.get('name') || '玩家';
    const clientId = url.searchParams.get('client');
    if (!clientId) return new Response('Client identity required', { status: 400 });
    server.accept();
    let clientInfo = this.players.get(clientId);
    if (this.started && !clientInfo) {
      server.send(JSON.stringify({ type: 'game-started' }));
      server.close(1008, 'game started');
      return new Response(null, { status: 101, webSocket: client });
    }
    if (!clientInfo && this.players.size >= 4) {
      server.send(JSON.stringify({ type: 'room-full' }));
      server.close(1008, 'room full');
      return new Response(null, { status: 101, webSocket: client });
    }
    if (!clientInfo) {
      const usedIds = new Set([...this.players.values()].map((player) => player.playerId));
      const playerId = [0, 1, 2, 3].find((id) => !usedIds.has(id));
      clientInfo = { playerId, name, host: playerId === 0 };
      this.players.set(clientId, clientInfo);
    }
    this.clients.set(server, clientId);
    const players = () => [...this.players.values()].sort((left, right) => left.playerId - right.playerId);
    server.send(JSON.stringify({ type: 'joined', playerId: clientInfo.playerId, host: clientInfo.host, players: players() }));
    if (this.game) server.send(JSON.stringify({ type: 'state', game: this.game }));
    this.broadcast({ type: 'players', players: players() }, server);

    server.addEventListener('message', (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      const senderId = this.clients.get(server);
      const sender = this.players.get(senderId);
      if (!sender) return;
      if (message.type === 'start') {
        if (!sender.host) return;
        this.started = true;
        this.game = message.game;
        this.broadcast({ ...message, playerId: sender.playerId }, server);
      }
      if (message.type === 'state' || message.type === 'movement') {
        if (!sender.host) return;
        if (message.type === 'state') this.game = message.game;
        this.broadcast({ ...message, playerId: sender.playerId }, server);
      }
      if (message.type === 'command') {
        if (sender.host) return;
        this.broadcast({ ...message, playerId: sender.playerId }, server);
      }
      if (message.type === 'signal') {
        this.broadcast({ ...message, playerId: sender.playerId }, server);
      }
    });
    const remove = () => {
      this.clients.delete(server);
      if (!this.started) this.players.delete(clientId);
      this.broadcast({ type: 'player-left', playerId: clientInfo.playerId }, server);
    };
    server.addEventListener('close', remove);
    server.addEventListener('error', remove);
    return new Response(null, { status: 101, webSocket: client });
  }

  broadcast(message, except) {
    const text = JSON.stringify(message);
    for (const client of this.clients.keys()) {
      if (client !== except && client.readyState === WebSocket.OPEN) client.send(text);
    }
  }
}
