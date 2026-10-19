import { describe, it, expect } from 'vitest';
import {
  isSuperAdminAccess,
  isPimpinanAccess,
  isSpjOliAdmin,
  canAccessAllSpjOliRegions,
  canAccessAllSpjOliRoles,
} from '@/constants/access-control';

describe('Authorization Tests - Role-Based Access Control', () => {
  describe('Super Admin Access', () => {
    it('should grant super admin access', () => {
      expect(isSuperAdminAccess('admin')).toBe(true);
      expect(isSuperAdminAccess('pimpinan')).toBe(false);
      expect(isSuperAdminAccess('laporan')).toBe(false);
    });
  });

  describe('Pimpinan Access', () => {
    it('should grant pimpinan access', () => {
      expect(isPimpinanAccess('pimpinan')).toBe(true);
      expect(isPimpinanAccess('admin')).toBe(false);
      expect(isPimpinanAccess('laporan')).toBe(false);
    });
  });

  describe('SPJ Oli Admin Access', () => {
    it('should grant SPJ oli admin access', () => {
      expect(isSpjOliAdmin('admin_spj_oli')).toBe(true);
      expect(isSpjOliAdmin('spj_oli')).toBe(false);
      expect(isSpjOliAdmin('admin')).toBe(false);
    });
  });

  describe('SPJ Oli Regional Access', () => {
    it('should grant all region access to admin_spj_oli', () => {
      expect(canAccessAllSpjOliRegions('admin_spj_oli')).toBe(true);
      expect(canAccessAllSpjOliRegions('spj_oli')).toBe(false);
    });

    it('should grant all role access to admin_spj_oli and spj_oli', () => {
      expect(canAccessAllSpjOliRoles('admin_spj_oli')).toBe(true);
      expect(canAccessAllSpjOliRoles('spj_oli')).toBe(true);
    });
  });
});

