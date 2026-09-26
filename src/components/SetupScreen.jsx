import { Minus, Plus, Users } from 'lucide-react';

export default function SetupScreen({ names, setNames, onStart }) {
  const updateName = (index, value) => setNames(names.map((name, itemIndex) => itemIndex === index ? value : name));
  return <main className="setup-page">
    <section className="setup-panel">
      <span className="kicker">AROUND THE WORLD</span>
      <h1>环球大富翁</h1>
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
    </section>
  </main>;
}