// Test script to verify upload and gallery functionality
const fs = require('fs');
const path = require('path');

// You'll need to have a test user token from your Supabase auth
// Replace this with a real token from your browser's dev tools
const TEST_AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE';

const testUploadAndGallery = async () => {
    const baseUrl = 'http://localhost:5173'; // or your dev server URL
    
    console.log('🧪 Testing Upload and Gallery Functionality');
    console.log('===========================================');
    
    try {
        // Step 1: Test authentication requirement
        console.log('\n1. Testing authentication requirement...');
        const unauthedResponse = await fetch(`${baseUrl}/api/images/user`, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (unauthedResponse.status === 401) {
            console.log('✅ Gallery correctly requires authentication');
        } else {
            console.log('❌ Gallery should require authentication but got status:', unauthedResponse.status);
        }
        
        // Step 2: Test authenticated gallery access
        console.log('\n2. Testing authenticated gallery access...');
        if (TEST_AUTH_TOKEN === 'YOUR_AUTH_TOKEN_HERE') {
            console.log('⚠️  Please set a real auth token in the script to test authenticated functionality');
            console.log('   You can get this from your browser dev tools after logging in');
            return;
        }
        
        const galleryResponse = await fetch(`${baseUrl}/api/images/user`, {
            headers: { 
                'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
                'Content-Type': 'application/json' 
            }
        });
        
        if (galleryResponse.ok) {
            const galleryData = await galleryResponse.json();
            console.log('✅ Gallery API working - found', galleryData.images?.length || 0, 'images');
            console.log('   Response structure:', Object.keys(galleryData));
        } else {
            console.log('❌ Gallery API failed with status:', galleryResponse.status);
            const errorData = await galleryResponse.json().catch(() => null);
            if (errorData) console.log('   Error:', errorData);
        }
        
        // Step 3: Test file upload (commented out - requires actual file)
        console.log('\n3. Testing file upload...');
        console.log('ℹ️  Upload test requires a real image file and is commented out for safety');
        console.log('   To test uploads:');
        console.log('   - Use the web interface');
        console.log('   - Or uncomment the upload test below and provide a test image');
        
        /*
        // Uncomment this section to test actual file upload
        const testImagePath = './test-image.jpg'; // Add a test image file
        if (fs.existsSync(testImagePath)) {
            const formData = new FormData();
            const fileBuffer = fs.readFileSync(testImagePath);
            const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
            formData.append('image', blob, 'test-image.jpg');
            formData.append('location', JSON.stringify({ lat: 37.7749, lng: -122.4194 }));
            
            const uploadResponse = await fetch(`${baseUrl}/api/images/upload-simple`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${TEST_AUTH_TOKEN}` },
                body: formData
            });
            
            if (uploadResponse.ok) {
                const uploadData = await uploadResponse.json();
                console.log('✅ Upload successful:', uploadData.metadata?.id);
            } else {
                console.log('❌ Upload failed with status:', uploadResponse.status);
                const errorData = await uploadResponse.json().catch(() => null);
                if (errorData) console.log('   Error:', errorData);
            }
        } else {
            console.log('⚠️  Test image not found at', testImagePath);
        }
        */
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
    }
    
    console.log('\n🏁 Test completed!');
    console.log('\nNext steps:');
    console.log('1. Make sure you\'re signed in to the web app');
    console.log('2. Try uploading photos through the web interface');
    console.log('3. Check if they appear in your gallery');
    console.log('4. Look at browser dev tools console for any errors');
};

// Instructions
console.log('📋 Upload and Gallery Test Instructions');
console.log('=====================================');
console.log('');
console.log('Before running this test:');
console.log('1. Start your dev server: npm run dev');
console.log('2. Sign in to your app in the browser');
console.log('3. Open browser dev tools → Network tab');
console.log('4. Make a request that includes auth (like visiting /browse)');
console.log('5. Copy the Authorization header value');
console.log('6. Replace TEST_AUTH_TOKEN in this script');
console.log('7. Run: node test-upload-and-gallery.js');
console.log('');

// Only run the test if this file is executed directly
if (require.main === module) {
    testUploadAndGallery();
}

module.exports = { testUploadAndGallery }; 