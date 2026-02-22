#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { TranscriptReplayer } from './transcript-replayer';
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

program.parse();
