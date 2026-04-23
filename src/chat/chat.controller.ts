import {
  Controller,
  Post,
  Body,
  UseGuards,
  Res,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChatService, ChatMessage } from './chat.service';

class ChatRequestDto {
  messages: ChatMessage[];
  stream?: boolean;
  model?: string;
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * POST /chat
   * 普通对话（非流式）
   * 需要JWT认证
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async chat(@Body() body: ChatRequestDto) {
    const content = await this.chatService.chat({
      messages: body.messages,
      model: body.model,
    });
    return { content };
  }

  /**
   * POST /chat/stream
   * 流式对话（SSE）
   * 需要JWT认证
   * 
   * 返回格式：
   *   data: {"token": "你好"}\n\n
   *   data: {"token": "！"}\n\n
   *   data: [DONE]\n\n
   */
  @Post('stream')
  @UseGuards(JwtAuthGuard)
  async chatStream(@Body() body: ChatRequestDto, @Res() res: Response) {
    try {
      // 设置SSE响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲
      res.status(HttpStatus.OK);

      const stream = this.chatService.chatStream({
        messages: body.messages,
        model: body.model,
      });

      for await (const token of stream) {
        // SSE格式：data: {...}\n\n
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }

      // 发送结束标记
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      // 如果响应头还未发送，返回JSON错误
      if (!res.headersSent) {
        throw error;
      }
      // 如果已经开始流式响应，通过SSE发送错误
      const message = error instanceof HttpException
        ? error.message
        : '流式响应异常';
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  }
}
