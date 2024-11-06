import { render } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

const setupDomTest = (jsx: JSX.Element) => ({
  screen,
  user: userEvent.setup(),
  ...render(jsx),
});

export default setupDomTest;
