
'use server';

/**
 * @fileOverview Explains a specific segment of code using AI.
 *
 * - explainCodeSegment - A function that explains a given code segment.
 * - ExplainCodeSegmentInput - The input type for the explainCodeSegment function.
 * - ExplainCodeSegmentOutput - The return type for the explainCodeSegment function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExplainCodeSegmentInputSchema = z.object({
  code: z.string().describe('The entire code in which the segment is found.'),
  codeSegment: z.string().describe('The specific code segment to explain. This could be a token, a selected piece of text, a string literal, or a function name.'),
});
export type ExplainCodeSegmentInput = z.infer<typeof ExplainCodeSegmentInputSchema>;

const ExplainCodeSegmentOutputSchema = z.object({
  explanation: z.string().describe('The AI-generated explanation of the code segment, written in Korean.'),
});
export type ExplainCodeSegmentOutput = z.infer<typeof ExplainCodeSegmentOutputSchema>;

export async function explainCodeSegment(input: ExplainCodeSegmentInput): Promise<ExplainCodeSegmentOutput> {
  return explainCodeSegmentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'explainCodeSegmentPrompt',
  input: {schema: ExplainCodeSegmentInputSchema},
  output: {schema: ExplainCodeSegmentOutputSchema},
  prompt: `You are an expert software developer.
Your task is to explain the provided 'Code Segment' within the context of the 'Full Code'.

Instructions:
1.  If the 'Code Segment' is a string literal (e.g., "text" or 'text'), explain its purpose or meaning as a single unit, considering its role in the 'Full Code'.
2.  If the 'Code Segment' appears to be a function name (e.g., 'myFunction', 'calculateValue'), first locate the complete definition of this function (including its signature and full body) within the 'Full Code'. Then, explain the function's overall purpose, its specific logic and behavior, its parameters (if any), and what it returns (if anything). Do not just explain that it is a function identifier; explain what the function *does* based on its implementation.
3.  For any other 'Code Segment' (like a variable, a keyword in context, a user-selected block of code, or a comment including those starting with '#'), provide a concise explanation of what that specific piece of code does or represents within the 'Full Code'.
4.  When analyzing any code, interpret content within quotation marks (e.g., "this is a string" or 'this is also a string') and comments (e.g. // a comment, /* block comment */, # python comment) as a single phrase or sentence unit, especially if it seems to represent user-facing text, configuration values, important identifiers, or developer notes.
5.  All explanations MUST be in Korean.

Full Code:
\`\`\`
{{{code}}}
\`\`\`

Code Segment:
\`\`\`
{{{codeSegment}}}
\`\`\`

Explanation (in Korean):
`,
});

const explainCodeSegmentFlow = ai.defineFlow(
  {
    name: 'explainCodeSegmentFlow',
    inputSchema: ExplainCodeSegmentInputSchema,
    outputSchema: ExplainCodeSegmentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
