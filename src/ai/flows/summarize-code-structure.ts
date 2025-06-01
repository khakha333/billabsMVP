
'use server';

/**
 * @fileOverview Provides a summary of the code's overall structure and functionality,
 * including detected libraries and APIs.
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

const SummarizeCodeStructureOutputSchema = z.object({
  summary: z.string().describe('A summary of the code structure and functionality, written in Korean.'),
  usedLibrariesAndAPIs: z.array(z.string()).describe('A list of libraries, frameworks, or external APIs used in the code. If none are detected, provide an empty array. The list itself can contain English names if those are the official names, but the summary should be in Korean.'),
});
export type SummarizeCodeStructureOutput = z.infer<typeof SummarizeCodeStructureOutputSchema>;

export async function summarizeCodeStructure(input: SummarizeCodeStructureInput): Promise<SummarizeCodeStructureOutput> {
  return summarizeCodeStructureFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeCodeStructurePrompt',
  input: {schema: SummarizeCodeStructureInputSchema},
  output: {schema: SummarizeCodeStructureOutputSchema},
  prompt: `You are an expert software engineer specializing in code analysis.

Your task is to analyze the provided code and generate:
1.  A summary of the code's overall structure and functionality.
2.  A list of any programming libraries, frameworks, or external APIs that are imported or used within the code.

Instructions:
-   The summary (field 'summary') MUST be written in Korean.
-   The list of libraries and APIs (field 'usedLibrariesAndAPIs') can contain their original English names if applicable, but if you describe them in the summary, use Korean. If no specific libraries or APIs are clearly identifiable, provide an empty array for 'usedLibrariesAndAPIs'.
-   When analyzing the code, interpret content within quotation marks (e.g., "this is a string" or 'this is also a string') as a single phrase or sentence unit, especially if it seems to represent user-facing text, configuration values, or important identifiers.

Code:
\`\`\`
{{{code}}}
\`\`\`

Please provide the response in the specified output format.
응답은 한국어로 작성해주세요. (All textual descriptions and summaries MUST be in Korean.)`,
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
