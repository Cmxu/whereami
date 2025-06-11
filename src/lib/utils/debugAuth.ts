import { supabase } from '$lib/supabase';

export async function debugAuth() {
	try {
		console.log('=== Auth Debug Start ===');
		
		// Get current session
		const { data: { session }, error } = await supabase.auth.getSession();
		
		if (error) {
			console.error('Session error:', error);
			return;
		}
		
		if (!session) {
			console.log('No active session');
			return;
		}
		
		console.log('Session exists:', !!session);
		console.log('User ID:', session.user?.id);
		console.log('Token exists:', !!session.access_token);
		
		// Test the debug endpoint
		if (session.access_token) {
			try {
				const response = await fetch('/api/debug/auth', {
					headers: {
						'Authorization': `Bearer ${session.access_token}`
					}
				});
				
				const debugData = await response.json();
				console.log('Debug endpoint response:', debugData);
				
				// Test upload endpoint specifically
				const uploadTestResponse = await fetch('/api/images/upload-simple', {
					method: 'OPTIONS'
				});
				console.log('Upload endpoint OPTIONS status:', uploadTestResponse.status);
				
				// Test a minimal upload request to see what happens
				const testFormData = new FormData();
				testFormData.append('test', 'true');
				
				const uploadTestPostResponse = await fetch('/api/images/upload-simple', {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${session.access_token}`
					},
					body: testFormData
				});
				
				console.log('Upload endpoint POST test status:', uploadTestPostResponse.status);
				const uploadTestText = await uploadTestPostResponse.text();
				console.log('Upload endpoint POST test response:', uploadTestText);
				
			} catch (apiError) {
				console.error('API test failed:', apiError);
			}
		}
		
		console.log('=== Auth Debug End ===');
		
	} catch (error) {
		console.error('Debug auth failed:', error);
	}
} 