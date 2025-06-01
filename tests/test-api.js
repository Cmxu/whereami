// Test script to verify API endpoint is working
const testAPI = async () => {
    try {
        // Test OPTIONS request first (CORS preflight)
        console.log('Testing CORS preflight...');
        const optionsResponse = await fetch('http://localhost:8788/api/images/upload-simple', {
            method: 'OPTIONS'
        });
        console.log('OPTIONS status:', optionsResponse.status);
        
        // Test POST request without file (should get 400 error but not 405)
        console.log('Testing POST request without file...');
        const formData = new FormData();
        formData.append('location', JSON.stringify({ lat: 37.7749, lng: -122.4194 }));
        
        const postResponse = await fetch('http://localhost:8788/api/images/upload-simple', {
            method: 'POST',
            body: formData
        });
        
        console.log('POST status:', postResponse.status);
        if (postResponse.status === 400) {
            const postData = await postResponse.json();
            console.log('POST response:', postData);
            console.log('✅ API endpoint is working! (Expected 400 error for missing file)');
        } else if (postResponse.status === 405) {
            console.log('❌ Still getting 405 Method Not Allowed');
        } else {
            console.log('🤔 Unexpected status code:', postResponse.status);
        }
        
    } catch (error) {
        console.error('Error testing API:', error);
    }
};

testAPI(); 