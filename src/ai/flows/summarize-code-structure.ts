
'use server';

/**
 * @fileOverview Provides a summary of the code's overall structure and functionality,
 * including detected libraries and APIs, enhanced with RAG-style insights.
 *
 * - summarizeCodeStructure - A function that handles the code summarization process.
 * - SummarizeCodeStructureInput - The input type for the summarizeCodeStructure function.
 * - SummarizeCodeStructureOutput - The return type for the summarizeCodeStructure function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeCodeStructureInputSchema = z.object({
  code: z.string().describe('The code to be summarized.'),
});
export type SummarizeCodeStructureInput = z.infer<typeof SummarizeCodeStructureInputSchema>;

const UsedApiSchema = z.object({
    name: z.string().describe('The name of the library, framework, or API.'),
    insight: z.string().describe('A concise, RAG-style insight about this API in the context of the provided code, or its key feature. Written in Korean.'),
});

const SummarizeCodeStructureOutputSchema = z.object({
  summary: z.string().describe('A summary of the code structure and functionality, written in Korean.'),
  usedLibrariesAndAPIs: z.array(UsedApiSchema).describe('A list of libraries, frameworks, or external APIs used in the code. For each, provide a name and a RAG-style insight.'),
});
export type SummarizeCodeStructureOutput = z.infer<typeof SummarizeCodeStructureOutputSchema>;

export async function summarizeCodeStructure(input: SummarizeCodeStructureInput): Promise<SummarizeCodeStructureOutput> {
  return summarizeCodeStructureFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeCodeStructurePrompt',
  input: {schema: SummarizeCodeStructureInputSchema},
  output: {schema: SummarizeCodeStructureOutputSchema},
  prompt: `You are an expert software engineer specializing in code analysis and Retrieval Augmented Generation (RAG).

Your task is to analyze the provided code and generate:
1.  A summary of the code's overall structure and functionality (field 'summary').
2.  A list of any programming libraries, frameworks, or external APIs that are imported or used. For each one (in 'usedLibrariesAndAPIs' array):
    a.  Identify its 'name'.
    b.  Provide a concise, RAG-style 'insight'. This insight should be a one-sentence explanation of the API's key purpose or how it might be used in the context of the provided code, as if you are retrieving this information from a vast knowledge base of API documentation.

Instructions:
-   All textual descriptions (the 'summary' and the 'insight' for each API) MUST be written in Korean.
-   The 'name' of the library can be in English.
-   If no specific libraries or APIs are clearly identifiable, provide an empty array for 'usedLibrariesAndAPIs'.
-   When analyzing the code, interpret content within quotation marks (e.g., "this is a string") as a single unit.

Code:
\`\`\`
{{{code}}}
\`\`\`

Please provide the response in the specified JSON output format.
응답은 한국어로 작성해주세요.`,
});

const summarizeCodeStructureFlow = ai.defineFlow(
  {
    name: 'summarizeCodeStructureFlow',
    inputSchema: SummarizeCodeStructureInputSchema,
    outputSchema: SummarizeCodeStructureOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
