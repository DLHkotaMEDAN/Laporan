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

    const input = await request.json() as CreateUserInput | ResetPasswordInput;
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
    if (['admin_wilayah', 'admin_harian', 'admin_rencana_kerja'].includes(input.role) && !input.regionId) {
      throw new Error('Admin berbasis wilayah wajib memiliki wilayah.');
    }

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
