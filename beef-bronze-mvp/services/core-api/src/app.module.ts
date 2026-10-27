import { Module, type DynamicModule } from '@nestjs/common';
import { CONFIG, type Config } from './config.ts';
import { DB, type Db } from './infra/db.ts';
import { REDIS } from './infra/redis.ts';
import { CLIENTS, ServiceClients } from './infra/clients.ts';
import { TOKENS, type TokenService } from './auth/jwt.ts';
import type { Redis } from 'ioredis';
import { InternalGuard, UserGuard } from './common/http.ts';
import { AuthController } from './auth/auth.controller.ts';
import { ProfilesController } from './profiles/profiles.controller.ts';
import { InternalThreadsController, MatchController } from './match/match.controller.ts';
import { GamesController } from './games/games.controller.ts';
import { InternalResultsController } from './games/internal.controller.ts';
import { SessionsService } from './games/sessions.service.ts';
import { ResultsService } from './games/results.service.ts';
import { MatchesConsumer } from './games/matches.consumer.ts';
import { ProgressionController } from './progression/progression.controller.ts';
import { ReportsController } from './safety/reports.controller.ts';
import { SocialController } from './social/social.controller.ts';
import { InternalVenuesController, VenueStaffController, VenuesController } from './venues/venues.controller.ts';
import { MeetAlerts } from './venues/meet-alerts.ts';
import { SafetySweep } from './venues/safety-sweep.ts';
import { HealthController } from './health.controller.ts';

/**
 * Bronze runs core-api as a modular monolith (Spec 03 "Backend services and
 * phasing"). Each controller group maps to a module that can be split into
 * its own service later without changing its HTTP contract.
 */
@Module({})
export class AppModule {
  static register(deps: { cfg: Config; db: Db; redis: Redis; tokens: TokenService }): DynamicModule {
    return {
      module: AppModule,
      controllers: [
        HealthController,
        AuthController,
        ProfilesController,
        MatchController,
        InternalThreadsController,
        GamesController,
        InternalResultsController,
        ProgressionController,
        ReportsController,
        SocialController,
        VenuesController,
        VenueStaffController,
        InternalVenuesController,
      ],
      providers: [
        { provide: CONFIG, useValue: deps.cfg },
        { provide: DB, useValue: deps.db },
        { provide: REDIS, useValue: deps.redis },
        { provide: TOKENS, useValue: deps.tokens },
        { provide: CLIENTS, useValue: new ServiceClients(deps.cfg) },
        UserGuard,
        InternalGuard,
        SessionsService,
        ResultsService,
        MatchesConsumer,
        MeetAlerts,
        SafetySweep,
      ],
    };
  }
}
