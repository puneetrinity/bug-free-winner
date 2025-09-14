const { Client } = require('pg');

async function testConnection() {
  // Try different connection strings
  const connections = [
    {
      name: 'External Railway URL',
      url: 'postgresql://postgres:CeilpeBvkqyKjPzykzxgixQApXHoGMOh@postgres-production-1eb9.up.railway.app:5432/railway'
    },
    {
      name: 'Viaduct Proxy URL (common Railway pattern)',  
      url: 'postgresql://postgres:CeilpeBvkqyKjPzykzxgixQApXHoGMOh@viaduct.proxy.rlwy.net:5432/railway'
    },
    {
      name: 'Roundhouse URL (alternative Railway pattern)',
      url: 'postgresql://postgres:CeilpeBvkqyKjPzykzxgixQApXHoGMOh@roundhouse.proxy.rlwy.net:5432/railway'
    }
  ];

  for (const conn of connections) {
    console.log(`\n🔍 Testing: ${conn.name}`);
    console.log(`   URL: ${conn.url.substring(0, 50)}...`);
    
    const client = new Client({
      connectionString: conn.url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    });

    try {
      const startTime = Date.now();
      await client.connect();
      const connectTime = Date.now() - startTime;
      
      console.log(`✅ Connected in ${connectTime}ms!`);
      
      const result = await client.query('SELECT NOW()');
      console.log(`   Server time: ${result.rows[0].now}`);
      
      await client.end();
      
      // If we found a working connection, report it
      console.log(`\n🎉 SUCCESS! Use this connection string:`);
      console.log(`   ${conn.url}`);
      return;
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      await client.end().catch(() => {});
    }
  }
  
  console.log('\n😞 All connection attempts failed');
}

testConnection();