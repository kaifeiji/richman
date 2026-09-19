import { Building2, Check, KeyRound } from 'lucide-react';
import { money } from '../game/format';

export default function ActionFeedback({ feedback }) {
  const building = feedback.type === 'build';
  return <article className={`action-feedback feedback-${feedback.type}`}>
    <span className="feedback-icon">{building ? <Building2 /> : <KeyRound />}</span>
    <div><h2>{building ? `${feedback.name} 已盖 ${feedback.level} 层楼 ${money(feedback.amount)}` : `${feedback.name} 购买成功 ${money(feedback.amount)}`}</h2></div>
    <Check className="feedback-check" />
  </article>;
}
