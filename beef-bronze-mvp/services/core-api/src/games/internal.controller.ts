import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ResultReport } from '@beef/contracts';
import { InternalGuard, ZodPipe } from '../common/http.ts';
import { ResultsService } from './results.service.ts';

/** Called only by game-engine when a server-authoritative session ends. */
@Controller('internal')
@UseGuards(InternalGuard)
export class InternalResultsController {
  constructor(private readonly results: ResultsService) {}

  @Post('results')
  @HttpCode(200)
  record(@Body(new ZodPipe(ResultReport)) body: ResultReport) {
    return this.results.record(body);
  }
}
