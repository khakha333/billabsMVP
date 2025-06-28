'use server';
/**
 * @fileOverview Modifies a piece of code based on user instructions.
 *
 * - modifyCode - A function that takes code and a prompt, and returns the modified code.
 * - ModifyCodeInput - The input type for the flow.
 * - ModifyCodeOutput - The return type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ModifyCodeInputSchema = z.object({
  code: z.string().describe('The original source code to be modified.'),
  prompt: z
    .string()
    .describe(
      'The user instruction describing the desired modification. (e.g., "Add comments to this function", "Refactor this to use async/await")'
    ),
  fileName: z.string().optional().describe('The name of the file, for context.'),
});
export type ModifyCodeInput = z.infer<typeof ModifyCodeInputSchema>;

const ModifyCodeOutputSchema = z.object({
  modifiedCode: z.string().describe('The complete, modified source code.'),
  explanation: z
    .string()
    .describe(
      'A brief, step-by-step explanation of the changes made, in Korean.'
    ),
});
export type ModifyCodeOutput = z.infer<typeof ModifyCodeOutputSchema>;

export async function modifyCode(
  input: ModifyCodeInput
): Promise<ModifyCodeOutput> {
  return modifyCodeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'modifyCodePrompt',
  input: {schema: ModifyCodeInputSchema},
  output: {schema: ModifyCodeOutputSchema},
  prompt: `You are an expert AI programmer. Your task is to modify the provided source code based on the user's instructions.
You MUST return the complete, modified code, not just the changed snippet.
Also, provide a brief, step-by-step explanation of the changes you made, in Korean.

Do not add any comments to the code unless specifically asked to.

{{#if fileName}}
File Name: {{{fileName}}}
{{/if}}

User's Modification Request:
"{{{prompt}}}"

Original Code:
\`\`\`
{{{code}}}
\`\`\`

Respond in the specified JSON format with the full modified code and your explanation.
`,
});

const modifyCodeFlow = ai.defineFlow(
  {
    name: 'modifyCodeFlow',
    inputSchema: ModifyCodeInputSchema,
    outputSchema: ModifyCodeOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
