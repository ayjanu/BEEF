import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { ReportCreateRequest, type ReportCreate } from '@beef/contracts';
import { CLIENTS, type ServiceClients } from '../infra/clients.ts';
import { CurrentUser, UserGuard, ZodPipe, type AuthedUser } from '../common/http.ts';

/** In-app reports go through core-api (which knows the reporter) to the safety service. */
@Controller('v1')
@UseGuards(UserGuard)
export class ReportsController {
  constructor(@Inject(CLIENTS) private readonly clients: ServiceClients) {}

  @Post('reports')
  @HttpCode(201)
  create(@CurrentUser() user: AuthedUser, @Body(new ZodPipe(ReportCreateRequest)) body: ReportCreate) {
    return this.clients.createReport({ ...body, reporterId: user.id });
  }
}
