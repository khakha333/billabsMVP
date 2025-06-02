
'use server';
/**
 * @fileOverview Handles chat interactions about code.
 *
 * - chatWithCode - A function that answers questions about a given code snippet.
 * - ChatWithCodeInput - The input type for the chatWithCode function.
 * - ChatWithCodeOutput - The return type for the chatWithCode function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChatWithCodeInputSchema = z.object({
  code: z.string().describe('The code context for the chat.'),
  question: z.string().describe('The user_s question about the code.'),
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
  prompt: `You are a helpful AI coding assistant. The user will provide you with a code snippet and a question about that code. Your task is to answer the question based on the provided code.

Provide your answers in Korean.

Code:
\`\`\`
{{{code}}}
\`\`\`

User's Question:
{{{question}}}

Answer (in Korean):
`,
});

const chatWithCodeFlow = ai.defineFlow(
  {
    name: 'chatWithCodeFlow',
    inputSchema: ChatWithCodeInputSchema,
    outputSchema: ChatWithCodeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
