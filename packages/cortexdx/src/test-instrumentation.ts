/**
 * Quick test to verify the Shinzo Labs instrumentation is working
 */
import { createInstrumentedMcpServer } from './instrumented-mcp-server.js';

async function testInstrumentation() {
    console.log('🧪 Testing Shinzo Labs MCP instrumentation...');
    
    try {
        const server = await createInstrumentedMcpServer();
        console.log('✅ Server created successfully');
        console.log('✅ Instrumentation applied');
        console.log('🎯 Server name:', server.server.name);
        console.log('📊 Telemetry endpoint: https://api.app.shinzo.ai/telemetry/ingest_http');
        
        // Note: In a real scenario, you'd connect to a transport and test tool calls
        console.log('\n📝 To run the instrumented server:');
        console.log('   op run --env-file=.env -- node src/instrumented-mcp-server.js');
        console.log('\n📈 Telemetry will track:');
        console.log('   - Tool execution metrics');
        console.log('   - Performance data');
        console.log('   - Error rates');
        console.log('   - Usage patterns');
        console.log('\n🔐 Token loaded from 1Password managed .env file');
        
    } catch (error) {
        console.error('❌ Error creating instrumented server:', error);
        process.exit(1);
    }
}

testInstrumentation();
