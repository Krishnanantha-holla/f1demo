import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, expect, test, afterEach } from 'vitest';
import { FlipValue } from '../components/Shared';

afterEach(() => {
  vi.useRealTimers();
});

test('FlipValue swaps to the new value after the transition', () => {
  vi.useFakeTimers();
  const { rerender } = render(<FlipValue value="+0.300" />);
  expect(screen.getByText('+0.300')).toBeInTheDocument();
  rerender(<FlipValue value="+0.250" />);
  // Mid-transition, the old value is still shown.
  act(() => { vi.advanceTimersByTime(50); });
  expect(screen.getByText('+0.300')).toBeInTheDocument();
  // After the durationMs (default 160ms), the new value is shown.
  act(() => { vi.advanceTimersByTime(200); });
  expect(screen.getByText('+0.250')).toBeInTheDocument();
});

test('FlipValue is a no-op when the value does not change', () => {
  vi.useFakeTimers();
  const { rerender } = render(<FlipValue value="LEADER" />);
  rerender(<FlipValue value="LEADER" />);
  act(() => { vi.advanceTimersByTime(300); });
  expect(screen.getByText('LEADER')).toBeInTheDocument();
});
