import { useI18n } from '../i18n.ts';
import './UserGuide.css';

interface UserGuideProps {
  onClose: () => void;
}

export default function UserGuide({ onClose }: UserGuideProps) {
  const { t } = useI18n();

  const steps = [
    { title: t('guide.step1Title'), desc: t('guide.step1Desc') },
    { title: t('guide.step2Title'), desc: t('guide.step2Desc') },
    { title: t('guide.step3Title'), desc: t('guide.step3Desc') },
    { title: t('guide.step4Title'), desc: t('guide.step4Desc') },
    { title: t('guide.supportedFormats'), desc: t('guide.formatsDesc') },
  ];

  return (
    <div className="guide-overlay" onClick={onClose}>
      <div className="guide-modal" onClick={(e) => e.stopPropagation()}>
        <div className="guide-modal__header">
          <h2 className="guide-modal__title">{t('guide.title')}</h2>
          <button className="btn btn--small guide-modal__close" onClick={onClose}>
            {t('guide.close')}
          </button>
        </div>
        <div className="guide-modal__body">
          {steps.map((step) => (
            <div className="guide-step" key={step.title}>
              <h3 className="guide-step__title">{step.title}</h3>
              <p className="guide-step__desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
