import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';

import { Root } from '../Root';

const meta = {
  title: 'Pages/Root',
  component: Root,
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Root>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on interaction testing: https://storybook.js.org/docs/writing-tests/interaction-testing
export const Header: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByText(/Vite \+ React/i, { selector: 'h1' });
    await expect(header).toBeVisible();
    const countButton = canvas.getByRole('button', { name: /count is 0/ })
    await expect(countButton).toBeVisible();
    await expect(countButton).toBeEnabled();
    await userEvent.click(countButton);
    await expect(canvas.getByRole('button', { name: /count is 1/ })).toBeVisible();
  },
};
