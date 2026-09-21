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
  }

  fetch(request) {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const url = new URL(request.url);
    const name = url.searchParams.get('name') || '玩家';
    server.accept();
    const playerId = this.clients.size;
    if (playerId >= 4) {
      server.send(JSON.stringify({ type: 'room-full' }));
      server.close(1008, 'room full');
      return new Response(null, { status: 101, webSocket: client });
    }
    const clientInfo = { playerId, name, host: playerId === 0 };
    this.clients.set(server, clientInfo);
    server.send(JSON.stringify({ type: 'joined', playerId, host: playerId === 0, players: [...this.clients.values()] }));
    this.broadcast({ type: 'players', players: [...this.clients.values()] }, server);
    if (playerId > 0) this.broadcast({ type: 'peer-joined', playerId, name }, server);

    server.addEventListener('message', (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      const sender = this.clients.get(server);
      if (!sender) return;
      if (message.type === 'signal' || message.type === 'state' || message.type === 'command' || message.type === 'start') {
        this.broadcast({ ...message, playerId: sender.playerId }, server);
      }
    });
    const remove = () => {
      this.clients.delete(server);
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
