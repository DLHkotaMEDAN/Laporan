import { supabase } from '@/lib/supabase';

export type AuditAction = 'LOGIN' | 'LOGOUT' | 'VIEW' | 'INTERACT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'PRINT';
export type EntityType = 'AUTH' | 'PAGE' | 'REPORT' | 'WORK_PLAN' | 'FUEL_REPORT' | 'OVERTIME' | 'SPJ_OLI' | 'PROFILE' | 'SETTINGS' | 'STORAGE' | string;

export type AuditLog = {
  id: string;
  user_id: string | null;
  username: string | null;
  user_email: string | null;
  role: string | null;
  action: AuditAction;
  entity_type: EntityType;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

/** Serialize roles array to comma-separated string for audit_logs.role column. */
const serializeRoles = (roles: string[] | null | undefined): string | null =>
  roles && roles.length > 0 ? roles.join(',') : null;

export const auditLogService = {
  async logAction(params: {
    action: AuditAction;
    entityType: EntityType;
    entityId?: string;
    details: any;
    userId: string;
    username?: string | null;
    userEmail?: string | null;
    role?: string | null;
  }) {
    try {
      let userEmail = params.userEmail || null;
      let role = params.role || null;
      if (!userEmail || !role) {
        const { data: { user } } = await supabase.auth.getUser();
        userEmail ||= user?.email || null;
        if (!role && user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, roles')
            .eq('id', user.id)
            .maybeSingle();
          role = serializeRoles(profile?.roles) || profile?.role || null;
        }
      }
      const payload = {
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        details: params.details,
        user_id: params.userId,
        username: params.username || params.userEmail || 'User',
        user_email: userEmail,
        role,
      };
      const { error } = await supabase
        .from('audit_logs')
        .insert([payload]);

      if (error) {
        // Kompatibilitas dengan audit_logs lama sebelum migration kolom
        // user_email/role dijalankan di Supabase.
        const isMissingExtendedColumn = /user_email|role|column|schema cache/i.test(error.message || '');
        if (isMissingExtendedColumn) {
          const { user_email: _userEmail, role: _role, ...legacyPayload } = payload;
          const { error: legacyError } = await supabase.from('audit_logs').insert([legacyPayload]);
          if (!legacyError) return;
          console.error("Gagal mencatat log versi lama:", legacyError);
        } else {
          console.error("Gagal mencatat log:", error);
        }
      }
    } catch (e) {
      console.error("Error audit log:", e);
    }
  },

  async logCurrentUser(params: {
    action: AuditAction;
    entityType: EntityType;
    entityId?: string;
    details?: Record<string, unknown>;
    // Parameter opsional — jika disediakan, skip query DB
    userId?: string;
    username?: string | null;
    userEmail?: string | null;
    role?: string | null;
  }) {
    // Jika data user sudah disediakan oleh pemanggil, skip query DB
    if (params.userId) {
      return auditLogService.logAction({
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: params.details || {},
        userId: params.userId,
        username: params.username || params.userEmail || 'User',
        userEmail: params.userEmail || null,
        role: params.role || null,
      });
    }

    // Fallback: ambil dari DB jika data tidak disediakan (untuk pemanggil dari services)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, role, roles')
      .eq('id', user.id)
      .maybeSingle();

    return auditLogService.logAction({
      ...params,
      details: params.details || {},
      userId: user.id,
      username: profile?.username || user.email || 'User',
      userEmail: user.email,
      role: serializeRoles(profile?.roles) || profile?.role || null,
    });
  },

  async getLogs(
    filters?: {
      action?: string;
      entityType?: string;
      userId?: string;
      search?: string;
      /** Jumlah maksimum baris yang dikembalikan. Default 500. */
      limit?: number;
      /** Offset baris untuk paginasi. Default 0. */
      offset?: number;
    }
  ) {
    const limit = filters?.limit ?? 500;
    const offset = filters?.offset ?? 0;

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters?.action && filters.action !== 'ALL') query = query.eq('action', filters.action);
    if (filters?.entityType && filters.entityType !== 'ALL') query = query.eq('entity_type', filters.entityType);
    if (filters?.userId && filters.userId !== 'ALL') query = query.eq('user_id', filters.userId);
    if (filters?.search?.trim()) query = query.ilike('username', `%${filters.search.trim()}%`);

    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  },

  async deleteOldLogs() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { error } = await supabase
      .from('audit_logs')
      .delete()
      .lt('created_at', sevenDaysAgo.toISOString());
      
    if (error) throw error;
  },

  async deleteAllLogs() {
    // Menggunakan filter yang lebih universal (menghapus semua yang ID-nya tidak null)
    const { error } = await supabase
      .from('audit_logs')
      .delete()
      .not('id', 'is', null);
      
    if (error) {
      console.error("Database error saat hapus log:", error);
      throw new Error(error.message);
    }
  }
};
