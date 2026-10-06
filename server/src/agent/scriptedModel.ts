import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, type BaseMessage } from '@langchain/core/messages';
import type { ModelProfile } from '@langchain/core/language_models/profile';
import type { ChatResult } from '@langchain/core/outputs';

type Script = readonly AIMessage[] | ((callIndex: number) => AIMessage);

/**
 * Fake chat model for tests: replies with scripted messages, so the real agent loop, tools
 * and memory run without calling Claude. It records every message list it receives.
 */
export class ScriptedChatModel extends BaseChatModel {
  readonly received: BaseMessage[][] = [];
  private callIndex = 0;

  constructor(private readonly script: Script) {
    super({});
  }

  /** `structuredOutput` makes the agent use native structured output, as it does with Claude. */
  override get profile(): ModelProfile {
    return { structuredOutput: true };
  }

  _llmType(): string {
    return 'scripted';
  }

  override bindTools(): this {
    return this;
  }

  _generate(messages: BaseMessage[]): Promise<ChatResult> {
    this.received.push(messages);
    const next =
      typeof this.script === 'function' ? this.script(this.callIndex) : this.script[this.callIndex];
    this.callIndex++;
    if (!next) return Promise.reject(new Error('ScriptedChatModel: script exhausted'));
    return Promise.resolve({ generations: [{ text: next.text, message: next }] });
  }
}

/** An AI message that calls a tool. */
export function callTool(
  name: string,
  args: Record<string, unknown>,
  id = `call-${name}`,
): AIMessage {
  return new AIMessage({ content: '', tool_calls: [{ name, args, id, type: 'tool_call' }] });
}

/** An AI message with the final answer as JSON (native structured output). */
export function finalAnswer(answer: Record<string, unknown>): AIMessage {
  return new AIMessage({ content: JSON.stringify(answer) });
}
