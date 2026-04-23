import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  stream?: boolean;
  model?: string;
}

@Injectable()
export class ChatService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('QIANWEN_API_KEY', '');
    this.defaultModel = this.configService.get<string>('QIANWEN_MODEL', 'qwen-turbo');

    if (!this.apiKey || this.apiKey === 'sk-your-qianwen-api-key-here') {
      console.warn('\n⚠️  WARNING: 通义千问API Key未配置！');
      console.warn('   请在 .env 文件中设置 QIANWEN_API_KEY\n');
    }
  }

  /**
   * 非流式对话 - 一次性返回完整回答
   */
  async chat(request: ChatRequest): Promise<string> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model || this.defaultModel,
          messages: request.messages,
          stream: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new HttpException(
          `通义千问API错误: ${error}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '无响应内容';
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        `请求失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 流式对话 - 返回SSE流
   */
  async *chatStream(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          model: request.model || this.defaultModel,
          messages: request.messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new HttpException(
          `通义千问API错误: ${error}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new HttpException('无法读取响应流', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') return;

          try {
            const data = JSON.parse(dataStr);
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // 忽略解析失败的行
          }
        }
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        `流式请求失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
