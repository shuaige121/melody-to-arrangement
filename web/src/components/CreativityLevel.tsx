import './CreativityLevel.css';

export type CreativityLevelValue = 'conservative' | 'balanced' | 'creative';

interface CreativityLevelProps {
  level: CreativityLevelValue;
  onChange: (level: CreativityLevelValue) => void;
}

const CREATIVITY_OPTIONS: Array<{
  value: CreativityLevelValue;
  icon: string;
  title: string;
  description: string;
  descriptionZh: string;
  modeHint: string;
}> = [
  {
    value: 'conservative',
    icon: '\u{1F3AF}',
    title: '保守 Conservative',
    description: 'Follows music theory strictly. Most predictable and safe results.',
    descriptionZh: '严格遵循乐理规则。最可预测、最稳定的编曲结果。',
    modeHint: 'Python 生成大部分，LLM 只做选择',
  },
  {
    value: 'balanced',
    icon: '\u2696\uFE0F',
    title: '平衡 Balanced',
    description: 'Music theory guided with creative touches. Best of both worlds.',
    descriptionZh: '乐理框架内适度创新。兼顾规则与创意。',
    modeHint: 'LLM 在乐理框架内有创作空间',
  },
  {
    value: 'creative',
    icon: '\u{1F3A8}',
    title: '开放 Creative',
    description: 'Maximum creative freedom. May surprise you with unique ideas.',
    descriptionZh: '最大创作自由度。可能产生意想不到的独特编曲。',
    modeHint: 'LLM 自由创作，但遵守用户约束',
  },
];

export default function CreativityLevel({ level, onChange }: CreativityLevelProps) {
  return (
    <section className="creativity-level" aria-label="Creativity Level">
      <div className="creativity-level__grid" role="group" aria-label="Creativity options">
        {CREATIVITY_OPTIONS.map((option) => {
          const isActive = level === option.value;
          return (
            <button
              type="button"
              key={option.value}
              className={`creativity-level__card ${isActive ? 'creativity-level__card--active' : ''}`}
              onClick={() => onChange(option.value)}
              aria-pressed={isActive}
            >
              <span className="creativity-level__icon" aria-hidden="true">{option.icon}</span>
              <span className="creativity-level__title">{option.title}</span>
              <span className="creativity-level__description">{option.description}</span>
              <span className="creativity-level__description creativity-level__description--zh">{option.descriptionZh}</span>
              <span className="creativity-level__hint">{option.modeHint}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
