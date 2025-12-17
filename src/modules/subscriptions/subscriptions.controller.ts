import { Controller } from '@nestjs/common';

import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionService: SubscriptionsService) {}
}
