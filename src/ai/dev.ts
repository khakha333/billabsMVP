
import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-code-structure.ts';
import '@/ai/flows/explain-code-segment.ts';
import '@/ai/flows/chat-with-code-flow.ts';
import '@/ai/flows/generate-api-examples-flow.ts';
import '@/ai/flows/chat-with-api-context-flow.ts';
import '@/ai/flows/analyze-github-repo-flow.ts';
import '@/ai/flows/analyze-dependencies-flow.ts'; // Added new flow
