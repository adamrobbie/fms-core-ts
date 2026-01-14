#!/usr/bin/env node

/**
 * Diagnostic script to troubleshoot miner connection issues
 * 
 * Usage: npm run build && ts-node scripts/diagnose-miner.ts <IP> [PORT]
 */

import * as net from 'net';
import { CGMinerAPI } from '../src/cg-miner-api';
import { logger, LogLevel } from '../src/logger';

// Set logger to debug level for diagnostics
logger.setLevel(LogLevel.DEBUG);

const IP = process.argv[2];
const PORT = parseInt(process.argv[3] || '4028', 10);

if (!IP) {
  console.error('Usage: ts-node scripts/diagnose-miner.ts <IP> [PORT]');
  console.error('Example: ts-node scripts/diagnose-miner.ts 192.168.1.122 4028');
  process.exit(1);
}

interface DiagnosticResult {
  test: string;
  passed: boolean;
  message: string;
  details?: string;
}

const results: DiagnosticResult[] = [];

function addResult(test: string, passed: boolean, message: string, details?: string) {
  results.push({ test, passed, message, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${test}: ${message}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

async function testBasicConnectivity(): Promise<void> {
  console.log('\n📡 Testing Basic Network Connectivity...\n');
  
  // Test 1: Basic socket connection
  try {
    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const sock = new net.Socket();
      const timeout = setTimeout(() => {
        sock.destroy();
        reject(new Error('Connection timeout (5s)'));
      }, 5000);

      sock.connect(PORT, IP, () => {
        clearTimeout(timeout);
        resolve(sock);
      });

      sock.on('error', (err: NodeJS.ErrnoException) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    addResult(
      'Socket Connection',
      true,
      `Successfully connected to ${IP}:${PORT}`,
      `Socket is writable: ${socket.writable}`
    );
    socket.destroy();
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    let details = '';
    
    if (err.code === 'ECONNREFUSED') {
      details = 'Port is closed or miner is not running. Check if miner is powered on.';
    } else if (err.code === 'ETIMEDOUT' || err.code === 'EHOSTUNREACH') {
      details = 'Host unreachable. Check network connectivity, firewall, or IP address.';
    } else if (err.code === 'ENETUNREACH') {
      details = 'Network unreachable. Check your network connection.';
    } else {
      details = `Error code: ${err.code || 'UNKNOWN'}, Message: ${err.message}`;
    }
    
    addResult('Socket Connection', false, `Failed to connect: ${err.message}`, details);
  }
}

async function testApiCommand(): Promise<void> {
  console.log('\n🔌 Testing CGMiner API Commands...\n');
  
  // Test 2: Version command (simplest command)
  try {
    console.log(`Attempting version command to ${IP}:${PORT}...`);
    const result = await CGMinerAPI.aioVersion(IP, PORT, 5, 0);
    
    if (result.result) {
      addResult(
        'API Version Command',
        true,
        'Received response from miner',
        `Response length: ${result.response.length} bytes`
      );
      
      // Check if response can be parsed
      try {
        const responseDict = result.responseDict();
        if (responseDict.STATUS && Array.isArray(responseDict.STATUS)) {
          addResult(
            'JSON Parsing',
            true,
            'Response is valid JSON',
            `Status: ${responseDict.STATUS[0]?.STATUS || 'N/A'}`
          );
          
          if (result.isRequestSuccess()) {
            const version = result.mm3SoftwareVersion();
            addResult(
              'Version Extraction',
              true,
              `Miner version: ${version || 'N/A'}`,
              `MAC: ${result.mm3Mac() || 'N/A'}`
            );
          } else {
            addResult(
              'API Success Check',
              false,
              'API returned error status',
              `Code: ${result.statusCode()}, Msg: ${result.statusMsg()}`
            );
          }
        } else {
          addResult(
            'JSON Structure',
            false,
            'Response JSON missing STATUS field',
            `Keys: ${Object.keys(responseDict).join(', ')}`
          );
        }
      } catch (parseError: unknown) {
        const err = parseError as Error;
        addResult(
          'JSON Parsing',
          false,
          `Failed to parse response: ${err.message}`,
          `Response preview: ${result.response.substring(0, 200)}...`
        );
      }
    } else {
      addResult(
        'API Version Command',
        false,
        'No response received',
        `Error: ${result.msg}`
      );
    }
  } catch (error: unknown) {
    const err = error as Error;
    addResult(
      'API Version Command',
      false,
      `Exception: ${err.message}`,
      err.stack?.split('\n').slice(0, 3).join('\n   ')
    );
  }
}

async function testRawSocketCommunication(): Promise<void> {
  console.log('\n🔍 Testing Raw Socket Communication...\n');
  
  try {
    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const sock = new net.Socket();
      const timeout = setTimeout(() => {
        sock.destroy();
        reject(new Error('Connection timeout'));
      }, 5000);

      sock.connect(PORT, IP, () => {
        clearTimeout(timeout);
        resolve(sock);
      });

      sock.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Send a simple version command
    const command = JSON.stringify({ command: 'version', parameter: '' });
    console.log(`Sending command: ${command}`);
    
    const response = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let responseTimeout: NodeJS.Timeout;
      
      socket.on('data', (data: Buffer) => {
        chunks.push(data);
        clearTimeout(responseTimeout);
        responseTimeout = setTimeout(() => {
          socket.destroy();
          resolve(Buffer.concat(chunks).toString('utf-8'));
        }, 1000); // Wait 1s for more data
      });

      socket.on('end', () => {
        clearTimeout(responseTimeout);
        resolve(Buffer.concat(chunks).toString('utf-8'));
      });

      socket.on('error', (err) => {
        clearTimeout(responseTimeout);
        reject(err);
      });

      socket.write(command, 'latin1');
      
      // Fallback timeout
      setTimeout(() => {
        socket.destroy();
        resolve(Buffer.concat(chunks).toString('utf-8'));
      }, 10000);
    });

    if (response.length > 0) {
      // Check for null bytes
      const hasNullBytes = response.includes('\0');
      const nullByteCount = (response.match(/\0/g) || []).length;
      const cleaned = response.replace(/\0/g, '').trim();
      
      addResult(
        'Raw Socket Communication',
        true,
        `Received ${response.length} bytes`,
        `Has null bytes: ${hasNullBytes} (${nullByteCount} found), Cleaned length: ${cleaned.length}`
      );
      
      // Try to parse as JSON (both raw and cleaned)
      try {
        const parsed = JSON.parse(cleaned);
        addResult(
          'Raw Response JSON',
          true,
          'Response is valid JSON (after cleaning)',
          `Has STATUS: ${!!parsed.STATUS}, Keys: ${Object.keys(parsed).join(', ')}`
        );
      } catch (parseError: unknown) {
        const err = parseError as Error;
        // Try raw
        try {
          const parsedRaw = JSON.parse(response);
          addResult(
            'Raw Response JSON',
            true,
            'Response is valid JSON (raw)',
            `Has STATUS: ${!!parsedRaw.STATUS}`
          );
        } catch {
          addResult(
            'Raw Response JSON',
            false,
            `Response is not valid JSON: ${err.message}`,
            `Response (first 500): ${response.substring(0, 500)}\nCleaned (first 500): ${cleaned.substring(0, 500)}`
          );
        }
      }
    } else {
      addResult(
        'Raw Socket Communication',
        false,
        'No data received',
        'Miner may have closed connection immediately'
      );
    }
    
    socket.destroy();
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    addResult(
      'Raw Socket Communication',
      false,
      `Failed: ${err.message}`,
      `Code: ${err.code || 'N/A'}`
    );
  }
}

async function testNetworkDiagnostics(): Promise<void> {
  console.log('\n🌐 Network Diagnostics...\n');
  
  // Check if IP is valid format
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(IP)) {
    addResult('IP Format', false, `Invalid IP format: ${IP}`, 'Expected format: xxx.xxx.xxx.xxx');
  } else {
    addResult('IP Format', true, `IP format is valid: ${IP}`, '');
  }
  
  // Check port range
  if (PORT < 1 || PORT > 65535) {
    addResult('Port Range', false, `Invalid port: ${PORT}`, 'Port must be between 1 and 65535');
  } else {
    addResult('Port Range', true, `Port is valid: ${PORT}`, '');
  }
  
  // Check if port is the default
  if (PORT === 4028) {
    addResult('Port Check', true, 'Using default CGMiner API port (4028)', '');
  } else {
    addResult('Port Check', true, `Using custom port: ${PORT}`, 'Make sure this matches your miner configuration');
  }
}

async function testMultipleCommands(): Promise<void> {
  console.log('\n📋 Testing Multiple API Commands...\n');
  
  const commands = [
    { name: 'version', method: () => CGMinerAPI.aioVersion(IP, PORT, 3, 0) },
    { name: 'summary', method: () => CGMinerAPI.summary(IP, PORT, 3, 0) },
    { name: 'pools', method: () => CGMinerAPI.pools(IP, PORT, 3, 0) },
  ];
  
  for (const cmd of commands) {
    try {
      const result = await cmd.method();
      if (result.result && result.isRequestSuccess()) {
        addResult(
          `Command: ${cmd.name}`,
          true,
          'Command succeeded',
          `Response length: ${result.response.length} bytes`
        );
      } else {
        addResult(
          `Command: ${cmd.name}`,
          false,
          'Command failed',
          `Error: ${result.msg || result.statusMsg() || 'Unknown error'}`
        );
      }
    } catch (error: unknown) {
      const err = error as Error;
      addResult(
        `Command: ${cmd.name}`,
        false,
        `Exception: ${err.message}`,
        ''
      );
    }
  }
}

async function main() {
  console.log('🔧 Miner Connection Diagnostics');
  console.log('================================\n');
  console.log(`Target: ${IP}:${PORT}\n`);
  
  await testNetworkDiagnostics();
  await testBasicConnectivity();
  await testRawSocketCommunication();
  await testApiCommand();
  await testMultipleCommands();
  
  // Summary
  console.log('\n📊 Diagnostic Summary');
  console.log('====================\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}\n`);
  
  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.test}: ${r.message}`);
      if (r.details) {
        console.log(`     ${r.details}`);
      }
    });
    
    console.log('\n💡 Troubleshooting Tips:');
    console.log('  1. Verify miner is powered on');
    console.log('  2. Check network cable connection');
    console.log('  3. Ping the miner: ping ' + IP);
    console.log('  4. Check firewall settings (port 4028 should be open)');
    console.log('  5. Verify miner IP in miner web interface');
    console.log('  6. Try accessing miner web UI: http://' + IP);
    console.log('  7. Check if miner firmware supports CGMiner API');
    console.log('  8. Verify you\'re on the same network segment');
    console.log('  9. Check router/VLAN configuration');
    console.log('  10. Try telnet: telnet ' + IP + ' ' + PORT);
  } else {
    console.log('✅ All tests passed! Miner is reachable and responding.');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
