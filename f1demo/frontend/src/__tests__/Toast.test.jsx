import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, expect, test, afterEach } from 'vitest';
import ToastHost, { toast } from '../components/Toast';

afterEach(() => {
  vi.useRealTimers();
});

test('toast appears, then auto-dismisses after ~4.5s', () => {
  vi.useFakeTimers();
  render(<ToastHost />);
  act(() => { toast.success('Saved!'); });
  expect(screen.getByText('Saved!')).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(5000); });
  expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
});

test('toast is dismissible via the close button', () => {
  vi.useFakeTimers();
  const { container } = render(<ToastHost />);
  act(() => { toast.error('Boom'); });
  expect(screen.getByText('Boom')).toBeInTheDocument();
  const closeBtn = container.querySelector('.toast-close');
  act(() => { closeBtn.click(); });
  expect(screen.queryByText('Boom')).not.toBeInTheDocument();
});
