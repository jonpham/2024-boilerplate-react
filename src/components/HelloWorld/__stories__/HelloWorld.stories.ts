import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';

import { HelloWorld } from '../HelloWorld';

const meta = {
  title: 'Pages/HelloWorld',
  component: HelloWorld,
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: 'fullscreen',
  },
} satisfies Meta<typeof HelloWorld>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on interaction testing: https://storybook.js.org/docs/writing-tests/interaction-testing
export const Exists: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const el = canvas.getByText(/HelloWorld/i, { selector: 'div' });
    await expect(el).toBeVisible();
  },
};
