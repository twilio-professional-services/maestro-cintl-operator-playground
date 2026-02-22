#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { TranscriptReplayer } from './transcript-replayer';
import { TranscriptExtractor } from './transcript-extractor';
import { MaestroClient } from './maestro-client';
import { WebhookServer } from './webhook-server';
import { loadConfig } from './config';
import { Transcript } from './types';

const program = new Command();

program
  .name('transcript-replay')
  .description('Replay conversation transcripts through Maestro to test language operators')
  .version('1.0.0');

program
  .command('replay')
  .description('Replay a transcript file')
  .argument('<file>', 'Path to transcript JSON file')
  .action(async (file: string) => {
    try {
      // Load configuration from .env
      const config = loadConfig();

      // Validate required configuration
      if (!config.accountSid || !config.authToken || !config.conversationConfigurationId) {
        throw new Error(
          'Missing required environment variables. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and CONVERSATION_CONFIGURATION_ID in .env'
        );
      }

      // Parse transcript
      const transcriptJson = readFileSync(file, 'utf-8');
      const transcript: Transcript = JSON.parse(transcriptJson);

      // Validate transcript structure
      if (!transcript.metadata || !transcript.participants || !transcript.messages) {
        throw new Error('Invalid transcript format. Must include metadata, participants, and messages.');
      }

      // Create clients
      const maestroClient = new MaestroClient(config);
      const webhookServer = new WebhookServer(config.webhookPort, config.webhookPath);

      // Create replayer
      const replayer = new TranscriptReplayer(maestroClient, webhookServer, config);

      // Execute replay
      await replayer.replay(transcript);

      console.log('\n✓ Replay completed successfully');
      process.exit(0);
    } catch (error) {
      if (error instanceof Error) {
        console.error('\n✗ Error:', error.message);
        if (error.stack) {
          console.error('Stack:', error.stack);
        }
      } else {
        console.error('\n✗ Error:', error);
      }
      process.exit(1);
    }
  });

program
  .command('extract')
  .description('Extract a conversation by call SID and save as transcript JSON')
  .argument('<callSid>', 'Call SID to fetch from Maestro (e.g., CA1234567890abcdef1234567890abcd)')
  .option('-o, --output <path>', 'Output file path (default: extracted-transcripts/<callSid>.json)')
  .action(async (callSid: string, options: { output?: string }) => {
    try {
      // Load configuration from .env
      const config = loadConfig();

      // Validate required configuration (conversationConfigurationId not needed for extract)
      if (!config.accountSid || !config.authToken) {
        throw new Error(
          'Missing required environment variables. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env'
        );
      }

      // Create Maestro client
      const maestroClient = new MaestroClient(config);

      // Create extractor
      const extractor = new TranscriptExtractor(maestroClient);

      // Extract the conversation
      const transcript = await extractor.extract(callSid);

      // Determine output path
      const outputPath = options.output || `extracted-transcripts/${callSid}.json`;

      // Create directory if it doesn't exist
      const dir = dirname(outputPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Write the transcript to file (pretty-printed)
      writeFileSync(outputPath, JSON.stringify(transcript, null, 2), 'utf-8');

      console.log(`\n✓ Transcript saved to: ${outputPath}`);
      console.log(`  Name: ${transcript.metadata.name}`);
      console.log(`  Messages: ${transcript.messages.length}`);
      console.log(`  Customer: ${transcript.participants.customer.address} (${transcript.participants.customer.channel})`);
      console.log(`  Agent: ${transcript.participants.agent.address} (${transcript.participants.agent.channel})`);

      process.exit(0);
    } catch (error) {
      if (error instanceof Error) {
        console.error('\n✗ Error:', error.message);
        if (error.stack) {
          console.error('Stack:', error.stack);
        }
      } else {
        console.error('\n✗ Error:', error);
      }
      process.exit(1);
    }
  });

program.parse();
