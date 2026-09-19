const RTC_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const toBase64Url = (value) => btoa(unescape(encodeURIComponent(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const fromBase64Url = (value) => decodeURIComponent(escape(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4))));

export function packSignal(type, description) {
  return `RICHMAN-${type}|${toBase64Url(description)}`;
}

export function unpackSignal(signal, expectedType) {
  const [prefix, encoded] = signal.trim().split('|');
  if (prefix !== `RICHMAN-${expectedType}` || !encoded) throw new Error(`请输入有效的 RICHMAN-${expectedType} 暗号`);
  return fromBase64Url(encoded);
}

function waitForIceGatheringComplete(peer) {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (peer.iceGatheringState === 'complete') {
        peer.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    peer.addEventListener('icegatheringstatechange', check);
    setTimeout(() => {
      peer.removeEventListener('icegatheringstatechange', check);
      resolve();
    }, 8000);
  });
}

export function createPeerSession({ role, onMessage, onOpen, onClose, onError }) {
  const peer = new RTCPeerConnection(RTC_CONFIG);
  let channel = null;
  let closed = false;

  const attachChannel = (nextChannel) => {
    channel = nextChannel;
    channel.onopen = () => onOpen?.();
    channel.onclose = () => onClose?.();
    channel.onerror = (event) => onError?.(event);
    channel.onmessage = (event) => {
      try { onMessage?.(JSON.parse(event.data)); } catch { onError?.(new Error('收到无法识别的远程消息')); }
    };
  };

  peer.onconnectionstatechange = () => {
    if (['failed', 'disconnected', 'closed'].includes(peer.connectionState)) onClose?.();
  };
  peer.onicecandidateerror = (event) => onError?.(event);
  if (role === 'guest') peer.ondatachannel = (event) => attachChannel(event.channel);
  if (role === 'host') attachChannel(peer.createDataChannel('richman-game'));

  return {
    async createOffer() {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForIceGatheringComplete(peer);
      return packSignal('HOST', JSON.stringify(peer.localDescription));
    },
    async acceptOffer(text) {
      await peer.setRemoteDescription(JSON.parse(unpackSignal(text, 'HOST')));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await waitForIceGatheringComplete(peer);
      return packSignal('JOIN', JSON.stringify(peer.localDescription));
    },
    async acceptAnswer(text) {
      await peer.setRemoteDescription(JSON.parse(unpackSignal(text, 'JOIN')));
    },
    send(message) {
      if (channel?.readyState === 'open') channel.send(JSON.stringify(message));
    },
    close() {
      if (closed) return;
      closed = true;
      channel?.close();
      peer.close();
    },
  };
}
