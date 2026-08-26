import { supabase } from '@/lib/supabase';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';
export type EntityType = 'REPORT' | 'WORK_PLAN';

export const auditLogService = {
  async logAction(params: {
    action: AuditAction;
    entityType: EntityType;
    entityId?: string;
    details: any;
    userId: string;
    username: string;
  }) {
    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert([{
          action: params.action,
          entity_type: params.entityType,
          entity_id: params.entityId,
          details: params.details,
          user_id: params.userId,
          username: params.username
        }]);
      
      if (error) console.error("Gagal mencatat log:", error);
    } catch (e) {
      console.error("Error audit log:", e);
    }
  },

  async getLogs() {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    
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