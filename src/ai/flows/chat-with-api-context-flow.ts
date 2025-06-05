
'use server';
/**
 * @fileOverview Handles chat interactions about a specific API, using provided context.
 *
 * - chatWithApiContext - A function that answers questions about a given API using its context.
 * - ChatWithApiContextInput - The input type for the chatWithApiContext function.
 * - ChatWithApiContextOutput - The return type for the chatWithApiContext function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChatWithApiContextInputSchema = z.object({
  apiName: z.string().describe('The name of the API being discussed.'),
  apiContextDetails: z.string().describe('Contextual information about the API, such as its description, example titles, and usage notes.'),
  question: z.string().describe('The user_s question about the API.'),
});
export type ChatWithApiContextInput = z.infer<typeof ChatWithApiContextInputSchema>;

const ChatWithApiContextOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer to the question, in Korean.'),
});
export type ChatWithApiContextOutput = z.infer<typeof ChatWithApiContextOutputSchema>;

export async function chatWithApiContext(input: ChatWithApiContextInput): Promise<ChatWithApiContextOutput> {
  return chatWithApiContextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'chatWithApiContextPrompt',
  input: {schema: ChatWithApiContextInputSchema},
  output: {schema: ChatWithApiContextOutputSchema},
  prompt: `You are an AI assistant specializing in providing information about software APIs and libraries.
The user has selected an API and received some initial information about it. Now they have follow-up questions.
Use the provided API context below to answer the user's question. If the context doesn't fully answer the question, you can use your general knowledge about the API.

API Name: {{{apiName}}}

Contextual Information:
\`\`\`
{{{apiContextDetails}}}
\`\`\`

User's Question:
{{{question}}}

Answer (in Korean):
`,
});

const chatWithApiContextFlow = ai.defineFlow(
  {
    name: 'chatWithApiContextFlow',
    inputSchema: ChatWithApiContextInputSchema,
    outputSchema: ChatWithApiContextOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
