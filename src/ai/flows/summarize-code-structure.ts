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
  summary: z.string().describe('A summary of the code structure and functionality.'),
  usedLibrariesAndAPIs: z.array(z.string()).describe('A list of libraries, frameworks, or external APIs used in the code. If none are detected, provide an empty array.'),
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

You will use the following code to generate a summary of the code's overall structure and functionality.
Identify any programming libraries, frameworks, or external APIs that are imported or used within the code. List them in the 'usedLibrariesAndAPIs' field. If no specific libraries or APIs are clearly identifiable, provide an empty array for 'usedLibrariesAndAPIs'.

Code: {{{code}}}`,
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
