import React from "react";
import FacialLivenessModal, { FacialLivenessModalProps } from "./FacialLivenessModal";

export { default as FacialLivenessModal } from "./FacialLivenessModal";
export type { FacialLivenessModalProps } from "./FacialLivenessModal";

export interface FaceLivenessModalProps extends FacialLivenessModalProps {
  onVerified?: (res: any) => void;
  onFallback?: (res: any) => void;
}

export default function FaceLivenessModal(props: FaceLivenessModalProps) {
  const { onVerified, onSuccess, onResult, ...rest } = props;

  const handleSuccess = (res: any) => {
    if (onSuccess) onSuccess(res);
    if (onVerified) onVerified(res);
  };

  const handleResult = (res: any) => {
    if (onResult) onResult(res);
  };

  return <FacialLivenessModal {...rest} onSuccess={handleSuccess} onResult={handleResult} />;
}
