
'use server';
import { summarizeCodeStructure, type SummarizeCodeStructureInput, type SummarizeCodeStructureOutput } from '@/ai/flows/summarize-code-structure';
import { explainCodeSegment, type ExplainCodeSegmentInput, type ExplainCodeSegmentOutput } from '@/ai/flows/explain-code-segment';
import { chatWithCode, type ChatWithCodeInput, type ChatWithCodeOutput } from '@/ai/flows/chat-with-code-flow';
// Ensure explainCodeLine and ExplainCodeLineInput/Output are correctly typed if they are aliases
import { explainCodeSegment as explainCodeLine, type ExplainCodeSegmentInput as ExplainCodeLineInput, type ExplainCodeSegmentOutput as ExplainCodeLineOutput } from '@/ai/flows/explain-code-segment';
import { z } from 'zod';

const SummarizeInputSchema = z.object({
  code: z.string(),
});

const ExplainInputSchema = z.object({
  code: z.string(),
  codeSegment: z.string(),
});

const ChatInputSchema = z.object({
  code: z.string(),
  question: z.string(),
});


export async function analyzeCodeStructureAction(input: SummarizeCodeStructureInput): Promise<SummarizeCodeStructureOutput> {
  try {
    const validatedInput = SummarizeInputSchema.parse(input);
    return await summarizeCodeStructure(validatedInput);
  } catch (error) {
    console.error("Error in analyzeCodeStructureAction:", error);
    if (error instanceof z.ZodError) {
      throw new Error(`입력값이 잘못되었습니다: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new Error("내부 오류로 인해 코드 구조 분석에 실패했습니다.");
  }
}

export async function explainCodeSegmentAction(input: ExplainCodeSegmentInput): Promise<ExplainCodeSegmentOutput> {
  try {
    const validatedInput = ExplainInputSchema.parse(input);
    return await explainCodeSegment(validatedInput);
  } catch (error) {
    console.error("Error in explainCodeSegmentAction:", error);
     if (error instanceof z.ZodError) {
      return { explanation: `코드 조각 설명 입력이 잘못되었습니다: ${error.errors.map(e => e.message).join(', ')}` };
    }
    // Ensure a valid ExplainCodeSegmentOutput structure is returned
    return { explanation: "죄송합니다. 이 코드 조각에 대한 설명을 가져오는 중 오류가 발생했습니다." };
  }
}

export async function explainCodeLineAction(input: ExplainCodeLineInput): Promise<ExplainCodeLineOutput> {
  try {
    const validatedInput = ExplainInputSchema.parse(input);
    return await explainCodeLine(validatedInput);
  } catch (error) {
    console.error("Error in explainCodeLineAction:", error);
    if (error instanceof z.ZodError) {
      return { explanation: `라인 설명 입력이 잘못되었습니다: ${error.errors.map(e => e.message).join(', ')}` };
    }
    return { explanation: "죄송합니다. 이 라인에 대한 설명을 가져오는 중 오류가 발생했습니다." };
  }
}

export async function chatWithCodeAction(input: ChatWithCodeInput): Promise<ChatWithCodeOutput> {
  try {
    const validatedInput = ChatInputSchema.parse(input);
    return await chatWithCode(validatedInput);
  } catch (error) {
    console.error("Error in chatWithCodeAction:", error);
    if (error instanceof z.ZodError) {
      return { answer: `채팅 입력이 잘못되었습니다: ${error.errors.map(e => e.message).join(', ')}` };
    }
    return { answer: "죄송합니다. 질문에 대한 답변을 생성하는 중 오류가 발생했습니다." };
  }
}
