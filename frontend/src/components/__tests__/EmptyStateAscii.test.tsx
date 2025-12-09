import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyStateAscii } from '../EmptyStateAscii';

describe('EmptyStateAscii', () => {
  it('renders title correctly', () => {
    render(<EmptyStateAscii title="No disputes found" subtitle="There are no disputes at the moment." />);
    
    expect(screen.getByText('No disputes found')).toBeInTheDocument();
  });

  it('renders subtitle correctly', () => {
    render(<EmptyStateAscii title="No disputes found" subtitle="There are no disputes at the moment." />);
    
    expect(screen.getByText('There are no disputes at the moment.')).toBeInTheDocument();
  });

  it('renders the community icon SVG', () => {
    const { container } = render(
      <EmptyStateAscii title="Test" subtitle="Test subtitle" />
    );
    
    const svg = container.querySelector('.empty-state-icon');
    expect(svg).toBeInTheDocument();
  });

  it('has correct CSS class applied', () => {
    const { container } = render(
      <EmptyStateAscii title="Test" subtitle="Test subtitle" />
    );
    
    const wrapper = container.querySelector('.empty-state-ascii');
    expect(wrapper).toBeInTheDocument();
  });
});











