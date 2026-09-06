import { render, screen } from '@testing-library/react';
import App from './App';

// Smoke test: the app mounts and the landing page renders its heading.
// (Replaces the default Create React App "learn react" boilerplate test,
// which never matched this application.)
test('renders the landing page without crashing', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', { name: /toll management system/i })
  ).toBeInTheDocument();
});
