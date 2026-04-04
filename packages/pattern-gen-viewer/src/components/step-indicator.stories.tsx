import { useState } from 'react';
import { StepIndicator } from './step-indicator';
import type { AppStep } from './step-indicator';

export const meta = { title: 'UI/StepIndicator' };

export const BackgroundStep = () => {
  const [step, setStep] = useState<AppStep>('background');
  return (
    <div style={{ position: 'relative', height: 60 }}>
      <StepIndicator currentStep={step} onStepChange={setStep} />
    </div>
  );
};

export const ComposeStep = () => {
  const [step, setStep] = useState<AppStep>('compose');
  return (
    <div style={{ position: 'relative', height: 60 }}>
      <StepIndicator currentStep={step} onStepChange={setStep} />
    </div>
  );
};
