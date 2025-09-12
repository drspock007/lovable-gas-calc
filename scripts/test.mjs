#!/usr/bin/env node

// Simple test runner for the Gas Transfer Calculator
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runTests() {
  console.log('🧪 Running Gas Transfer Calculator Tests...\n');
  
  try {
    // Run vitest
    const { stdout, stderr } = await execAsync('npx vitest run --reporter=verbose');
    
    console.log('✅ Test Results:');
    console.log(stdout);
    
    if (stderr) {
      console.log('⚠️  Warnings:');
      console.log(stderr);
    }
    
  } catch (error) {
    console.log('❌ Test Execution Failed:');
    console.log(error.stdout || error.message);
    
    if (error.stderr) {
      console.log('Error Details:');
      console.log(error.stderr);
    }
  }
}

runTests();