import { Controller } from '@nestjs/common';
import { UsersService } from '@/modules/users/users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}
}
