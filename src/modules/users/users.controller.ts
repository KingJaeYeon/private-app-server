import { Controller, Get } from '@nestjs/common';
import { UsersService } from '@/modules/users/users.service';
import { ApiGetResponse } from '@/common/decorators/api-get-response.decorator';
import { UserResponseDto } from '@/modules/users/dto/user.dto';
import { CurrentUser } from '@/common/decorators';
import { toResponseDto } from '@/common/helper/to-response-dto.helper';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiGetResponse({
    type: UserResponseDto,
    description: 'description',
    operations: { summary: '채널 상세 조회' }
  })
  async getCurrentUser(@CurrentUser('userId') userId: string) {
    const user = await this.usersService.getUserByUserId(userId);
    return toResponseDto(UserResponseDto, user);
  }
}
