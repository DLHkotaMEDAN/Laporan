import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type CreateUserInput = {
  email: string;
  password: string;
  username: string;
  role: string;
  regionId?: string | null;
  teamId?: string | null;
};

type ResetPasswordInput = {
  action: 'reset-password';
  userId: string;
  password: string;
};

type GetUserDetailsInput = {
  action: 'get-user-details';
  userId: string;
};

type ListUserEmailsInput = {
  action: 'list-user-emails';
};

const USER_ROLES = {
  ADMIN: 'admin',
  ADMIN_WILAYAH: 'admin_wilayah',
  LAPORAN: 'laporan',
  ADMIN_HARIAN: 'admin_harian',
  ADMIN_LAPORAN_MINGGUAN: 'admin_laporan_mingguan',
  ADMIN_LAPORAN_BULANAN: 'admin_laporan_bulanan',
  ADMIN_LAPORAN_MINGGUAN_BULANAN: 'admin_laporan_mingguan_bulanan',
  ADMIN_LAPORAN_HARIAN_MINGGUAN: 'admin_laporan_harian_mingguan',
  ADMIN_LAPORAN_HARIAN_BULANAN: 'admin_laporan_harian_bulanan',
  ADMIN_LAPORAN_HARIAN_RENCANA_KERJA: 'admin_laporan_harian_rencana_kerja',
  ADMIN_LAPORAN_MINGGUAN_RENCANA_KERJA: 'admin_laporan_mingguan_rencana_kerja',
  ADMIN_LAPORAN_BULANAN_RENCANA_KERJA: 'admin_laporan_bulanan_rencana_kerja',
  ADMIN_RENCANA_KERJA: 'admin_rencana_kerja',
  ADMIN_BBM: 'admin_bbm',
  ADMIN_SPJ_BBM: 'admin_spj_bbm',
  PIMPINAN: 'pimpinan',
  USER: 'user',
} as const;

const validRoles = new Set(Object.values(USER_ROLES));
const regionRequiredRoles = new Set([
  USER_ROLES.ADMIN_WILAYAH,
  USER_ROLES.LAPORAN,
  USER_ROLES.ADMIN_HARIAN,
  USER_ROLES.ADMIN_LAPORAN_HARIAN_RENCANA_KERJA,
  USER_ROLES.ADMIN_LAPORAN_MINGGUAN_RENCANA_KERJA,
  USER_ROLES.ADMIN_LAPORAN_BULANAN_RENCANA_KERJA,
  USER_ROLES.ADMIN_RENCANA_KERJA,
  USER_ROLES.ADMIN_BBM,
  USER_ROLES.USER,
]);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) throw new Error('Sesi login tidak ditemukan.');

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error('Sesi login tidak valid.');

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const { data: callerProfile, error: callerError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();
    if (callerError || callerProfile?.role !== 'admin') throw new Error('Hanya Super Admin yang dapat membuat akun.');

    const input = await request.json() as CreateUserInput | ResetPasswordInput | GetUserDetailsInput | ListUserEmailsInput;
    if ('action' in input && input.action === 'list-user-emails') {
      const users: { id: string; email: string | undefined }[] = [];
      const perPage = 1000;
      let page = 1;

      while (true) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        users.push(...data.users.map(user => ({ id: user.id, email: user.email })));
        if (data.users.length < perPage) break;
        page += 1;
      }

      return Response.json({ users }, { headers: corsHeaders });
    }
    if ('action' in input && input.action === 'get-user-details') {
      if (!input.userId) throw new Error('ID pengguna wajib diisi.');
      const { data, error } = await adminClient.auth.admin.getUserById(input.userId);
      if (error || !data.user) throw error ?? new Error('Akun tidak ditemukan.');

      return Response.json({
        id: data.user.id,
        email: data.user.email,
        createdAt: data.user.created_at,
        lastSignInAt: data.user.last_sign_in_at,
        emailConfirmedAt: data.user.email_confirmed_at,
      }, { headers: corsHeaders });
    }
    if ('action' in input && input.action === 'reset-password') {
      if (!input.userId || !input.password) throw new Error('ID pengguna dan password baru wajib diisi.');
      if (input.password.length < 8) throw new Error('Password minimal 8 karakter.');

      const { error: passwordError } = await adminClient.auth.admin.updateUserById(input.userId, {
        password: input.password,
      });
      if (passwordError) throw passwordError;

      return Response.json({ id: input.userId }, { headers: corsHeaders });
    }

    if (!input.email || !input.password || !input.username || !input.role) throw new Error('Data akun belum lengkap.');
    if (input.password.length < 8) throw new Error('Password minimal 8 karakter.');
    if (!validRoles.has(input.role)) throw new Error('Hak akses tidak valid.');
    if (regionRequiredRoles.has(input.role) && !input.regionId) {
      throw new Error('Admin berbasis wilayah wajib memiliki wilayah.');
    }
    if (input.role === USER_ROLES.USER && !input.teamId) throw new Error('Pengguna tim wajib memiliki tim.');

    if (input.regionId) {
      const { data: region } = await adminClient.from('regions').select('id').eq('id', input.regionId).eq('is_active', true).maybeSingle();
      if (!region) throw new Error('Wilayah tidak valid.');
    }
    if (input.teamId) {
      const { data: team } = await adminClient.from('teams').select('id, region_id').eq('id', input.teamId).eq('is_active', true).maybeSingle();
      if (!team || (input.regionId && team.region_id !== input.regionId)) throw new Error('Tim tidak sesuai dengan wilayah.');
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      email_confirm: true,
    });
    if (createError || !created.user) throw createError ?? new Error('Akun gagal dibuat.');

    const { error: profileError } = await adminClient.from('profiles').upsert({
      id: created.user.id,
      username: input.username.trim(),
      role: input.role,
      region_id: input.regionId ?? null,
      team_id: input.teamId ?? null,
      updated_at: new Date().toISOString(),
    });
    if (profileError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      throw profileError;
    }

    return Response.json({ id: created.user.id, email: created.user.email }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Terjadi kesalahan.' }, { status: 400, headers: corsHeaders });
  }
});
