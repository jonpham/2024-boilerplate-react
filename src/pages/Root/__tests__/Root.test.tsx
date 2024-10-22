import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Root } from '../Root';

describe('RootPage', () => {
    it('should have header with Vitest and React', async () => {
        // Setup
        render(<Root />);
        const h1 = await screen.queryByText('Vite + React');

        // Expectations
        expect(h1).not.toBeNull();
    });
});