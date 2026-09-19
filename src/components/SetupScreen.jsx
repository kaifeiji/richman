import { useState } from 'react';
import { Crown, DoorOpen, LogIn, Minus, Play, Plus, Users } from 'lucide-react';

export default function SetupScreen({ names, setNames, onStart, onEnterRoom, onLeaveRoom, remote }) {
  const [mode, setMode] = useState('local');
  const [roomName, setRoomName] = useState('richman');
  const [remoteName, setRemoteName] = useState('');
  const updateName = (index, value) => setNames(names.map((name, itemIndex) => itemIndex === index ? value : name));
  return <main className="setup-page">
    <section className="setup-panel">
      <span className="kicker">AROUND THE WORLD</span>
      <h1>环球大富翁</h1>
      <div className="setup-mode-tabs"><button className={mode === 'local' ? 'is-active' : ''} onClick={() => setMode('local')}>本地多人</button><button className={mode === 'remote' ? 'is-active' : ''} onClick={() => setMode('remote')}>远程联机</button></div>
      {mode === 'local' ? <>
      <div className="setup-heading"><Users size={19} /><strong>玩家设置</strong><span>{names.length} 人</span></div>
      <div className="name-list">
        {names.map((name, index) => <label key={index}>
          <i style={{ background: ['#d94b3d', '#e2a72c', '#3f83b3', '#34845d'][index] }}>{index + 1}</i>
          <input value={name} maxLength={10} onChange={(event) => updateName(index, event.target.value)} aria-label={`玩家 ${index + 1} 昵称`} />
        </label>)}
      </div>
      <div className="setup-actions">
        <button className="icon-button" onClick={() => setNames(names.slice(0, -1))} disabled={names.length <= 2} title="减少玩家"><Minus /></button>
        <button className="icon-button" onClick={() => setNames([...names, `玩家 ${names.length + 1}`])} disabled={names.length >= 4} title="增加玩家"><Plus /></button>
        <button className="primary-button" onClick={onStart} disabled={names.some((name) => !name.trim())}>开始游戏</button>
      </div>
      </> : <section className="remote-setup">
        {!remote ? <>
          <p>输入同一个房间名即可进入。第一位进入的玩家自动成为房主，至少 2 人才能开始。</p>
          <label>房间名<input value={roomName} maxLength={24} onChange={(event) => setRoomName(event.target.value)} /></label>
          <label>昵称<input value={remoteName} maxLength={10} placeholder="请输入昵称" onChange={(event) => setRemoteName(event.target.value)} /></label>
          <button className="primary-button remote-enter-button" onClick={() => onEnterRoom(roomName.trim(), remoteName.trim())} disabled={!roomName.trim() || !remoteName.trim()}><LogIn />进入房间</button>
        </> : <>
          <div className="room-header"><strong>{remote.roomName}</strong><b>{remote.players.length}/4</b></div>
          {remote?.status && <strong className={`remote-status ${remote.error ? 'is-error' : ''}`}>{remote.status}</strong>}
          <div className="room-members" aria-label="房间玩家">
            {remote.players.length === 0 ? <span className="room-placeholder">正在确认房间身份...</span> : remote.players.map((player) => <div className="room-member" key={player.playerId}><i>{player.playerId + 1}</i><strong>{player.name}</strong>{player.host && <span><Crown />房主</span>}</div>)}
          </div>
          {remote.role === 'host' && <button className="primary-button remote-enter-button" onClick={remote.onStart} disabled={!remote.ready}><Play />开始游戏</button>}
          {remote.role === 'guest' && <div className="room-waiting">已就位，等待房主开始游戏</div>}
          <button className="ghost-button leave-room-button" onClick={onLeaveRoom}><DoorOpen />离开房间</button>
        </>}
      </section>}
    </section>
  </main>;
}