'use client';
import FocusTrap from 'focus-trap-react';
import { ReactNode } from 'react';

interface FocusTrapDialogProps {
  isOpen: boolean;
  children: ReactNode;
  onDeactivate?: () => void;
}

export function FocusTrapDialog({ isOpen, children, onDeactivate }: FocusTrapDialogProps) {
  if (!isOpen) return null;
  return (
    <FocusTrap
      focusTrapOptions={{
        escapeDeactivates: true,
        allowOutsideClick: true,
        onDeactivate,
      }}
    >
      <div>{children}</div>
    </FocusTrap>
  );
}
