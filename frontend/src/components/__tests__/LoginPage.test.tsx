import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginPage } from '../LoginPage';

// Mock the AsciiScene component to avoid Three.js issues in tests
vi.mock('../AsciiScene', () => ({
  AsciiScene: () => <div data-testid="ascii-scene-mock">ASCII Scene Mock</div>,
}));

describe('LoginPage', () => {
  const mockOnConnect = vi.fn();

  beforeEach(() => {
    mockOnConnect.mockClear();
  });

  it('renders welcome message', () => {
    render(<LoginPage onConnect={mockOnConnect} connecting={false} />);
    
    expect(screen.getByText('Welcome!')).toBeInTheDocument();
  });

  it('renders Telegram login option', () => {
    render(<LoginPage onConnect={mockOnConnect} connecting={false} />);
    
    expect(screen.getByText('Telegram')).toBeInTheDocument();
  });

  it('renders PassKey login option', () => {
    render(<LoginPage onConnect={mockOnConnect} connecting={false} />);
    
    expect(screen.getByText('PassKey')).toBeInTheDocument();
  });

  it('renders Web3Wallet login option', () => {
    render(<LoginPage onConnect={mockOnConnect} connecting={false} />);
    
    expect(screen.getByText('Web3Wallet')).toBeInTheDocument();
  });

  it('renders connect wallet button', () => {
    render(<LoginPage onConnect={mockOnConnect} connecting={false} />);
    
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('calls onConnect when connect wallet button is clicked', () => {
    render(<LoginPage onConnect={mockOnConnect} connecting={false} />);
    
    const connectButton = screen.getByText('Connect Wallet');
    fireEvent.click(connectButton);
    
    expect(mockOnConnect).toHaveBeenCalledTimes(1);
  });

  it('shows connecting state when connecting is true', () => {
    render(<LoginPage onConnect={mockOnConnect} connecting={true} />);
    
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('disables button when connecting', () => {
    render(<LoginPage onConnect={mockOnConnect} connecting={true} />);
    
    const connectButton = screen.getByText('Connecting...');
    expect(connectButton.closest('button')).toBeDisabled();
  });

  it('renders the login page container', () => {
    const { container } = render(<LoginPage onConnect={mockOnConnect} connecting={false} />);
    
    const loginPage = container.querySelector('.login-page');
    expect(loginPage).toBeInTheDocument();
  });

  it('renders feature carousel with Community Governance', () => {
    render(<LoginPage onConnect={mockOnConnect} connecting={false} />);
    
    expect(screen.getByText('Community Governance')).toBeInTheDocument();
  });

  it('renders the OR divider', () => {
    render(<LoginPage onConnect={mockOnConnect} connecting={false} />);
    
    expect(screen.getByText('OR')).toBeInTheDocument();
  });

  it('renders login options container', () => {
    const { container } = render(<LoginPage onConnect={mockOnConnect} connecting={false} />);
    
    const loginOptions = container.querySelector('.login-options');
    expect(loginOptions).toBeInTheDocument();
  });
});











