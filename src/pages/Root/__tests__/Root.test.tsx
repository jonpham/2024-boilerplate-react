import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@/testing/utility';

import { Root } from '../Root';

// Test Utility
const getCountButtonEl = () => {
  return screen.getByRole('button', { name: /count is \d+/ });
};

const extractCountFromButtonText = (buttonEl: HTMLElement): number | null => {
  const countValueString = buttonEl.textContent?.match(/\d+$/);

  return countValueString ? parseInt(countValueString[0], 10) : null;
};

describe('RootPage', () => {
  it('should have header with Vitest and React', () => {
    // Arrange / Given a Setup
    render(<Root />);
    const header = screen.queryByText('Vite + React');
    // Assert on Expectations
    expect(header).not.toBeNull();
  });

  it('should have a counter button', () => {
    // Arrange / Given a Setup
    render(<Root />);
    const countButton = screen.getByRole('button', {
      name: /count is \d+/,
    });
    // Assert on Expectations
    expect(countButton).not.toBeNull();
    expect(extractCountFromButtonText(getCountButtonEl())).toEqual(0);
  });

  describe('counter behavior', () => {
    it('should iterate count by 1 on click', async () => {
      // Arrange / Given a Setup
      const { user } = render(<Root />);

      const countButton = getCountButtonEl();
      // When act occurs
      await user.click(countButton);
      // Assert on Expectations
      expect(extractCountFromButtonText(getCountButtonEl())).toEqual(1);
    });
  });
});
