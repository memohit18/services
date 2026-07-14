import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@ApiTags('Profile')
@ApiBearerAuth()
@Controller()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: '{ name, email, phone, avatar, imageUrl, role }',
  })
  getProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getProfile(user.userId);
  }

  @Patch('profile')
  @ApiOperation({
    summary:
      'Edit profile (name, phone, imageUrl/avatar). Pass image URL from POST /images.',
  })
  @ApiResponse({
    status: 200,
    description: '{ name, email, phone, avatar, imageUrl, role }',
  })
  updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(user.userId, dto);
  }
}
