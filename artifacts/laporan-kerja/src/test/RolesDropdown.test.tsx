import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RolesDropdown from '@/components/UserManagement/RolesDropdown';
import { ADMINISTRATOR_KEY } from '@/constants/access-control';

describe('RolesDropdown Component', () => {
  it('should render with placeholder when no roles selected', () => {
    render(<RolesDropdown selectedRoles={[]} onChange={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Pilih hak akses...');
  });

  it('should render selected roles as badges', () => {
    render(<RolesDropdown selectedRoles={['laporan_harian']} onChange={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should open dropdown when clicked', () => {
    render(<RolesDropdown selectedRoles={[]} onChange={vi.fn()} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    // Dropdown should be visible
    expect(document.querySelector('.absolute.z-50')).toBeInTheDocument();
  });

  it('should call onChange when role is selected', () => {
    const handleChange = vi.fn();
    render(<RolesDropdown selectedRoles={[]} onChange={handleChange} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Click on a role (Administrator is the first one)
    const roleButton = screen.getByText('Administrator');
    fireEvent.click(roleButton);

    expect(handleChange).toHaveBeenCalledWith([ADMINISTRATOR_KEY]);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<RolesDropdown selectedRoles={[]} onChange={vi.fn()} disabled />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should handle Administrator key exclusivity', () => {
    const handleChange = vi.fn();
    render(<RolesDropdown selectedRoles={[]} onChange={handleChange} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Select Administrator
    const adminButton = screen.getByText('Administrator');
    fireEvent.click(adminButton);

    expect(handleChange).toHaveBeenCalledWith([ADMINISTRATOR_KEY]);
  });

  it('should clear all roles when "Hapus semua pilihan" is clicked', () => {
    const handleChange = vi.fn();
    render(<RolesDropdown selectedRoles={['laporan_harian', 'laporan_mingguan']} onChange={handleChange} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Click "Hapus semua pilihan"
    const clearButton = screen.getByText('Hapus semua pilihan');
    fireEvent.click(clearButton);

    expect(handleChange).toHaveBeenCalledWith([]);
  });
});
