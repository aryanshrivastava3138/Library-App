import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Supabase Environment Check:');
console.log('URL Present:', !!supabaseUrl);
console.log('Key Present:', !!supabaseAnonKey);
console.log('URL Value:', supabaseUrl);
console.log('Key Length:', supabaseAnonKey?.length);

// Declare supabase client variable at top level
let supabase;

// Check if environment variables are loaded
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ CRITICAL: Missing Supabase environment variables');
  console.error('');
  console.error('Please follow these steps:');
  console.error('1. Create a .env file in your project root directory');
  console.error('2. Add the following lines to your .env file:');
  console.error('   EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co');
  console.error('   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here');
  console.error('3. Replace the values with your actual Supabase credentials');
  console.error('4. Restart your development server');
  console.error('');
  
  // Create a dummy client to prevent app crashes during development
  const dummyClient = createClient('https://dummy.supabase.co', 'dummy-key', {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  
  supabase = dummyClient;
  throw new Error('Supabase configuration is incomplete');
} else {
  // Validate URL format
  if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
    console.error('❌ Invalid Supabase URL format:', supabaseUrl);
    console.error('Expected format: https://your-project-ref.supabase.co');
    console.error('Example: https://tqlgxzzcnxruevaegvvd.supabase.co');
    throw new Error('Invalid Supabase URL format');
  }

  // Validate anon key format (should be a JWT-like string)
  if (supabaseAnonKey.length < 100) {
    console.error('❌ Supabase anon key appears to be invalid');
    console.error('Key length:', supabaseAnonKey.length, 'characters');
    console.error('Expected: A long JWT-like string (usually 100+ characters)');
    console.error('Get your anon key from: Supabase Dashboard > Settings > API');
    throw new Error('Invalid Supabase anon key');
  }

  console.log('✅ Supabase configuration validated successfully');

  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      storage: undefined,
      storageKey: 'sb-auth-token',
      debug: true
    },
  });

  // Enhanced connection test
  (async () => {
    try {
      console.log('🔄 Testing Supabase connection...');
      
      // Test 1: Check if we can get session (tests auth endpoint)
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('❌ Session test failed:', sessionError.message);
        return;
      }
      
      // Test 2: Try to access a table (tests database connection and RLS)
      const { data, error } = await supabase
        .from('users')
        .select('count', { count: 'exact', head: true });
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('⚠️  Users table not found - this is expected if migrations haven\'t been run yet');
        } else if (error.code === '42P01') {
          console.log('⚠️  Users table does not exist - please run database migrations');
        } else {
          console.error('❌ Database test failed:', error.message);
          console.error('Error code:', error.code);
          console.error('This might indicate:');
          console.error('- Database migrations need to be run');
          console.error('- RLS policies are not set up correctly');
          console.error('- Wrong Supabase project credentials');
        }
      } else {
        console.log('✅ Database connection test successful');
      }
      
      // Test 3: Check auth configuration
      try {
        const { data: authConfig, error: authError } = await supabase.auth.getSession();
        if (authError) {
          console.error('❌ Auth configuration test failed:', authError.message);
          console.error('This usually indicates:');
          console.error('- Email confirmations are enabled but not configured');
          console.error('- Domain restrictions are blocking signups');
          console.error('- Auth settings need to be updated in Supabase dashboard');
        } else {
          console.log('✅ Auth configuration test successful');
        }
      } catch (authErr) {
        console.error('❌ Auth configuration test error:', authErr);
      }
      
      console.log('✅ Supabase connection test completed');
      
    } catch (err) {
      console.error('❌ Supabase connection test error:', err);
      console.error('This usually indicates:');
      console.error('- Wrong Supabase URL or anon key');
      console.error('- Network connectivity issues');
      console.error('- Supabase project is paused or deleted');
    }
  })();
}

export { supabase };