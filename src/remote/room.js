const SIGNAL_URL = import.meta.env.VITE_SIGNAL_URL || 'wss://signal.kaifeiji.cc/family';

export function connectRoom({ roomName, nickname, onMessage, onOpen, onClose, onError }) {
  const socket = new WebSocket(`${SIGNAL_URL}?room=${encodeURIComponent(roomName)}&name=${encodeURIComponent(nickname)}`);
  socket.onopen = () => { socket.send(JSON.stringify({ type: 'join', room: roomName, name: nickname })); onOpen?.(); };
  socket.onmessage = (event) => {
    try { onMessage?.(JSON.parse(event.data)); } catch { onError?.(new Error('房间消息无法识别')); }
  };
  socket.onclose = () => onClose?.();
  socket.onerror = (event) => onError?.(event);
  return {
    send(message) { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); },
    close() { socket.close(); },
  };
}
