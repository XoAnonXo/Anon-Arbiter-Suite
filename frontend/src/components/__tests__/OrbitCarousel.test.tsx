import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrbitCarousel } from '../OrbitCarousel';

describe('OrbitCarousel', () => {
  it('renders the first dispute title', () => {
    render(<OrbitCarousel />);
    
    expect(screen.getByText('Real Madrid vs Barcelona')).toBeInTheDocument();
  });

  it('renders AMM Market label', () => {
    render(<OrbitCarousel />);
    
    expect(screen.getByText('AMM Market')).toBeInTheDocument();
  });

  it('renders Awaits Resolution status', () => {
    render(<OrbitCarousel />);
    
    expect(screen.getByText('Awaits Resolution')).toBeInTheDocument();
  });

  it('renders Vote button', () => {
    render(<OrbitCarousel />);
    
    expect(screen.getByText('Vote')).toBeInTheDocument();
  });

  it('calls onVoteClick when Vote button is clicked', () => {
    const mockOnVoteClick = vi.fn();
    render(<OrbitCarousel onVoteClick={mockOnVoteClick} />);
    
    const voteButton = screen.getByText('Vote');
    fireEvent.click(voteButton);
    
    expect(mockOnVoteClick).toHaveBeenCalledTimes(1);
  });

  it('renders navigation buttons', () => {
    const { container } = render(<OrbitCarousel />);
    
    const navButtons = container.querySelectorAll('.orbit-nav-btn');
    expect(navButtons.length).toBe(2); // Previous and Next buttons
  });

  it('renders orbit ring', () => {
    const { container } = render(<OrbitCarousel />);
    
    const ring = container.querySelector('.orbit-ring');
    expect(ring).toBeInTheDocument();
  });

  it('renders orbiting items', () => {
    const { container } = render(<OrbitCarousel />);
    
    const orbitItems = container.querySelectorAll('.orbit-item');
    expect(orbitItems.length).toBe(8); // 8 dispute items
  });

  it('renders center card', () => {
    const { container } = render(<OrbitCarousel />);
    
    const centerCard = container.querySelector('.orbit-center-card');
    expect(centerCard).toBeInTheDocument();
  });

  it('renders Anon logo in orbiting items', () => {
    const { container } = render(<OrbitCarousel />);
    
    const svgs = container.querySelectorAll('.orbit-item svg');
    expect(svgs.length).toBe(8);
  });
});











