'use client';
import FocusTrap from 'focus-trap-react';
import { ReactNode, useRef, useEffect, useCallback } from 'react';

interface FocusTrapDialogProps {
  isOpen: boolean;
  children: ReactNode;
  onDeactivate?: () => void;
}

export function FocusTrapDialog({ isOpen, children, onDeactivate }: FocusTrapDialogProps) {
  // Guard against React StrictMode double-mount/unmount cycle.
  // In dev mode, StrictMode unmounts and remounts components to test cleanup.
  // focus-trap-react calls onDeactivate during componentWillUnmount,
  // which would close the modal during the StrictMode re-mount cycle.
  const mountedRef = useRef(false);

  useEffect(() => {
    // After the first render, mark as mounted. In StrictMode, the first
    // mount+unmount cycle happens before this effect runs, so the guard
    // ref stays false during the problematic unmount.
    const timer = setTimeout(() => {
      mountedRef.current = true;
    }, 0);
    return () => {
      clearTimeout(timer);
      mountedRef.current = false;
    };
  }, []);

  const safeOnDeactivate = useCallback(() => {
    if (mountedRef.current && onDeactivate) {
      onDeactivate();
    }
  }, [onDeactivate]);

  if (!isOpen) return null;
  return (
    <FocusTrap
      focusTrapOptions={{
        escapeDeactivates: true,
        allowOutsideClick: true,
        onDeactivate: safeOnDeactivate,
        initialFocus: false,
        fallbackFocus: () => document.body,
      }}
    >
      <div>{children}</div>
    </FocusTrap>
  );
}
