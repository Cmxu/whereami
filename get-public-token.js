/**
 * Script to get authentication token for the public user account
 * 
 * First, you need to:
 * 1. Create a user account in Supabase with email like 'public@whereami.app' 
 * 2. Set the password and note the credentials
 * 3. Run this script with those credentials
 */

import { createClient } from '@supabase/supabase-js';

// You'll need to set these environment variables or replace with your values
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
console.log(SUPABASE_URL)
console.log(SUPABASE_ANON_KEY)
// Public user credentials - set these after creating the account
const PUBLIC_USER_EMAIL = 'public@geo.cmxu.io'; // Change this to your public user email
const PUBLIC_USER_PASSWORD = 'public1'; // Change this to your public user password

async function getPublicUserToken() {
    try {
        console.log('🔐 Authenticating public user...');
        
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: PUBLIC_USER_EMAIL,
            password: PUBLIC_USER_PASSWORD
        });
        
        if (error) {
            throw error;
        }
        
        if (!data.session?.access_token) {
            throw new Error('No access token received');
        }
        
        console.log('✅ Authentication successful!');
        console.log('📋 Bearer Token:');
        console.log('');
        console.log(data.session.access_token);
        console.log('');
        console.log('🚀 Use this in your curl commands:');
        console.log(`curl -H "Authorization: Bearer ${data.session.access_token}" ...`);
        console.log('');
        console.log('ℹ️  Token expires at:', new Date(data.session.expires_at * 1000).toISOString());
        
        // Also show user info
        console.log('👤 User Info:');
        console.log('   ID:', data.user.id);
        console.log('   Email:', data.user.email);
        console.log('   Username:', data.user.user_metadata?.username || 'Not set');
        
        return data.session.access_token;
        
    } catch (error) {
        console.error('❌ Authentication failed:', error.message);
        console.log('');
        console.log('💡 Make sure you have:');
        console.log('   1. Created a user account in Supabase');
        console.log('   2. Set the correct email and password in this script');
        console.log('   3. Set the SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
        return null;
    }
}

// Run the script
getPublicUserToken(); 