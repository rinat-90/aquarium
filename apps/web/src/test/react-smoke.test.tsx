import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

function AquariumStatus({ fishCount }: { fishCount: number }) {
  return <output aria-label="fish count">{fishCount} fish</output>;
}

describe('React testing environment', () => {
  it('renders typed props into the DOM', () => {
    render(<AquariumStatus fishCount={3} />);
    expect(screen.getByRole('status', { name: 'fish count' })).toHaveTextContent('3 fish');
  });
});
