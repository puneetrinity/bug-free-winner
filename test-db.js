const { Client } = require('pg');

async function testConnection() {
  const client = new Client({
    connectionString: 'postgresql://postgres:CeilpeBvkqyKjPzykzxgixQApXHoGMOh@postgres-production-1eb9.up.railway.app:5432/railway',
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔗 Attempting database connection...');
    await client.connect();
    console.log('✅ Database connected successfully!');
    
    const result = await client.query('SELECT version();');
    console.log('📊 PostgreSQL Version:', result.rows[0].version);
    
    // Test if tables exist
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('📋 Existing tables:', tables.rows.map(r => r.table_name));
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await client.end();
  }
}

testConnection();