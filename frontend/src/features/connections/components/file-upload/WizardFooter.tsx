import React from "react";
import { Button } from "../../../../components/ui/Button";

interface WizardFooterProps {
  step: 1 | 2 | 3 | 4;
  ingesting: boolean;
  ingestionFailed: boolean;
  ingestionFinished: boolean;
  onPrevStep: () => void;
  onNextStep: () => void;
  onRequestClose: () => void;
  onRetry: () => void;
  onDone: () => void;
}

export const WizardFooter: React.FC<WizardFooterProps> = ({
  step,
  ingesting,
  ingestionFailed,
  ingestionFinished,
  onPrevStep,
  onNextStep,
  onRequestClose,
  onRetry,
  onDone,
}) => {
  return (
    <div className="shrink-0 px-6 py-3.5 border-t border-border bg-surface flex flex-wrap items-center justify-between gap-3 select-none">
      <div>
        {step > 1 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={ingesting}
            onClick={onPrevStep}
          >
            Previous step
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={ingesting}
          onClick={onRequestClose}
        >
          Cancel
        </Button>

        {step < 4 && step > 1 && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onNextStep}
          >
            Next step
          </Button>
        )}

        {step === 4 && ingestionFailed && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onRetry}
          >
            Retry ingestion
          </Button>
        )}

        {step === 4 && ingestionFinished && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onDone}
          >
            Done
          </Button>
        )}
      </div>
    </div>
  );
};
