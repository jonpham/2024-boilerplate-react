import { describe, expect, it } from 'vitest';
import { screen, render } from '@/testing/utility';

import { Root } from '../Root';

// Test Utility
const getCountButtonEl = async () => {
    return screen.getByRole('button', { name: /count is \d+/ });
}

const extractCountFromButtonText = (buttonEl: HTMLElement): number | null => {
    const countValueString = buttonEl.textContent?.match(/\d+$/);

    return countValueString ? parseInt(countValueString[0], 10) : null;
};

describe('RootPage', () => {
    it('should have header with Vitest and React', async () => {
        // Arrange / Given a Setup
        render(<Root />);
        const header = await screen.queryByText('Vite + React');
        // Assert on Expectations
        expect(header).not.toBeNull();
    });

    it('should have a counter button', async () => {
        // Arrange / Given a Setup
        render(<Root />);
        const countButton = await getCountButtonEl();
        // Assert on Expectations

        expect(countButton).toBeVisible();
        expect(extractCountFromButtonText(await getCountButtonEl())).toEqual(0);
    })

    describe('counter behavior', () => {
        it('should iterate count by 1 on click', async () => {
            // Arrange / Given a Setup
            const { user } = render(<Root />);

            const countButton = await getCountButtonEl();
            // When act occurs
            await user.click(countButton);
            // Assert on Expectations
            expect(extractCountFromButtonText(await getCountButtonEl())).toEqual(1);
        });
    });
});