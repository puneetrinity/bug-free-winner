#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import db from '../db/connection';

class DatabaseMigrator {
  private schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  private rssSchemaPath = path.join(__dirname, '..', 'db', 'rss-schema.sql');

  async migrate(): Promise<void> {
    console.log('🗄️  Starting database migration...');
    
    try {
      // Check if schema file exists
      if (!fs.existsSync(this.schemaPath)) {
        throw new Error(`Schema file not found: ${this.schemaPath}`);
      }

      // Read and execute schema
      const schema = fs.readFileSync(this.schemaPath, 'utf-8');
      console.log('📖 Reading schema file...');
      
      // Split schema into individual statements
      const statements = schema
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      console.log(`🔨 Executing ${statements.length} SQL statements...`);

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.toLowerCase().startsWith('--') || statement.length === 0) {
          continue;
        }

        try {
          await db.query(statement + ';');
          
          // Extract table/operation name for logging
          const operation = this.extractOperation(statement);
          console.log(`  ✅ ${i + 1}/${statements.length}: ${operation}`);
          
        } catch (error) {
          // Some statements might fail if tables already exist
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('already exists')) {
            const operation = this.extractOperation(statement);
            console.log(`  ⚠️  ${i + 1}/${statements.length}: ${operation} (already exists)`);
          } else {
            throw error;
          }
        }
      }

      console.log('\n🎉 Main database migration completed successfully!');
      
      // Now run RSS schema migration
      await this.migrateRSSSchema();
      
      await this.verifyTables();
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async migrateRSSSchema(): Promise<void> {
    console.log('📰 Running RSS schema migration...');
    
    try {
      // Check if RSS schema file exists
      if (!fs.existsSync(this.rssSchemaPath)) {
        console.log('⚠️ RSS schema file not found, skipping RSS migration');
        return;
      }

      // Read and execute RSS schema
      const rssSchema = fs.readFileSync(this.rssSchemaPath, 'utf-8');
      console.log('📖 Reading RSS schema file...');
      
      // Split schema into individual statements
      const statements = rssSchema
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      console.log(`🔨 Executing ${statements.length} RSS SQL statements...`);

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.toLowerCase().startsWith('--') || statement.length === 0) {
          continue;
        }

        try {
          await db.query(statement + ';');
          
          // Extract table/operation name for logging
          const operation = this.extractOperation(statement);
          console.log(`  ✅ RSS ${i + 1}/${statements.length}: ${operation}`);
          
        } catch (error) {
          // Some statements might fail if tables already exist
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('already exists')) {
            const operation = this.extractOperation(statement);
            console.log(`  ⚠️  RSS ${i + 1}/${statements.length}: ${operation} (already exists)`);
          } else {
            throw error;
          }
        }
      }

      console.log('✅ RSS schema migration completed successfully!');
      
    } catch (error) {
      console.error('❌ RSS migration failed:', error);
      throw error;
    }
  }

  async reset(): Promise<void> {
    console.log('🧹 Resetting database (dropping all tables)...');
    
    const tables = ['citations', 'reports', 'content_items', 'collection_stats', 'rss_articles', 'rss_collection_stats'];
    
    for (const table of tables) {
      try {
        await db.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
        console.log(`  🗑️  Dropped table: ${table}`);
      } catch (error) {
        console.warn(`Failed to drop ${table}:`, error instanceof Error ? error.message : error);
      }
    }

    // Drop extension if it exists
    try {
      await db.query('DROP EXTENSION IF EXISTS "uuid-ossp";');
      console.log('  🗑️  Dropped extension: uuid-ossp');
    } catch (error) {
      console.warn('Failed to drop uuid-ossp extension:', error instanceof Error ? error.message : error);
    }

    console.log('✅ Database reset completed');
  }

  async seed(): Promise<void> {
    console.log('🌱 Seeding database with sample data...');
    
    // Add sample RSS collection stats
    const sampleRSSStats = [
      {
        collection_date: new Date().toISOString().split('T')[0],
        feed_name: 'ET HR World - Top Stories',
        articles_collected: 15,
        articles_new: 12,
        articles_duplicate: 3,
        collection_time_ms: 8000
      },
      {
        collection_date: new Date().toISOString().split('T')[0],
        feed_name: 'Google News - HR India',
        articles_collected: 8,
        articles_new: 8,
        articles_duplicate: 0,
        collection_time_ms: 5000
      }
    ];

    for (const stats of sampleRSSStats) {
      try {
        await db.query(`
          INSERT INTO rss_collection_stats (
            collection_date, feed_name, articles_collected, 
            articles_new, articles_duplicate, collection_time_ms
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          stats.collection_date,
          stats.feed_name, 
          stats.articles_collected,
          stats.articles_new,
          stats.articles_duplicate,
          stats.collection_time_ms
        ]);
      } catch (error) {
        // Ignore if RSS tables don't exist yet
        console.log('⚠️ RSS tables not available for seeding');
        break;
      }
    }

    console.log(`✅ Seeded sample RSS collection stats`);
  }

  private async verifyTables(): Promise<void> {
    console.log('\n🔍 Verifying database structure...');
    
    const expectedTables = ['content_items', 'reports', 'citations', 'collection_stats', 'rss_articles', 'rss_collection_stats'];
    
    for (const table of expectedTables) {
      try {
        const result = await db.query(`
          SELECT column_name, data_type, is_nullable 
          FROM information_schema.columns 
          WHERE table_name = $1 
          ORDER BY ordinal_position
        `, [table]);
        
        console.log(`  📋 ${table}: ${result.rows.length} columns`);
        
        // Log key columns for verification
        const keyColumns = result.rows
          .slice(0, 3)
          .map((row: any) => `${row.column_name}(${row.data_type})`)
          .join(', ');
        console.log(`     ${keyColumns}...`);
        
      } catch (error) {
        console.error(`  ❌ Failed to verify table ${table}:`, error instanceof Error ? error.message : error);
      }
    }
  }

  private extractOperation(statement: string): string {
    const trimmed = statement.trim().toUpperCase();
    
    if (trimmed.startsWith('CREATE TABLE')) {
      const match = trimmed.match(/CREATE TABLE\s+(\w+)/);
      return match ? `CREATE TABLE ${match[1]}` : 'CREATE TABLE';
    } else if (trimmed.startsWith('CREATE EXTENSION')) {
      const match = trimmed.match(/CREATE EXTENSION\s+"?([^"\s]+)"?/);
      return match ? `CREATE EXTENSION ${match[1]}` : 'CREATE EXTENSION';
    } else if (trimmed.startsWith('CREATE INDEX')) {
      const match = trimmed.match(/CREATE INDEX\s+(\w+)/);
      return match ? `CREATE INDEX ${match[1]}` : 'CREATE INDEX';
    } else if (trimmed.startsWith('INSERT')) {
      return 'INSERT DATA';
    } else if (trimmed.startsWith('ALTER')) {
      return 'ALTER TABLE';
    } else {
      return statement.substring(0, 30) + '...';
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const migrator = new DatabaseMigrator();

  try {
    if (args.includes('--reset')) {
      console.log('⚠️  WARNING: This will delete all data!');
      console.log('Press Ctrl+C within 3 seconds to cancel...\n');
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      await migrator.reset();
      await migrator.migrate();
    } else if (args.includes('--seed')) {
      await migrator.migrate();
      await migrator.seed();
    } else {
      await migrator.migrate();
    }
    
    console.log('\n🎯 Database is ready for use!');
    console.log('\nNext steps:');
    console.log('  npm run collect:rss      # Collect RSS articles from HR sources');
    console.log('  npm run generate "topic" # Generate research reports (uses RSS + real-time search)');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { DatabaseMigrator };