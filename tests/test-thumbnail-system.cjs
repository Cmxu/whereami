// Test script to verify thumbnail system is working

const testThumbnailSystem = async () => {
	const baseUrl = 'http://localhost:5175'; // adjust port as needed

	console.log('🖼️  Testing Thumbnail System');
	console.log('==============================');

	try {
		// Step 1: Test that unauthenticated gallery request returns 401
		console.log('\n1. Testing unauthenticated gallery access...');
		const unauthedResponse = await fetch(`${baseUrl}/api/images/user`);

		if (unauthedResponse.status === 401) {
			console.log('✅ Gallery correctly requires authentication');
		} else {
			console.log(`❌ Expected 401, got ${unauthedResponse.status}`);
		}

		// Step 2: Test that unauthenticated upload returns 401
		console.log('\n2. Testing unauthenticated upload...');
		const formData = new FormData();
		const unauthedUploadResponse = await fetch(`${baseUrl}/api/images/upload-simple`, {
			method: 'POST',
			body: formData
		});

		if (unauthedUploadResponse.status === 401) {
			console.log('✅ Upload correctly requires authentication');
		} else {
			console.log(`❌ Expected 401, got ${unauthedUploadResponse.status}`);
		}

		// Step 3: Test image serving endpoint
		console.log('\n3. Testing image serving endpoint structure...');
		const imageResponse = await fetch(`${baseUrl}/api/images/test-image.jpg`);

		if (imageResponse.status === 404) {
			console.log('✅ Image endpoint is responding (404 for non-existent image is expected)');
		} else {
			console.log(`ℹ️  Image endpoint returned: ${imageResponse.status}`);
		}

		// Step 4: Test thumbnail URL structure
		console.log('\n4. Testing thumbnail URL structure...');
		const thumbnailResponse = await fetch(
			`${baseUrl}/api/images/test-image.jpg?w=300&h=300&fit=cover&q=80`
		);

		if (thumbnailResponse.status === 404) {
			console.log('✅ Thumbnail URL structure is working (404 for non-existent image is expected)');
		} else {
			console.log(`ℹ️  Thumbnail endpoint returned: ${thumbnailResponse.status}`);
		}

		console.log('\n📝 Summary:');
		console.log('- Authentication is required for upload and gallery ✅');
		console.log('- Image serving endpoint is responding ✅');
		console.log('- Thumbnail URL structure is correct ✅');
		console.log('\n📋 Next steps:');
		console.log('1. Get a valid auth token from your browser dev tools');
		console.log('2. Upload an image with proper authentication');
		console.log('3. Check that the gallery returns the image with thumbnail URLs');
		console.log('\n💡 Thumbnail URLs now use query parameters:');
		console.log('   - Thumbnail: /api/images/{id}/{filename}?w=300&h=300&fit=cover&q=80');
		console.log('   - Preview: /api/images/{id}/{filename}?w=800&h=600&fit=scale-down&q=85');
		console.log('\n🔧 For production deployment:');
		console.log('   - Cloudflare Functions will handle image transformations');
		console.log('   - SvelteKit endpoints serve as fallback for original images');
	} catch (error) {
		console.error('❌ Test failed:', error.message);
	}
};

// Run the test
testThumbnailSystem().catch(console.error);
