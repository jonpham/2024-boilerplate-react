import { describe, expect, it } from 'vitest';
import { screen, render } from '@/testing/utility';

import { HelloWorld } from '../HelloWorld';

describe('HelloWorld', () => {
    it('should have text "HelloWorld"', async () => {
        // Arrange / Given a Setup
        render(<HelloWorld />);
        const text = await screen.queryByText('HelloWorld');
        // Assert on Expectations
        expect(text).not.toBeNull();
    });
});
