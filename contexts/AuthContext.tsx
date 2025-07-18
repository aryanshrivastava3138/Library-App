import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@/types/database';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string, mobileNumber: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMountedRef.current) return;
      
      if (error) {
        console.error('Error getting session:', error);
        setLoading(false);
        return;
      }
      
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMountedRef.current) return;
      
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!isMountedRef.current) return;

      if (error) {
        console.error('Error fetching user profile:', error);
        setLoading(false);
        return;
      }
      
      setUser(data);
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error fetching user profile:', error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      // Validate email format before sending to Supabase
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const trimmedEmail = email.trim().toLowerCase();
      
      if (!emailRegex.test(trimmedEmail)) {
        return { error: 'Please enter a valid email address' };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        // Handle specific auth errors
        if (error.message.includes('Invalid login credentials')) {
          return { error: 'Invalid email or password' };
        } else if (error.message.includes('Email address') && error.message.includes('invalid')) {
          return { error: 'Please enter a valid email address' };
        }
        return { error: error.message };
      }

      return {};
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: 'An unexpected error occurred during sign in' };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, mobileNumber: string) => {
    try {
      // Check if Supabase is properly configured
      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.error('❌ Supabase environment variables not found');
        return { 
          error: 'App configuration error. Please ensure Supabase credentials are set up correctly and restart the app.' 
        };
      }

      console.log('🔍 Starting signup process with Supabase configuration check...');
      console.log('Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
      console.log('Anon Key length:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.length);

      // Validate email format before sending to Supabase
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const trimmedEmail = email.trim().toLowerCase();
      
      if (!emailRegex.test(trimmedEmail)) {
        return { error: 'Please enter a valid email address' };
      }

      // Validate other required fields
      if (!fullName.trim()) {
        return { error: 'Full name is required' };
      }

      if (!mobileNumber.trim()) {
        return { error: 'Mobile number is required' };
      }

      if (password.length < 6) {
        return { error: 'Password must be at least 6 characters long' };
      }

      console.log('Starting sign up process...');
      
      // Log the attempt (without sensitive data)
      console.log('Attempting signup with:', {
        email: trimmedEmail,
        hasPassword: !!password,
        hasFullName: !!fullName.trim(),
        hasMobileNumber: !!mobileNumber.trim()
      });
      
      // Try to sign up with minimal options first to test auth configuration
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: undefined,
          data: {
            full_name: fullName.trim(),
            mobile_number: mobileNumber.trim(),
          }
        }
      });

      if (error) {
        console.error('Auth signup error:', error);
        console.error('Error details:', {
          message: error.message,
          status: error.status,
          name: error.name
        });
        
        // Handle specific Supabase configuration errors
        if (error.message.includes('Email address') && error.message.includes('invalid')) {
          console.error('❌ Supabase configuration issue detected');
          console.error('');
          console.error('🔧 CONFIGURATION STEPS TO FIX THIS:');
          console.error('');
          console.error('1. Go to your Supabase dashboard');
          console.error('2. Navigate to Authentication > Settings');
          console.error('3. DISABLE "Enable email confirmations" (this is the most common cause)');
          console.error('4. Check "Site URL" is set to http://localhost:8081 for development');
          console.error('5. Ensure no domain restrictions are blocking your email domain');
          console.error('6. Verify Settings > API has correct URL and anon key');
          console.error('7. Save changes and restart your development server');
          console.error('');
          console.error('Current environment:');
          console.error('- URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
          console.error('- Key length:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.length, 'characters');
          
          return { 
            error: 'Supabase configuration error: Email confirmations may be enabled or domain restrictions are active. Check console for detailed fix instructions.' 
          };
        } else if (error.message.includes('User already registered')) {
          return { error: 'An account with this email already exists' };
        } else if (error.message.includes('Password should be at least')) {
          return { error: 'Password must be at least 6 characters long' };
        } else if (error.message.includes('signup is disabled')) {
          return { error: 'User registration is currently disabled. Please contact support.' };
        }
        
        return { error: error.message };
      }

      if (!data.user) {
        return { error: 'Failed to create user account. Please try again.' };
      }

      console.log('Auth user created, now creating profile...');

      // Create user profile with better error handling
      try {
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: trimmedEmail,
            full_name: fullName.trim(),
            mobile_number: mobileNumber.trim(),
            role: 'student',
          });

        if (profileError) {
          console.error('Profile creation error:', {
            code: profileError.code,
            message: profileError.message,
            details: profileError.details,
            hint: profileError.hint,
            fullError: JSON.stringify(profileError, null, 2)
          });

          // Try to provide more specific error messages
          if (profileError.code === '23505') {
            return { error: 'An account with this email already exists.' };
          } else if (profileError.code === '42501') {
            return { error: 'Database permission error. Please run the latest database migration to fix RLS policies.' };
          } else if (profileError.message?.includes('relation') && profileError.message?.includes('does not exist')) {
            return { error: 'Database setup incomplete. Please contact support.' };
          } else {
            return { error: `Profile creation failed: ${profileError.message || 'Unknown error'}. Please contact support.` };
          }
        }

        console.log('Profile created successfully');
        return {};

      } catch (profileException) {
        console.error('Profile creation exception:', profileException);
        return { error: 'Failed to create user profile. Please try again or contact support.' };
      }

    } catch (error) {
      console.error('Sign up error:', error);
      
      // Handle configuration errors
      if (error instanceof Error && error.message.includes('Supabase configuration')) {
        return { 
          error: 'Database configuration error. Please check your .env file has the correct Supabase credentials and restart the app.' 
        };
      }
      
      if (error instanceof Error) {
        return { error: `Registration failed: ${error.message}` };
      }
      return { error: 'An unexpected error occurred during registration' };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};