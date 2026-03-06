#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { checkEnvironmentVariables } from './utils/envCheck.js';
import { getStartupErrorMessage } from './utils/errorHandler.js';
import { setupToolHandlers } from './serverHandlers.js';

// Log build fingerprint at startup
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const buildInfo = JSON.parse(readFileSync(join(__dirname, 'build-info.json'), 'utf-8'));
  console.error(`[build] SHA: ${buildInfo.sha} (${buildInfo.builtAt})`);
} catch {
  // build-info.json not present (dev mode)
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

// Check required environment variables before proceeding
checkEnvironmentVariables();

const initializeAndRunServer = async () => {
  try {
    const server = new Server(
      {
        name: 'google-slides-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
    oauth2Client.setCredentials({
      refresh_token: REFRESH_TOKEN,
    });

    const slides = google.slides({
      version: 'v1',
      auth: oauth2Client,
    });

    setupToolHandlers(server, slides);

    server.onerror = (error: Error) => console.error('[MCP Server Error]', error);

    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down server...');
      await server.close();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down server...');
      await server.close();
      process.exit(0);
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Google Slides MCP server running and connected via stdio.');
  } catch (error: unknown) {
    const errorMessage = getStartupErrorMessage(error);
    console.error('Failed to start Google Slides MCP server:', errorMessage, error);
    process.exit(1);
  }
};

void initializeAndRunServer();
