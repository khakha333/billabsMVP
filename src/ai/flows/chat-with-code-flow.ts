
'use server';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * @fileOverview Handles chat interactions about code, with RAG capabilities.
 *
 * - chatWithCode - A function that answers questions about a given code snippet,
 *   potentially augmented with context from local documentation.
 * - ChatWithCodeInput - The input type for the chatWithCode function.
 * - ChatWithCodeOutput - The return type for the chatWithCode function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChatWithCodeInputSchema = z.object({
  code: z.string().describe('The code context for the chat.'),
  question: z.string().describe('The user_s question about the code.'),
  additionalContext: z.string().optional().describe('Optional. Additional context provided by the user, like uploaded documentation.'),
});
export type ChatWithCodeInput = z.infer<typeof ChatWithCodeInputSchema>;

const ChatWithCodeOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer to the question, in Korean.'),
});
export type ChatWithCodeOutput = z.infer<typeof ChatWithCodeOutputSchema>;

export async function chatWithCode(input: ChatWithCodeInput): Promise<ChatWithCodeOutput> {
  return chatWithCodeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'chatWithCodePrompt',
  input: {schema: ChatWithCodeInputSchema},
  output: {schema: ChatWithCodeOutputSchema},
  prompt: `You are a helpful AI coding assistant. Your task is to answer the user's question based on the provided code and any additional context.

When provided, the "Additional Context" section contains important documentation or user-provided information. You MUST prioritize this context when formulating your answer.

Provide your answers in Korean.

Code:
\`\`\`
{{{code}}}
\`\`\`
{{#if additionalContext}}

Additional Context (Prioritize this information):
\`\`\`
{{{additionalContext}}}
\`\`\`
{{/if}}

User's Question:
{{{question}}}

Answer (in Korean):
`,
});

async function findAndReadDocs(text: string): Promise<string> {
    const docDir = path.join(process.cwd(), 'src', 'rag-docs');
    try {
        const files = await fs.readdir(docDir);
        const keywords = text.toLowerCase().match(/\b[a-zA-Z]{3,}\b/g) || [];
        const uniqueKeywords = [...new Set(keywords)];

        const relevantFiles = files.filter(file => 
            uniqueKeywords.some(keyword => file.toLowerCase().replace(/\.(md|txt)$/, '').includes(keyword))
        );

        if (relevantFiles.length === 0) return '';
        
        const contentPromises = relevantFiles.map(file => fs.readFile(path.join(docDir, file), 'utf-8'));
        const contents = await Promise.all(contentPromises);
        
        return contents.join('\n\n---\n\n');

    } catch (error) {
        // If the directory doesn't exist or there's a reading error, just return empty string.
        console.log("Could not read RAG docs, proceeding without them.");
        return '';
    }
}

const chatWithCodeFlow = ai.defineFlow(
  {
    name: 'chatWithCodeFlow',
    inputSchema: ChatWithCodeInputSchema,
    outputSchema: ChatWithCodeOutputSchema,
  },
  async (input) => {
    // 1. Combine user's question and code to find relevant docs.
    const combinedTextForSearch = `${input.question} ${input.code}`;
    const internalDocsContext = await findAndReadDocs(combinedTextForSearch);

    // 2. Combine all contexts. User-provided context comes first.
    let finalContext = '';
    if (input.additionalContext) {
        finalContext += input.additionalContext;
    }
    if (internalDocsContext) {
        finalContext += `\n\n--- Internal Documentation ---\n${internalDocsContext}`;
    }
    
    // 3. Call the prompt with the augmented context.
    const {output} = await prompt({
        ...input,
        additionalContext: finalContext.trim() || undefined, // Use undefined if empty
    });

    return output!;
  }
);
