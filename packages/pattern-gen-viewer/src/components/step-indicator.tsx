import './step-indicator.css';

export type AppStep = 'background' | 'compose';

interface StepIndicatorProps {
  currentStep: AppStep;
  onStepChange: (step: AppStep) => void;
}

const STEPS: { key: AppStep; number: number; label: string }[] = [
  { key: 'background', number: 1, label: 'Background' },
  { key: 'compose', number: 2, label: 'Compose' },
];

export function StepIndicator({ currentStep, onStepChange }: StepIndicatorProps) {
  return (
    <div className="step-indicator">
      <div className="step-indicator-track">
        {STEPS.map((step, i) => (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && <div className="step-indicator-connector" />}
            <button
              className={`step-indicator-item${currentStep === step.key ? ' active' : ''}`}
              onClick={() => onStepChange(step.key)}
            >
              <span className="step-indicator-number">{step.number}</span>
              <span>{step.label}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
