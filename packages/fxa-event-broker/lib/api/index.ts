/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Entry point for initializing the HTTP API for proxying Google PubSub events.
 *
 * @module
 */
import { Server } from '@hapi/hapi';
import { StatsD } from 'hot-shots';
import { Logger } from 'mozlog';

import { JWT } from '../jwts';
import { ClientWebhookService } from '../selfUpdatingService/clientWebhookService';
import pubSubAuth from './pubsub-auth';
import Routes from './routes';

export type ProxyConfig = {
  pubsub: {
    audience: string;
    authenticate: boolean;
    verificationToken: string;
  };
  openid: {
    issuer: string;
    key: object;
  };
};

/**
 * Initialize and setup the HTTP API on the `server` object.
 *
 * @param logger
 * @param metrics
 * @param config
 * @param server
 * @param webhookService
 */
export function apiInit(
  logger: Logger,
  metrics: StatsD,
  config: ProxyConfig,
  server: Server,
  webhookService: ClientWebhookService
) {
  const jwt = new JWT(config.openid);
  server.auth.scheme('googlePubSub', pubSubAuth);
  server.auth.strategy('pubsub', 'googlePubSub', config.pubsub);
  Routes(logger, metrics, server, jwt, webhookService);
}
