
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
import fs from 'fs';
import path from 'path';

const ChatWithCodeInputSchema = z.object({
  code: z.string().describe('The code context for the chat.'),
  question: z.string().describe('The user_s question about the code.'),
  additionalContext: z.string().optional().describe('Optional additional context, e.g., from an uploaded PDF or internal RAG document.'),
});
export type ChatWithCodeInput = z.infer<typeof ChatWithCodeInputSchema>;

const ChatWithCodeOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer to the question, in Korean.'),
});
export type ChatWithCodeOutput = z.infer<typeof ChatWithCodeOutputSchema>;

export async function chatWithCode(input: ChatWithCodeInput): Promise<ChatWithCodeOutput> {
  let combinedContext = input.additionalContext || '';

  // Attempt to find relevant internal RAG documents
  const ragDocsPath = path.join(process.cwd(), 'src', 'rag-docs');
  try {
    const questionKeywords = input.question.toLowerCase().match(/\b\w{3,}\b/g) || []; // Extract words with 3+ chars
    const codeKeywords = input.code.toLowerCase().match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || []; // Extract potential identifiers
    
    const uniqueKeywords = Array.from(new Set([...questionKeywords, ...codeKeywords]));

    if (fs.existsSync(ragDocsPath)) {
      const filesInRagDir = fs.readdirSync(ragDocsPath);
      for (const keyword of uniqueKeywords) {
        // Try to match keyword with filenames (e.g., "useState" -> "react-useState.md" or "useState.md")
        const potentialFiles = filesInRagDir.filter(file => 
          file.toLowerCase().replace(/\.(md|txt)$/, '').includes(keyword)
        );

        for (const matchedFile of potentialFiles) {
          const filePath = path.join(ragDocsPath, matchedFile);
          if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            if (combinedContext) {
              combinedContext += `\n\n--- Internal Document: ${matchedFile} ---\n${fileContent}`;
            } else {
              combinedContext = `--- Internal Document: ${matchedFile} ---\n${fileContent}`;
            }
            // For simplicity, load first matched document per keyword or refine as needed
            // To avoid overly long context, maybe only load one or two most relevant docs.
            // For now, let's add all found related documents for a keyword.
          }
        }
      }
    }
  } catch (e) {
    console.warn("Error accessing or reading RAG documents:", e);
    // Proceed without internal RAG context if there's an error
  }
  
  const finalInput = {
    ...input,
    additionalContext: combinedContext || undefined, // Pass undefined if context is still empty
  };

  return chatWithCodeFlow(finalInput);
}

const prompt = ai.definePrompt({
  name: 'chatWithCodePrompt',
  input: {schema: ChatWithCodeInputSchema},
  output: {schema: ChatWithCodeOutputSchema},
  prompt: `You are a helpful AI coding assistant. The user will provide you with a code snippet and a question about that code.
{{#if additionalContext}}
The user has also provided the following additional context (which may include uploaded documents or relevant internal API documentation). You should prioritize and refer to this context when answering the question:
Context:
\`\`\`
{{{additionalContext}}}
\`\`\`
{{/if}}
Your task is to answer the question based on the provided code and any additional context.

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
  async (input) => {
    // The context augmentation is now done in the exported chatWithCode function
    const {output} = await prompt(input);
    return output!;
  }
);
