import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { slides_v1 } from 'googleapis';
import {
  CreatePresentationArgsSchema,
  GetPresentationArgsSchema,
  BatchUpdatePresentationArgsSchema,
  GetPageArgsSchema,
  SummarizePresentationArgsSchema,
} from './schemas.js';
import { createPresentationTool } from './tools/createPresentation.js';
import { getPresentationTool } from './tools/getPresentation.js';
import { batchUpdatePresentationTool } from './tools/batchUpdatePresentation.js';
import { getPageTool } from './tools/getPage.js';
import { summarizePresentationTool } from './tools/summarizePresentation.js';
import { executeTool } from './utils/toolExecutor.js';
import { tools } from './tools.js';

export const setupToolHandlers = (server: Server, slides: slides_v1.Slides) => {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'create_presentation':
        return executeTool(slides, name, args, CreatePresentationArgsSchema, createPresentationTool);
      case 'get_presentation':
        return executeTool(slides, name, args, GetPresentationArgsSchema, getPresentationTool);
      case 'batch_update_presentation':
        return executeTool(slides, name, args, BatchUpdatePresentationArgsSchema, batchUpdatePresentationTool);
      case 'get_page':
        return executeTool(slides, name, args, GetPageArgsSchema, getPageTool);
      case 'summarize_presentation':
        return executeTool(slides, name, args, SummarizePresentationArgsSchema, summarizePresentationTool);
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool requested: ${name}` }],
          isError: true,
          errorCode: ErrorCode.MethodNotFound,
        };
    }
  });
};
