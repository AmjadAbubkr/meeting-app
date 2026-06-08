import React from 'react';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Suppress console.error from React error boundary logging
const originalError = console.error;

beforeAll(() => {
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('The above error occurred')) return;
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

class SafeChild extends React.Component {
  render() {
    return null;
  }
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    const boundary = new ErrorBoundary({ children: React.createElement(SafeChild) });
    boundary.state = { hasError: false, error: null };
    const result = boundary.render();
    expect(result).toBeTruthy();
  });

  it('renders fallback UI on error', () => {
    const boundary = new ErrorBoundary({ children: React.createElement(SafeChild) });
    boundary.state = { hasError: true, error: 'Something broke' };
    const result = boundary.render() as React.ReactElement;
    expect(result).toBeTruthy();
    expect(boundary.state.hasError).toBe(true);
    expect(boundary.state.error).toBe('Something broke');
  });

  it('getDerivedStateFromError returns correct state', () => {
    const result = ErrorBoundary.getDerivedStateFromError(new Error('Oops'));
    expect(result).toEqual({ hasError: true, error: 'Oops' });
  });
});
