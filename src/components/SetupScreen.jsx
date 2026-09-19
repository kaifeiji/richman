import { useState } from 'react';
import { Minus, Plus, Users } from 'lucide-react';

export default function SetupScreen({ names, setNames, onStart, onHost, onJoin, remote }) {
  const [mode, setMode] = useState('local');
  const [remoteAction, setRemoteAction] = useState('choose');
  const [roomName, setRoomName] = useState('家庭房间');
  const [remoteName, setRemoteName] = useState('玩家 1');
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
        <p>输入相同房间名即可相遇，房主开始游戏。</p>
        {!remote && remoteAction === 'choose' && <><label>房间名<input value={roomName} maxLength={24} onChange={(event) => setRoomName(event.target.value)} /></label><label>昵称<input value={remoteName} maxLength={10} onChange={(event) => setRemoteName(event.target.value)} /></label><div className="remote-choices"><button className="primary-button" onClick={() => { setRemoteAction('host'); onHost(roomName, remoteName); }} disabled={!roomName.trim() || !remoteName.trim()}>创建房间</button><button className="ghost-button" onClick={() => { setRemoteAction('join'); setRemoteName('玩家 2'); }}>加入房间</button></div></>}
        {!remote && remoteAction === 'join' && <>
          <label>房间名<input value={roomName} maxLength={24} onChange={(event) => setRoomName(event.target.value)} /></label>
          <label>昵称<input value={remoteName} maxLength={10} onChange={(event) => setRemoteName(event.target.value)} /></label>
          <button className="primary-button" onClick={() => onJoin(roomName, remoteName)} disabled={!roomName.trim() || !remoteName.trim()}>加入房间</button>
          <button className="ghost-button" onClick={() => setRemoteAction('choose')}>返回</button>
        </>}
        {remote?.role === 'host' && <button className="primary-button" onClick={remote.onStart} disabled={!remote.ready}>开始游戏</button>}
        {remote?.status && <strong className="remote-status">{remote.status}</strong>}
      </section>}
    </section>
  </main>;
}