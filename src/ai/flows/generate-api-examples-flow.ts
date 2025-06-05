
'use server';
/**
 * @fileOverview Generates usage examples and a guide for a specified API/library.
 *
 * - generateApiExamples - A function that provides examples and usage notes for an API.
 * - GenerateApiExamplesInput - The input type for the generateApiExamples function.
 * - GenerateApiExamplesOutput - The return type for the generateApiExamples function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateApiExamplesInputSchema = z.object({
  apiName: z.string().describe('The name of the API/library for which to generate examples.'),
  userCodeContext: z.string().optional().describe('Optional. The user_s current code, which might provide context for more relevant examples.'),
});
export type GenerateApiExamplesInput = z.infer<typeof GenerateApiExamplesInputSchema>;

const ApiExampleSchema = z.object({
  title: z.string().describe('A short, descriptive title for the code example. In Korean.'),
  description: z.string().describe('A brief explanation of what the example does. In Korean.'),
  codeSnippet: z.string().describe('A runnable code snippet demonstrating the API usage.'),
});

const GenerateApiExamplesOutputSchema = z.object({
  apiName: z.string().describe('The name of the API/library.'),
  briefDescription: z.string().describe('A concise overview of the API/library. In Korean.'),
  examples: z.array(ApiExampleSchema).describe('A list of usage examples.'),
  generalUsageNotes: z.string().optional().describe('General tips, common patterns, or pitfalls when using this API. In Korean.'),
});
export type GenerateApiExamplesOutput = z.infer<typeof GenerateApiExamplesOutputSchema>;

export async function generateApiExamples(input: GenerateApiExamplesInput): Promise<GenerateApiExamplesOutput> {
  return generateApiExamplesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateApiExamplesPrompt',
  input: {schema: GenerateApiExamplesInputSchema},
  output: {schema: GenerateApiExamplesOutputSchema},
  prompt: `You are an expert software development assistant.
The user wants to understand how to use the API/library: {{{apiName}}}.
{{#if userCodeContext}}
The user is currently working with the following code, which might provide context for the kind of examples they are looking for:
\`\`\`
{{{userCodeContext}}}
\`\`\`
{{/if}}

Please provide the following information about "{{{apiName}}}", ensuring all textual descriptions are in Korean:
1.  A brief description of what the API/library is and its main purpose. (field 'briefDescription')
2.  A few (2-4) diverse and practical code examples. For each example (in 'examples' array), include:
    *   A short title (field 'title').
    *   A brief description of what the example demonstrates (field 'description').
    *   A runnable code snippet (field 'codeSnippet').
3.  Optional: Any general usage notes, common patterns, or important considerations/pitfalls when using this API (field 'generalUsageNotes').

Respond in the structured format defined by the output schema. All descriptive text (descriptions, notes, example titles and descriptions) MUST be in Korean. Code snippets should be in their original language.
`,
});

const generateApiExamplesFlow = ai.defineFlow(
  {
    name: 'generateApiExamplesFlow',
    inputSchema: GenerateApiExamplesInputSchema,
    outputSchema: GenerateApiExamplesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
