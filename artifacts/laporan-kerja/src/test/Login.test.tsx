import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Login from '@/pages/Login';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
    },
  },
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    login: vi.fn(),
    session: null,
    profile: null,
  }),
}));

vi.mock('@/utils/toast', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Login Page - Basic Rendering', () => {
  it('should render login form', () => {
    renderWithRouter(<Login />);

    expect(screen.getByText('SISTEM LAPORAN')).toBeInTheDocument();
    expect(screen.getByText('Dinas Lingkungan Hidup Kota Medan')).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/kata sandi/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /masuk/i })).toBeInTheDocument();
  });

  it('should render username input with correct placeholder', () => {
    renderWithRouter(<Login />);

    const usernameInput = screen.getByLabelText(/username/i) as HTMLInputElement;
    expect(usernameInput.placeholder).toBe('Ketik username Anda');
  });

  it('should render password input with correct placeholder', () => {
    renderWithRouter(<Login />);

    const passwordInput = screen.getByLabelText(/kata sandi/i) as HTMLInputElement;
    expect(passwordInput.placeholder).toBe('Ketik kata sandi');
  });

  it('should render password input as type password by default', () => {
    renderWithRouter(<Login />);

    const passwordInput = screen.getByLabelText(/kata sandi/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');
  });
});
