'use server';
/**
 * @fileOverview An AI flow to review code and provide suggestions.
 *
 * - reviewCode - A function that reviews code for improvements.
 * - ReviewCodeInput - The input type for the flow.
 * - ReviewCodeOutput - The return type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ReviewCodeInputSchema = z.object({
  code: z.string().describe('The source code to be reviewed.'),
  fileName: z.string().optional().describe('The name of the file being reviewed, for context.'),
});
export type ReviewCodeInput = z.infer<typeof ReviewCodeInputSchema>;

const SuggestionSchema = z.object({
  lineStart: z.number().describe('The starting line number of the code segment related to the suggestion.'),
  lineEnd: z.number().describe('The ending line number of the code segment.'),
  severity: z.enum(['Info', 'Low', 'Medium', 'High']).describe('The severity of the issue.'),
  title: z.string().describe('A brief, one-line title for the suggestion.'),
  suggestion: z.string().describe('A detailed explanation of the issue and how to fix it, in Korean.'),
});

export type Suggestion = z.infer<typeof SuggestionSchema>;

const ReviewCodeOutputSchema = z.object({
  suggestions: z.array(SuggestionSchema).describe('A list of review suggestions for the provided code.'),
});
export type ReviewCodeOutput = z.infer<typeof ReviewCodeOutputSchema>;

export async function reviewCode(input: ReviewCodeInput): Promise<ReviewCodeOutput> {
  return reviewCodeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'reviewCodePrompt',
  input: {schema: ReviewCodeInputSchema},
  output: {schema: ReviewCodeOutputSchema},
  prompt: `You are an expert code reviewer with years of experience in software development.
Your task is to analyze the provided source code and identify areas for improvement.

For each issue you find, provide a suggestion with the following details:
-   **lineStart & lineEnd**: The exact line numbers where the issue is located.
-   **severity**: Classify the severity as 'High', 'Medium', 'Low', or 'Info'.
    -   'High': Potential bugs, security vulnerabilities, or major performance issues.
    -   'Medium': Bad practices, non-performant code, or things that could lead to bugs.
    -   'Low': Readability issues, complex logic, or deviations from best practices.
    -   'Info': General suggestions, style notes, or opportunities for modernization.
-   **title**: A short, descriptive title for the suggestion.
-   **suggestion**: A clear, constructive explanation of the problem and a recommended solution.

All textual feedback (title and suggestion) MUST be in Korean.
Do not suggest adding comments to the code.
If the code is perfect and has no issues, return an empty array for 'suggestions'.

{{#if fileName}}
File Name: {{{fileName}}}
{{/if}}

Code to Review:
\`\`\`
{{{code}}}
\`\`\`

Provide the output in the specified JSON format.
`,
});

const reviewCodeFlow = ai.defineFlow(
  {
    name: 'reviewCodeFlow',
    inputSchema: ReviewCodeInputSchema,
    outputSchema: ReviewCodeOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
