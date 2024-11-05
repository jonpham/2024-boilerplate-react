import * as jestDomMatchers from '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';

expect.extend(jestDomMatchers);

afterEach(() => {
    cleanup();
});
