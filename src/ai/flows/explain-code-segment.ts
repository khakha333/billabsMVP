
'use server';

/**
 * @fileOverview Explains a specific segment of code using AI, including its functionality and impact.
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
type ExplainCodeSegmentInput = z.infer<typeof ExplainCodeSegmentInputSchema>;

const ExplainCodeSegmentOutputSchema = z.object({
  explanation: z.string().describe('The AI-generated explanation of the code segment, written in Korean.'),
});
type ExplainCodeSegmentOutput = z.infer<typeof ExplainCodeSegmentOutputSchema>;

export async function explainCodeSegment(input: ExplainCodeSegmentInput): Promise<ExplainCodeSegmentOutput> {
  return explainCodeSegmentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'explainCodeSegmentPrompt',
  input: {schema: ExplainCodeSegmentInputSchema},
  output: {schema: ExplainCodeSegmentOutputSchema},
  prompt: `You are an expert software engineer specializing in code analysis and impact assessment.
Your task is to analyze the provided 'Code Segment' within the context of the 'Full Code' and explain both its functionality and its potential impact.

Instructions:
1.  **Functionality First**: Start by explaining what the 'Code Segment' does or represents.
    *   **Function Definition**: If it's a function definition, explain its purpose, parameters, return value, and core logic.
    *   **Function Call**: If it's a function call, explain what the function being called does.
    *   **Variable/Constant**: If it's a variable or constant, explain its purpose and the value it holds.
    *   **String/Comment**: If it's a string literal or comment, explain its meaning in the context.
    *   **Other code**: Explain the purpose of any other code structure.

2.  **Impact Analysis**: After explaining the functionality, analyze and describe its potential impact.
    *   **Exports**: If the segment is part of an \`export\` statement (e.g., an exported function or variable), explicitly state that "이 코드는 외부로 내보내지므로(export), 이 파일을 가져오는(import) 다른 파일들에게 영향을 줄 수 있습니다." (This code is exported, so it can affect other files that import it).
    *   **Function Calls**: When explaining a function call, consider its side effects. Does it modify state? Does it interact with an external API? Mention how the result of this call is used later in the code.
    *   **State Changes**: If the code modifies a variable that is used elsewhere in the 'Full Code' (especially state variables in frameworks like React), mention which other parts of the code might be affected by this change.
    *   **General Impact**: If none of the above are obvious, provide a general assessment of the segment's role and importance within the file.

3.  **Formatting**: Provide a clear and concise answer. Use bullet points or paragraphs to separate the functionality explanation from the impact analysis.

4.  **Language**: All explanations MUST be in Korean.

Full Code:
\`\`\`
{{{code}}}
\`\`\`

Code Segment to Analyze:
\`\`\`
{{{codeSegment}}}
\`\`\`

Analysis (in Korean):
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
