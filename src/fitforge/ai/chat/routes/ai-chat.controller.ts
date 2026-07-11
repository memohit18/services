import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { successResponse } from '../../../../common/utils/api-response';
import { CreateAiSessionDto } from '../dto/create-ai-session.dto';
import { AiChatDto } from '../dto/ai-chat.dto';
import { SendAiMessageDto } from '../dto/send-ai-message.dto';
import { AiChatService } from '../services/ai-chat.service';

@ApiTags('AI Coach (Phase 8.3)')
@ApiBearerAuth()
@Controller('ai')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('chat')
  @ApiOperation({
    summary:
      'AI Coach chat — Context Builder → Prompt → Gemini → Validator → Storage',
  })
  @ApiResponse({ status: 200, description: '{ question, answer, timestamp, contextVersion, sessionId }' })
  chat(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: AiChatDto,
  ) {
    return this.aiChatService
      .chat(user.userId, dto.sessionId, dto.message)
      .then((data) => successResponse(data, 'Message sent'));
  }

  @Get('history')
  @ApiOperation({
    summary: 'List AI Coach Q/A history (flattened turns across sessions)',
  })
  @ApiResponse({ status: 200 })
  getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.aiChatService.getHistory(user.userId, query);
  }

  @Delete('history/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Delete a history turn (assistant message id) or an entire session id',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Not found' })
  deleteHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.aiChatService
      .deleteHistory(user.userId, id)
      .then((data) => successResponse(data, 'History deleted'));
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Start a new chat session' })
  createSession(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateAiSessionDto,
  ) {
    return this.aiChatService
      .createSession(user.userId, dto)
      .then((data) => successResponse(data, 'Chat session created'));
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List chat sessions' })
  listSessions(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.aiChatService.listSessions(user.userId, query);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get chat session' })
  getSession(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.aiChatService
      .getSession(user.userId, id)
      .then((data) => successResponse(data));
  }

  @Get('sessions/:id/messages')
  @ApiOperation({ summary: 'Get session messages (chronological)' })
  getMessages(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.aiChatService.getMessages(user.userId, id, query);
  }

  @Post('sessions/:id/messages')
  @ApiOperation({
    summary: 'Send message — persists user + assistant turns with history',
  })
  sendMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: SendAiMessageDto,
  ) {
    return this.aiChatService
      .sendMessage(user.userId, id, dto)
      .then((data) => successResponse(data, 'Message sent'));
  }
}
