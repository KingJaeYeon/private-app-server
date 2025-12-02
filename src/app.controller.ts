import { All, Controller, Get, HttpCode } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from '@/common/decorators';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @All('.well-known/*')
  @HttpCode(204)
  wellKnown() {}

  @Public()
  @Get('favicon.ico')
  @HttpCode(204)
  favicon() {}

  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
