// Test the complete admin authentication flow
async function testAdminFlow() {
  console.log("Testing admin login flow...");
  
  // Step 1: Login as admin
  const loginResponse = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@tubeapi.dev", password: "admin123" })
  });
  
  if (!loginResponse.ok) {
    console.error("Login failed:", await loginResponse.text());
    return;
  }
  
  const loginData = await loginResponse.json();
  console.log("✓ Login successful:", loginData.user);
  
  const token = loginData.token;
  
  // Step 2: Test admin endpoints with token
  const endpoints = [
    "/api/admin/dashboard",
    "/api/admin/users", 
    "/api/admin/api-keys",
    "/api/admin/test-api-key",
    "/api/admin/analytics"
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✓ ${endpoint} working`);
      } else {
        console.error(`✗ ${endpoint} failed:`, response.status, await response.text());
      }
    } catch (error) {
      console.error(`✗ ${endpoint} error:`, error.message);
    }
  }
}

testAdminFlow();