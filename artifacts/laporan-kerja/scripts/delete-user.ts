import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey);

async function deleteUserByEmail(email: string) {
  try {
    // List users to find the one with this email
    const { data, error } = await adminClient.auth.admin.listUsers();
    if (error) throw error;

    const user = data.users.find(u => u.email === email.toLowerCase());
    if (!user) {
      console.log(`User with email ${email} not found`);
      return;
    }

    console.log(`Found user: ${user.id} (${user.email})`);

    // Delete from auth
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteAuthError) throw deleteAuthError;

    // Delete from profiles
    const { error: deleteProfileError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', user.id);
    if (deleteProfileError) {
      console.warn('Profile deletion error (user may not have profile):', deleteProfileError.message);
    }

    console.log(`User ${email} deleted successfully`);
  } catch (error) {
    console.error('Error deleting user:', error);
    process.exit(1);
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node delete-user.ts <email>');
  process.exit(1);
}

deleteUserByEmail(email);
